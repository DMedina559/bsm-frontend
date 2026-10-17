import { useCallback, useMemo, useSyncExternalStore } from "react";
import { hashKey, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { getPreferenceIdentity } from "./backendIdentity";
import { queryKeys } from "./queryKeys";
/** Observe one accepted fleet entry without changing the query's request owner. */
export function useServerSnapshot(name) {
  const client = useQueryClient();
  const { user, sessionGeneration } = useAuth();
  const identity = getPreferenceIdentity(user);
  const key = useMemo(
    () => [
      ...queryKeys.servers(),
      { identity, generation: sessionGeneration ?? 0 },
    ],
    [identity, sessionGeneration],
  );
  const keyHash = hashKey(key);
  const subscribe = useCallback(
    (listener) =>
      client.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === keyHash) listener();
      }),
    [client, keyHash],
  );
  const read = useCallback(
    () =>
      client.getQueryData(key)?.servers?.find((server) => server.name === name),
    [client, key, name],
  );
  return useSyncExternalStore(subscribe, read);
}
