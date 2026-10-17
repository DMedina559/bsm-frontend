/** Standard timers are replaceable for hosts that own scheduling and retries. */
export const defaultScheduler = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle),
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (handle) => clearInterval(handle),
  queueMicrotask: (callback) => queueMicrotask(callback),
  now: () => Date.now(),
  random: () => Math.random(),
};
