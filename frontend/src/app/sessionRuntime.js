/** Session generations invalidate asynchronous work before caches are cleared. */
export function createSessionRuntime() {
  let generation = 0;
  const cleanups = new Set();
  let controller = new AbortController();
  return {
    capture: () => ({ generation, signal: controller.signal }),
    isCurrent: (snapshot) => snapshot.generation === generation,
    onReset(cleanup) {
      cleanups.add(cleanup);
      return () => cleanups.delete(cleanup);
    },
    reset() {
      generation += 1;
      controller.abort();
      controller = new AbortController();
      for (const cleanup of [...cleanups]) {
        try {
          cleanup();
        } catch (error) {
          console.error("Session cleanup failed", error);
        }
      }
      return generation;
    },
  };
}
export const sessionRuntime = createSessionRuntime();
