import { useSyncExternalStore } from "react";
const subscribe = (listener) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};
export const useOnline = () =>
  useSyncExternalStore(subscribe, () => navigator.onLine !== false);
