import { QueryClient } from "@tanstack/react-query";
import { createApplicationRuntime } from "@bedrock-server-manager/runtime";
import { createApiClient } from "@bedrock-server-manager/api-client";
import { createHttpTransport } from "@bedrock-server-manager/api-client/transport";
import { createUrlResolver } from "@bedrock-server-manager/api-client/urls";
import { browserPlatform } from "../../app/browserPlatform";
import { coreEventTopics } from "../../app/coreEvents";
import {
  readInstanceToken,
  writeInstanceToken,
} from "../../app/instanceProfiles";

/** A fixed backend, credential, cache, session generation and socket per saved instance. */
export function createInstanceConnection(
  profile,
  {
    onChange = () => {},
    fetch: fetcher,
    platform = browserPlatform,
    readToken = readInstanceToken,
    writeToken = writeInstanceToken,
  } = {},
) {
  const token = readToken(profile.url);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const resolveUrl = createUrlResolver(profile.url);
  const wsUrl = new URL(resolveUrl("/ws"));
  wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
  let client;
  const runtime = createApplicationRuntime({
    queryClient: cache,
    getBackendIdentity: () => profile.url,
    callOperation: (...args) => client.callOperation(...args),
    resolveWebSocketUrl: () => wsUrl.href,
    platform: { ...platform, getToken: () => token, connected: () => {} },
  });
  const transport = createHttpTransport({
    resolveApiUrl: resolveUrl,
    getToken: () => token,
    fetch: fetcher,
    captureSession: () => runtime.sessionRuntime.capture(),
  });
  client = createApiClient({
    request: (url, options) =>
      transport.request(url, { ...options, credentials: "omit" }),
  });
  let state = {
    status: token ? "connecting" : "signed-out",
    user: null,
    info: null,
    servers: [],
    socket: "disconnected",
    error: null,
    updatedAt: null,
    pending: null,
  };
  let disposed = false,
    inFlight = null,
    pollTimer,
    eventTimer,
    socket,
    stopSocket;
  const publish = (patch) => {
    if (!disposed) {
      state = { ...state, ...patch };
      onChange(state);
    }
  };
  const queueRefresh = () => {
    if (disposed || eventTimer || !platform.isVisible() || !platform.isOnline())
      return;
    eventTimer = setTimeout(() => {
      eventTimer = null;
      void refresh();
    }, 250);
  };
  function connectSocket(user) {
    if (socket || disposed) return;
    socket = runtime.createWebSocketManager({
      onState: (value) => publish({ socket: value.connectionState }),
      onMessage: (message) => {
        if (message.type === "event") queueRefresh();
      },
    });
    coreEventTopics.forEach(socket.subscribe);
    stopSocket = socket.start(
      JSON.stringify([profile.url, user.id ?? user.username]),
    );
  }
  async function load() {
    try {
      const user = await client.callOperation("get_account");
      if (!user?.username && user?.id == null)
        throw new Error("Invalid account response from this instance.");
      publish({ user });
      const results = await Promise.allSettled([
        client.callOperation("list_servers"),
        client.callOperation("get_system_info"),
      ]);
      if (disposed) return;
      const fleet = results[0];
      if (fleet.status === "rejected") throw fleet.reason;
      if (!Array.isArray(fleet.value?.servers))
        throw new Error("Invalid server list from this instance.");
      if (
        !fleet.value.servers.every(
          (server) =>
            typeof server?.name === "string" &&
            server.name &&
            (server.status == null || typeof server.status === "string"),
        )
      )
        throw new Error("Invalid server data from this instance.");
      cache.setQueryData(["servers"], fleet.value.servers);
      publish({
        status: "online",
        user,
        servers: fleet.value.servers,
        info:
          results[1].status === "fulfilled"
            ? (results[1].value.info ?? results[1].value)
            : null,
        updatedAt: new Date().toISOString(),
        error: null,
      });
      connectSocket(user);
    } catch (error) {
      if (disposed || error.name === "AbortError") return;
      const unauthorized = error.status === 401;
      const forbidden = error.status === 403;
      if (unauthorized || forbidden) {
        clearInterval(pollTimer);
        stopSocket?.();
        socket = null;
        cache.clear();
      }
      publish({
        status: unauthorized
          ? "signed-out"
          : forbidden
            ? "forbidden"
            : "offline",
        error: error.message,
        ...(unauthorized ? { user: null, servers: [], updatedAt: null } : {}),
      });
    }
  }
  function refresh() {
    if (disposed || !token) return Promise.resolve();
    if (inFlight) return inFlight;
    inFlight = load().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  const wake = () => {
    if (platform.isVisible() && platform.isOnline()) void refresh();
  };
  let started = false;
  const loginClient = createApiClient({
    request: (url, options) => {
      const publicTransport = createHttpTransport({
        resolveApiUrl: resolveUrl,
        fetch: fetcher,
        captureSession: () => runtime.sessionRuntime.capture(),
      });
      return publicTransport.request(url, { ...options, credentials: "omit" });
    },
  });
  return {
    getSnapshot: () => state,
    async start() {
      if (disposed || started) return;
      started = true;
      platform.addEventListener("visibilitychange", wake);
      platform.addEventListener("online", wake);
      await refresh();
      if (
        !disposed &&
        token &&
        !["signed-out", "forbidden"].includes(state.status)
      )
        pollTimer = setInterval(() => {
          if (platform.isVisible() && platform.isOnline()) void refresh();
        }, 15000);
    },
    refresh,
    async login(username, password, remember = false) {
      const body = new URLSearchParams({
        username,
        password,
        grant_type: "password",
        remember_me: String(remember),
      });
      const result = await loginClient.callOperation("login", { body });
      if (disposed)
        throw new DOMException("Instance session changed", "AbortError");
      if (typeof result?.access_token !== "string" || !result.access_token)
        throw new Error("This instance did not return an access token.");
      writeToken(profile.url, result.access_token, remember);
    },
    async logout() {
      try {
        if (token) await client.callOperation("logout");
      } finally {
        if (!disposed) writeToken(profile.url, null);
      }
    },
    /** @param {string} serverName @param {"start_server" | "stop_server" | "restart_server"} action */
    async action(serverName, action) {
      if (disposed || state.status !== "online" || !state.user)
        throw new Error("Reconnect to this instance before making changes.");
      if (state.pending)
        throw new Error("Another action is already running on this instance.");
      if (!["start_server", "stop_server", "restart_server"].includes(action))
        throw new Error("Unsupported instance action.");
      if (!state.servers.some((server) => server.name === serverName))
        throw new Error("This server is not in the instance's current fleet.");
      publish({ pending: serverName });
      try {
        const result = await client.callOperation(action, {
          path: { server_name: serverName },
        });
        await refresh();
        if (["error", "failed", "partial"].includes(result?.status))
          throw new Error(
            result.message ??
              "The operation did not fully complete. Refresh before retrying.",
          );
        return result;
      } finally {
        publish({ pending: null });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(pollTimer);
      clearTimeout(eventTimer);
      platform.removeEventListener("visibilitychange", wake);
      platform.removeEventListener("online", wake);
      stopSocket?.();
      runtime.dispose();
      cache.clear();
    },
  };
}
