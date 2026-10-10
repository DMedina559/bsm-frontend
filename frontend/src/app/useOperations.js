import { useSyncExternalStore } from "react";
import { operationCoordinator } from "./operationCoordinator";
const subscribe = (notify) => operationCoordinator.subscribe(notify);
export function useOperations() {
  return useSyncExternalStore(
    subscribe,
    operationCoordinator.list,
    operationCoordinator.list,
  );
}
export function useOperation(id) {
  return (
    useOperations().find((operation) => operation.id === String(id)) ?? null
  );
}
export function useActiveOperations() {
  return useOperations().filter(
    (operation) => !operation.terminal && operation.status !== "unknown",
  );
}
