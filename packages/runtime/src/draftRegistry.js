export function createDraftRegistryModule() {
  const drafts = new Set();
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());
  const draftRegistry = {
    dirty: () => drafts.size > 0,
    clear() {
      drafts.clear();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    register() {
      const key = {};
      drafts.add(key);
      notify();
      return () => {
        drafts.delete(key);
        notify();
      };
    },
  };

  return { draftRegistry };
}
