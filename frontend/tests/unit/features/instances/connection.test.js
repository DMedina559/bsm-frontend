import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { createInstanceConnection } from "../../../../src/features/instances/connection";

const sessions = [];
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  sessions.splice(0).forEach((session) => session.dispose());
  vi.useRealTimers();
});
function platform() {
  const sockets = [];
  return {
    sockets,
    isOnline: () => true,
    isVisible: () => true,
    getToken: () => "unused",
    connected: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createWebSocket: (url) => {
      const socket = { url, send: vi.fn(), close: vi.fn(), readyState: 1 };
      sockets.push(socket);
      return socket;
    },
  };
}
function create(url, fetch, extra = {}) {
  const session = createInstanceConnection(
    { id: url, url },
    {
      platform: platform(),
      fetch,
      readToken: (backend) => `${backend}-token`,
      ...extra,
    },
  );
  sessions.push(session);
  return session;
}
function responder(requests) {
  return vi.fn(async (url, options) => {
    requests.push({
      url,
      token: new Headers(options.headers).get("Authorization"),
      credentials: options.credentials,
      body: options.body,
    });
    if (url.endsWith("/api/account"))
      return Response.json({
        id: 1,
        username: new URL(url).host,
        role: "admin",
      });
    if (url.endsWith("/api/servers"))
      return Response.json({
        servers: [{ name: "survival", status: "running", version: "1.0" }],
      });
    if (url.endsWith("/api/info"))
      return Response.json({ info: { app_version: "4.0" } });
    if (url.endsWith("/auth/token"))
      return Response.json({ access_token: "new-token" });
    return Response.json({ status: "success" });
  });
}
describe("Independent instance connections", () => {
  it("concurrently loads same-named fleets without sharing credentials, sockets or mutations", async () => {
    const requests = [],
      fetch = responder(requests),
      aPlatform = platform(),
      bPlatform = platform();
    const a = create("https://bsm.test/one", fetch, { platform: aPlatform });
    const b = create("https://bsm.test/two", fetch, { platform: bPlatform });
    await Promise.all([a.start(), b.start()]);
    expect(a.getSnapshot().servers[0].name).toBe("survival");
    expect(b.getSnapshot().servers[0].name).toBe("survival");
    expect(aPlatform.sockets[0].url).toBe("wss://bsm.test/one/ws");
    expect(bPlatform.sockets[0].url).toBe("wss://bsm.test/two/ws");
    aPlatform.sockets[0].onopen();
    bPlatform.sockets[0].onopen();
    expect(aPlatform.sockets[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        action: "authenticate",
        token: "https://bsm.test/one-token",
      }),
    );
    await a.action("survival", "stop_server");
    expect(
      requests.some(
        (r) => r.url === "https://bsm.test/one/api/server/survival/stop",
      ),
    ).toBe(true);
    expect(
      requests.some((r) => r.url.includes("/two/") && r.url.endsWith("/stop")),
    ).toBe(false);
    for (const request of requests) {
      expect(request.credentials).toBe("omit");
      expect(request.token).toBe(
        `Bearer ${request.url.includes("/one/") ? "https://bsm.test/one-token" : "https://bsm.test/two-token"}`,
      );
    }
    expect(b.getSnapshot().servers).toHaveLength(1);
    a.dispose();
    expect(bPlatform.sockets[0].close).not.toHaveBeenCalled();
    await b.refresh();
    expect(b.getSnapshot().status).toBe("online");
  });
  it("keeps one offline backend from preventing another instance from loading", async () => {
    const fetch = responder([]);
    const a = create("https://offline.test", async () => {
      throw new TypeError("Unreachable");
    });
    const b = create("https://online.test", fetch);
    await Promise.all([a.start(), b.start()]);
    expect(a.getSnapshot().status).toBe("offline");
    expect(b.getSnapshot().status).toBe("online");
  });
  it("does not publish late responses after disposal", async () => {
    let release;
    const onChange = vi.fn();
    const session = create(
      "https://one.test",
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      { onChange },
    );
    const loading = session.start();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    session.dispose();
    release(Response.json({ id: 1, username: "old" }));
    await loading;
    expect(onChange).not.toHaveBeenCalled();
  });
  it("uses an unauthenticated login transport and only writes the target token", async () => {
    const requests = [],
      writeToken = vi.fn();
    const session = create("https://one.test", responder(requests), {
      writeToken,
    });
    await session.login("new-user", "password", true);
    expect(requests).toHaveLength(1);
    expect(requests[0].token).toBeNull();
    expect(writeToken).toHaveBeenCalledWith(
      "https://one.test",
      "new-token",
      true,
    );
  });
  it("requires sign-in before connecting and stops polling rejected credentials", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () =>
      Response.json({ detail: "Unauthorized" }, { status: 401 }),
    );
    const signedOut = create("https://none.test", fetch, {
      readToken: () => null,
    });
    await signedOut.start();
    expect(fetch).not.toHaveBeenCalled();
    const expired = create("https://expired.test", fetch);
    await expired.start();
    expect(expired.getSnapshot().status).toBe("signed-out");
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

it("refreshes only the instance that receives a socket lifecycle event", async () => {
  vi.useFakeTimers();
  const requests = [],
    fetch = responder(requests),
    aPlatform = platform(),
    bPlatform = platform();
  const a = create("https://one.test", fetch, { platform: aPlatform });
  const b = create("https://two.test", fetch, { platform: bPlatform });
  await Promise.all([a.start(), b.start()]);
  const socket = aPlatform.sockets[0];
  socket.onopen();
  socket.onmessage({
    data: JSON.stringify({
      status: "success",
      message: "Authenticated successfully",
    }),
  });
  const bRequests = requests.filter((request) =>
    request.url.includes("two.test"),
  ).length;
  const aRequests = requests.filter((request) =>
    request.url.includes("one.test"),
  ).length;
  socket.onmessage({
    data: JSON.stringify({
      type: "event",
      event: "after_server_status_change",
    }),
  });
  await vi.advanceTimersByTimeAsync(300);
  expect(
    requests.filter((request) => request.url.includes("two.test")),
  ).toHaveLength(bRequests);
  expect(
    requests.filter((request) => request.url.includes("one.test")),
  ).toHaveLength(aRequests + 3);
});

it("forces a new fleet read when an action overlaps an older refresh", async () => {
  const base = responder([]);
  let release,
    status = "running",
    hold = false;
  const fetch = vi.fn(async (url, options) => {
    if (url.endsWith("/stop")) {
      status = "stopped";
      return Response.json({ status: "success" });
    }
    if (url.endsWith("/api/servers")) {
      const snapshot = status;
      if (hold) {
        hold = false;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
      return Response.json({
        servers: [{ name: "survival", status: snapshot }],
      });
    }
    return base(url, options);
  });
  const session = create("https://race.test", fetch);
  await session.start();
  hold = true;
  const old = session.refresh();
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  const action = session.action("survival", "stop_server");
  await vi.waitFor(() => expect(status).toBe("stopped"));
  release();
  await Promise.all([old, action]);
  expect(session.getSnapshot().servers[0].status).toBe("stopped");
});
it("restarts polling after recovery from rejected credentials", async () => {
  vi.useFakeTimers();
  let rejected = true;
  const base = responder([]);
  const fetch = vi.fn((url, options) =>
    rejected
      ? Response.json({ detail: "Forbidden" }, { status: 403 })
      : base(url, options),
  );
  const session = create("https://recovery.test", fetch);
  await session.start();
  rejected = false;
  await session.refresh();
  const count = fetch.mock.calls.length;
  await vi.advanceTimersByTimeAsync(15001);
  expect(fetch.mock.calls.length).toBeGreaterThan(count);
  expect(session.getSnapshot().status).toBe("online");
});
it("keeps accepted tasks pending and recovers completion over HTTP", async () => {
  const base = responder([]);
  let taskStatus = "running";
  const fetch = vi.fn((url, options) => {
    if (url.endsWith("/stop"))
      return Response.json({ status: "accepted", task_id: "task-one" });
    if (url.endsWith("/api/tasks/status/task-one"))
      return Response.json({ id: "task-one", status: taskStatus });
    return base(url, options);
  });
  const session = create("https://tasks.test", fetch);
  await session.start();
  await session.action("survival", "stop_server");
  expect(session.getSnapshot().pending).toBe("survival");
  await expect(session.action("survival", "start_server")).rejects.toThrow(
    /already running/,
  );
  taskStatus = "completed";
  await session.refresh();
  expect(session.getSnapshot().pending).toBeNull();
  expect(session.getSnapshot().operations[0].status).toBe("completed");
  session.dispose();
  const restored = create("https://tasks.test", fetch);
  await restored.start();
  expect(restored.getSnapshot().operations[0].status).toBe("completed");
});

it("does no network or socket work for a paused profile", async () => {
  const fetch = responder([]),
    device = platform();
  const session = createInstanceConnection(
    { id: "paused", url: "https://paused.test", paused: true },
    { fetch, platform: device, readToken: () => "token" },
  );
  sessions.push(session);
  await session.start();
  await session.refresh();
  expect(session.getSnapshot().status).toBe("paused");
  expect(fetch).not.toHaveBeenCalled();
  expect(device.sockets).toHaveLength(0);
});
it("backs off offline polling and resets after recovery", async () => {
  vi.useFakeTimers();
  let offline = true;
  const base = responder([]);
  const fetch = vi.fn((url, options) => {
    if (offline) throw new TypeError("Network unavailable");
    return base(url, options);
  });
  const session = create("https://backoff.test", fetch);
  await session.start();
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(15000);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(15000);
  expect(fetch).toHaveBeenCalledTimes(2);
  offline = false;
  await vi.advanceTimersByTimeAsync(15000);
  expect(session.getSnapshot().status).toBe("online");
  expect(session.getSnapshot().retryCount).toBe(0);
});
it("preserves uncertain mutations across reloads without retrying writes", async () => {
  const base = responder([]);
  const fetch = vi.fn((url, options) => {
    if (url.endsWith("/stop"))
      throw new DOMException("Response timed out", "TimeoutError");
    return base(url, options);
  });
  const session = create("https://uncertain.test", fetch);
  await session.start();
  await expect(session.action("survival", "stop_server")).rejects.toThrow(
    /outcome.*unknown/,
  );
  expect(session.getSnapshot().pending).toBe("survival");
  const operation = session.getSnapshot().operations[0];
  expect(operation.uncertain).toBe(true);
  session.dispose();
  const restored = create("https://uncertain.test", fetch);
  await restored.start();
  await expect(restored.action("survival", "stop_server")).rejects.toThrow(
    /already running/,
  );
  expect(
    fetch.mock.calls.filter(([url]) => url.endsWith("/stop")),
  ).toHaveLength(1);
  expect(
    fetch.mock.calls.some(([url]) => url.includes("/tasks/status/uncertain")),
  ).toBe(false);
  restored.acknowledgeUncertain(operation.id);
  expect(restored.getSnapshot().pending).toBeNull();
});

it("confirms a lost action response from fresh server state without repeating the mutation", async () => {
  let status = "stopped";
  const base = responder([]);
  const fetch = vi.fn((url, options) => {
    if (url.endsWith("/start")) {
      status = "running";
      throw new DOMException("Timed out", "TimeoutError");
    }
    if (url.endsWith("/api/servers"))
      return Response.json({ servers: [{ name: "survival", status }] });
    return base(url, options);
  });
  const session = create("https://confirmed.test", fetch);
  await session.start();
  await expect(
    session.action("survival", "start_server"),
  ).resolves.toMatchObject({ status: "success" });
  expect(session.getSnapshot().pending).toBeNull();
  expect(session.getSnapshot().operations[0].status).toBe("completed");
  expect(
    fetch.mock.calls.filter(([url]) => url.endsWith("/start")),
  ).toHaveLength(1);
});
