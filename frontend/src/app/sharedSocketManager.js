/** A Web Lock owns the socket and task recovery; BroadcastChannel fans out reads.
 * Unsupported browsers retain one independent runtime per tab. No credentials or
 * write requests cross the channel. Every received frame still enters reconciliation.
 */
export function createSharedSocketManager({
  createManager,
  runtime,
  onMessage,
  onState,
  locks = navigator.locks,
  Channel = window.BroadcastChannel,
  events = window,
  visibility = document,
  now = Date.now,
  setInterval: interval = setInterval,
  clearInterval: clear = clearInterval,
  id,
}) {
  if (!locks?.request || !Channel) return createManager({ onMessage, onState });
  id ??= globalThis.crypto?.randomUUID?.();
  if (!id) return createManager({ onMessage, onState });
  let leader = false;
  let active = false;
  let channel;
  let stopSocket = () => {};
  let release = () => {};
  let stopCurrent = () => {};
  let state = {
    isConnected: false,
    isFallback: true,
    connectionState: "connecting",
  };
  const ownership = new Set();
  const topics = new Map();
  const subscribed = new Set();
  const peers = new Map();
  let owner = null;
  let term = 0;
  let latestTerm = 0;
  let publishPresence = () => {};
  const post = (message) => {
    if (active) {
      try {
        channel?.postMessage({ version: 1, from: id, term, ...message });
      } catch {
        /* A closing channel cannot interrupt application state. */
      }
    }
  };
  const setLeader = (value) => {
    if (leader === value) return;
    leader = value;
    ownership.forEach((listener) => listener(value));
  };
  const manager = createManager({
    onMessage(message, ticket) {
      if (!leader || !active) return;
      post({ type: "frame", message });
      onMessage(message, ticket);
    },
    onState(next) {
      if (!active) return;
      state = next;
      onState(next);
      if (leader) post({ type: "state", state });
    },
  });
  const pendingOperations = () =>
    runtime.operationCoordinator
      .list()
      .filter((operation) => !operation.terminal && operation.kind)
      .map(({ id, kind, serverName, affectedKeys }) => ({
        id,
        kind,
        serverName,
        affectedKeys,
      }));
  const sync = () => {
    if (!leader) return;
    const desired = new Set([
      ...topics.keys(),
      ...[...peers.values()].flatMap((peer) => peer.topics),
    ]);
    for (const topic of desired)
      if (!subscribed.has(topic)) {
        subscribed.add(topic);
        manager.subscribe(topic);
      }
    for (const topic of subscribed)
      if (!desired.has(topic)) {
        subscribed.delete(topic);
        manager.unsubscribe(topic);
      }
    runtime.diagnostics.subscriptions(
      desired.size,
      [...topics.values()].reduce((sum, count) => sum + count, 0) +
        [...peers.values()].reduce((sum, peer) => sum + peer.topics.length, 0),
    );
  };
  return {
    subscribeOwnership(listener) {
      ownership.add(listener);
      listener(leader);
      return () => ownership.delete(listener);
    },
    subscribe(topic) {
      topics.set(topic, (topics.get(topic) ?? 0) + 1);
      sync();
      publishPresence();
    },
    unsubscribe(topic) {
      const count = topics.get(topic) ?? 0;
      if (count > 1) topics.set(topic, count - 1);
      else topics.delete(topic);
      sync();
      publishPresence();
    },
    // Writes use HTTP. Only the owning tab may send custom socket messages.
    sendMessage(message) {
      if (leader) manager.sendMessage(message);
    },
    reconnect() {
      if (leader) manager.reconnect();
      else post({ type: "reconnect" });
    },
    start(identity) {
      stopCurrent();
      if (identity === null) return () => {};
      active = true;
      owner = null;
      term = 0;
      latestTerm = 0;
      peers.clear();
      const session = runtime.sessionRuntime.capture();
      const name = `bsm-runtime-v1:${identity}`;
      try {
        channel = new Channel(name);
      } catch {
        setLeader(true);
        const stop = manager.start(identity);
        sync();
        let stopped = false;
        stopCurrent = () => {
          if (stopped) return;
          stopped = true;
          removeReset();
          active = false;
          setLeader(false);
          stop();
          for (const topic of subscribed) manager.unsubscribe(topic);
          subscribed.clear();
        };
        const removeReset = runtime.sessionRuntime.onReset(stopCurrent);
        return stopCurrent;
      }
      let stopped = false;
      let suspended = false;
      let controller;
      let lastPresence = "";
      const current = () =>
        active &&
        !stopped &&
        runtime.sessionRuntime.isCurrent(session) &&
        !session.signal.aborted;
      const presence = () => ({
        type: "presence",
        topics: [...topics.keys()],
        operations: pendingOperations(),
      });
      publishPresence = (force = false) => {
        if (!current()) return;
        const message = presence();
        const serialized = JSON.stringify(message);
        if (force || serialized !== lastPresence) {
          lastPresence = serialized;
          post(message);
        }
      };
      const taskFrame = (record) => ({
        type: "task_update",
        data: record.value,
        epoch: record.epoch ?? undefined,
        revision: record.revision,
      });
      channel.onmessage = ({ data }) => {
        if (
          !current() ||
          data?.version !== 1 ||
          data.from === id ||
          typeof data?.from !== "string"
        )
          return;
        if (
          data.type === "presence" &&
          Array.isArray(data.topics) &&
          Array.isArray(data.operations)
        ) {
          const fresh = !peers.has(data.from);
          peers.set(data.from, {
            at: now(),
            topics: data.topics
              .filter(
                (topic) => typeof topic === "string" && topic.length <= 1024,
              )
              .slice(0, 1000),
          });
          if (leader) {
            sync();
            if (fresh) post({ type: "state", state });
            for (const operation of data.operations.slice(0, 500)) {
              if (
                typeof operation?.id !== "string" ||
                !operation.id ||
                typeof operation.kind !== "string"
              )
                continue;
              if (!runtime.operationCoordinator.get(operation.id))
                runtime.operationCoordinator.register({
                  id: operation.id,
                  kind: operation.kind,
                  serverName:
                    typeof operation.serverName === "string"
                      ? operation.serverName
                      : undefined,
                  affectedKeys: Array.isArray(operation.affectedKeys)
                    ? operation.affectedKeys.filter(Array.isArray).slice(0, 50)
                    : [],
                });
              const record = runtime.stateReconciler.read([
                "task",
                operation.id,
              ]);
              if (record)
                post({ type: "snapshot", message: taskFrame(record) });
            }
          }
        } else if (data.type === "leave") {
          peers.delete(data.from);
          sync();
        } else if (
          data.type === "state" &&
          !leader &&
          data.state &&
          typeof data.state.isConnected === "boolean" &&
          Number.isSafeInteger(data.term) &&
          data.term >= latestTerm
        ) {
          latestTerm = data.term;
          const changed = owner !== data.from;
          owner = data.from;
          state = data.state;
          if (changed) publishPresence(true);
          onState(state);
        } else if (
          (data.type === "frame" || data.type === "snapshot") &&
          !leader &&
          data.from === owner &&
          data.term === latestTerm &&
          data.message?.type
        ) {
          onMessage(data.message, runtime.stateReconciler.capture());
        } else if (
          data.type === "unavailable" &&
          !leader &&
          data.from === owner &&
          data.term === latestTerm &&
          typeof data.id === "string"
        ) {
          runtime.operationCoordinator.markUnavailable(data.id, {
            code: "task_unavailable",
            message: "Task snapshot is unavailable",
            details: null,
          });
        } else if (data.type === "reconnect" && leader) manager.reconnect();
      };
      const requestOwnership = () => {
        if (!current() || suspended) return;
        controller = new AbortController();
        void Promise.resolve()
          .then(() =>
            locks.request(name, { signal: controller.signal }, async () => {
              if (!current() || suspended) return;
              owner = id;
              term = Math.max(now(), latestTerm + 1);
              latestTerm = term;
              // Install the release before notifying recovery observers.
              const held = new Promise((resolve) => {
                release = resolve;
              });
              setLeader(true);
              runtime.diagnostics.record("coordination", {
                reason: "owner-acquired",
              });
              post({ type: "state", state });
              sync();
              stopSocket = manager.start(identity);
              publishPresence(true);
              await held;
            }),
          )
          .catch((error) => {
            if (!current() || suspended || error?.name === "AbortError") return;
            // If the platform denies locks, keep a fully working independent tab.
            channel?.close();
            channel = null;
            setLeader(true);
            stopSocket = manager.start(identity);
            sync();
          });
      };
      const suspend = () => {
        suspended = true;
        post({ type: "leave" });
        controller?.abort();
        setLeader(false);
        stopSocket();
        stopSocket = () => {};
        for (const topic of subscribed) manager.unsubscribe(topic);
        subscribed.clear();
        release();
        release = () => {};
      };
      const resume = () => {
        if (current() && suspended) {
          suspended = false;
          requestOwnership();
          publishPresence(true);
        } else if (current()) publishPresence(true);
      };
      const visible = () => {
        if (visibility.visibilityState !== "hidden") resume();
      };
      events.addEventListener("pagehide", suspend);
      events.addEventListener("pageshow", resume);
      visibility.addEventListener("freeze", suspend);
      visibility.addEventListener("resume", resume);
      visibility.addEventListener("visibilitychange", visible);
      const timer = interval(() => {
        if (!current() || suspended) return;
        for (const [peer, value] of peers)
          if (now() - value.at > 12_000) peers.delete(peer);
        sync();
        publishPresence(true);
        if (leader) post({ type: "state", state });
      }, 3000);
      const stopOperations = runtime.operationCoordinator.subscribe(
        (operations) => {
          publishPresence();
          if (leader)
            for (const operation of operations)
              if (
                operation.status === "unknown" &&
                operation.availability === "unavailable"
              )
                post({ type: "unavailable", id: operation.id });
        },
      );
      const stopObservations = runtime.stateReconciler.onObservation(
        (record) => {
          if (leader && record.key[0] === "task" && record.source === "http")
            post({ type: "snapshot", message: taskFrame(record) });
        },
      );
      const stop = () => {
        if (stopped) return;
        suspend();
        stopped = true;
        active = false;
        clear(timer);
        stopOperations();
        stopObservations();
        stopReset();
        events.removeEventListener("pagehide", suspend);
        events.removeEventListener("pageshow", resume);
        visibility.removeEventListener("freeze", suspend);
        visibility.removeEventListener("resume", resume);
        visibility.removeEventListener("visibilitychange", visible);
        channel?.close();
        channel = null;
        publishPresence = () => {};
        peers.clear();
      };
      const stopReset = runtime.sessionRuntime.onReset(stop);
      stopCurrent = stop;
      onState(state);
      publishPresence(true);
      requestOwnership();
      return stop;
    },
  };
}
