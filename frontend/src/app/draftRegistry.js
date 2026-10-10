const drafts = new Set();
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());
export const draftRegistry = {
  dirty: () => drafts.size > 0,
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
