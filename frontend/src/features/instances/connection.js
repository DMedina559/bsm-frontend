import { sessionSettings } from "../../app/browserStorage";
import { createSharedSocketManager } from "../../app/sharedSocketManager";
import { validateBackendUrl } from "../../app/backendUrl";
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
    operations: [],
  };
  let disposed = false,
    inFlight = null,
    refreshAgain = false,
    pollTimer,
    eventTimer,
    socket,
    stopSocket,
    historyKey = null;
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
      void refresh(true);
    }, 250);
  };
  function connectSocket(user) {
    if (socket || disposed) return;
    const callbacks = {
      onState: (value) => publish({ socket: value.connectionState }),
      onMessage: (message, ticket) => {
        runtime.reconcileSocketMessage(message, ticket);
        if (message.type === "event" || message.type === "task_update")
          queueRefresh();
      },
    };
    socket =
      platform === browserPlatform
        ? createSharedSocketManager({
            createManager: runtime.createWebSocketManager,
            runtime,
            ...callbacks,
          })
        : runtime.createWebSocketManager(callbacks);
    coreEventTopics.forEach(socket.subscribe);
    for (const operation of runtime.operationCoordinator
      .list()
      .filter((value) => !value.terminal)) {
      const topic = `task:${operation.id}`;
      socket.subscribe(topic);
      taskTopics.add(topic);
    }
    stopSocket = socket.start(
      JSON.stringify([profile.url, String(user.id ?? user.username)]),
    );
  }
  async function load() {
    try {
      validateBackendUrl(profile.url);
      const user = await client.callOperation("get_account");
      if (!user?.username && user?.id == null)
        throw new Error("Invalid account response from this instance.");
      if (disposed) return;
      publish({ user });
      if (!historyKey) {
        historyKey = `bsm.instance-tasks.v1:${JSON.stringify([profile.url, String(user.id ?? user.username)])}`;
        try {
          const saved = JSON.parse(sessionSettings.getItem(historyKey) ?? "[]");
          if (Array.isArray(saved))
            for (const operation of saved.slice(-100)) {
              if (
                typeof operation?.id === "string" &&
                typeof operation.kind === "string" &&
                typeof operation.status === "string"
              )
                runtime.operationCoordinator.register(operation);
            }
        } catch {
          /* Invalid history must not block connection. */
        }
      }
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
      for (const operation of runtime.operationCoordinator
        .list()
        .filter((value) => !value.terminal)) {
        try {
          const ticket = runtime.stateReconciler.capture();
          const result = await client.callOperation("get_task_status", {
            path: { task_id: operation.id },
          });
          if (disposed) return;
          const task = result.task ?? result;
          if (!task || typeof task.status !== "string")
            throw new Error("Invalid task status response from this instance.");
          runtime.reconcileTaskResponse({ ...task, id: operation.id }, ticket);
        } catch (error) {
          if (error.status === 404)
            runtime.operationCoordinator.markUnavailable(operation.id, {
              message:
                "Task no longer available. Open the workspace to investigate.",
            });
          else throw error;
        }
      }
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
      ensurePolling();
    } catch (error) {
      if (disposed || error.name === "AbortError") return;
      const unauthorized = error.status === 401;
      const forbidden = error.status === 403;
      if (unauthorized || forbidden) {
        clearInterval(pollTimer);
        pollTimer = null;
        taskTopics.clear();
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
        error: connectionError(error),
        ...(unauthorized ? { user: null, servers: [], updatedAt: null } : {}),
      });
    }
  }
  function connectionError(error) {
    if (error instanceof TypeError || /fetch|network/i.test(error.message))
      return `Cannot reach ${profile.url} from ${window.location.origin}. Check the address and certificate, and allow ${window.location.origin} in this backend's web.cors_origins setting, then restart its web server. Browsers cannot distinguish CORS from other network failures.`;
    return error.message;
  }
  function ensurePolling() {
    if (disposed || pollTimer || !token) return;
    pollTimer = setInterval(() => {
      if (platform.isVisible() && platform.isOnline()) void refresh();
    }, 15000);
  }
  function refresh(fresh = false) {
    if (disposed || !token) return Promise.resolve();
    if (inFlight) {
      if (fresh) refreshAgain = true;
      return inFlight;
    }
    inFlight = (async () => {
      do {
        refreshAgain = false;
        await load();
      } while (refreshAgain && !disposed);
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  const taskTopics = new Set();
  const stopOperations = runtime.operationCoordinator.subscribe(
    (operations) => {
      if (disposed || operations.length === 0) return;
      const active = operations.filter((operation) => !operation.terminal);
      for (const operation of active) {
        const topic = `task:${operation.id}`;
        if (socket && !taskTopics.has(topic)) {
          socket.subscribe(topic);
          taskTopics.add(topic);
        }
      }
      for (const topic of taskTopics) {
        if (!active.some((operation) => `task:${operation.id}` === topic)) {
          socket?.unsubscribe(topic);
          taskTopics.delete(topic);
        }
      }
      if (
        operations.some(
          (operation) =>
            operation.terminal &&
            !state.operations.some(
              (previous) => previous.id === operation.id && previous.terminal,
            ),
        )
      )
        queueRefresh();
      if (historyKey)
        sessionSettings.setItem(
          historyKey,
          JSON.stringify(
            operations
              .slice(-100)
              .map(
                ({ id, kind, serverName, status, createdAt, updatedAt }) => ({
                  id,
                  kind,
                  serverName,
                  status,
                  createdAt,
                  updatedAt,
                }),
              ),
          ),
        );
      publish({
        operations: operations.slice(-100),
        pending: active[0]?.serverName ?? null,
      });
    },
  );
  const wake = () => {
    if (platform.isVisible() && platform.isOnline()) void refresh(true);
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
    },
    refresh,
    async login(username, password, remember = false) {
      const body = new URLSearchParams({
        username,
        password,
        grant_type: "password",
        remember_me: String(remember),
      });
      let result;
      try {
        result = await loginClient.callOperation("login", { body });
      } catch (error) {
        throw new Error(connectionError(error));
      }
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
        if (disposed)
          throw new DOMException("Instance session changed", "AbortError");
        if (result?.task_id != null) {
          if (typeof result.task_id !== "string" || !result.task_id.trim())
            throw new Error("Invalid task ID in action response.");
          runtime.operationCoordinator.register({
            id: result.task_id,
            kind: action,
            serverName,
          });
        } else {
          runtime.operationCoordinator.register({
            id: crypto.randomUUID(),
            kind: action,
            serverName,
            status: ["error", "failed", "partial"].includes(result?.status)
              ? "failed"
              : "completed",
          });
        }
        await refresh(true);
        if (["error", "failed", "partial"].includes(result?.status))
          throw new Error(
            result.message ??
              "The operation did not fully complete. Refresh before retrying.",
          );
        return result;
      } finally {
        publish({
          pending:
            runtime.operationCoordinator
              .list()
              .find((operation) => !operation.terminal)?.serverName ?? null,
        });
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
      stopOperations();
      runtime.dispose();
      cache.clear();
    },
  };
}
