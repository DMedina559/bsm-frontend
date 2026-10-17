/** Deterministic host adapter: no DOM, browser storage, or real timers. */
export function createHost() {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const listeners = new Map();
  const sockets = [];
  let online = true;
  const scheduler = {
    now: () => now,
    random: () => 0.5,
    queueMicrotask,
    setTimeout(callback, delay) {
      const id = ++sequence;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    setInterval(callback, delay) {
      const id = ++sequence;
      timers.set(id, { callback, due: now + delay, interval: delay });
      return id;
    },
    clearInterval: (id) => timers.delete(id),
  };
  const emit = (type) => {
    for (const listener of [...(listeners.get(type) ?? [])]) listener();
  };
  const platform = {
    isOnline: () => online,
    isVisible: () => true,
    getToken: () => "secret",
    createWebSocket(url) {
      const socket = {
        url,
        readyState: 1,
        sent: [],
        closed: false,
        send(value) {
          this.sent.push(JSON.parse(value));
        },
        close() {
          this.closed = true;
        },
      };
      sockets.push(socket);
      return socket;
    },
    connected: () => emit("bsm:socket-connected"),
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener: (type, listener) =>
      listeners.get(type)?.delete(listener),
  };
  return {
    platform,
    scheduler,
    sockets,
    timers,
    emit,
    listenerCount: () =>
      [...listeners.values()].reduce((count, set) => count + set.size, 0),
    setOnline(value) {
      online = value;
      emit(value ? "online" : "offline");
    },
    async advance(delay) {
      const until = now + delay;
      while (true) {
        const next = [...timers]
          .filter(([, timer]) => timer.due <= until)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.due;
        if (timer.interval) timer.due += timer.interval;
        else timers.delete(id);
        await timer.callback();
        await flush();
      }
      now = until;
      await flush();
    },
  };
}

export async function flush() {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}
