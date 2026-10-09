import { sessionRuntime } from "../app/sessionRuntime";
import { useCallback, useEffect, useRef } from "react";
/** Separate request channels prevent stale results from overwriting a newer page/server. */
export function useRequestTracker(resourceKey = "") {
  const epoch = useRef(0);
  const channels = useRef(new Map());
  const keyRef = useRef(resourceKey);
  useEffect(() => {
    const currentChannels = channels.current;
    keyRef.current = resourceKey;
    epoch.current += 1;
    currentChannels.clear();
    return () => {
      epoch.current += 1;
      currentChannels.clear();
    };
  }, [resourceKey]);
  return useCallback(
    (channel) => {
      const session = sessionRuntime.capture();
      const version = (channels.current.get(channel) || 0) + 1;
      const requestEpoch = epoch.current;
      channels.current.set(channel, version);
      return {
        current: () =>
          sessionRuntime.isCurrent(session) &&
          keyRef.current === resourceKey &&
          epoch.current === requestEpoch &&
          channels.current.get(channel) === version,
      };
    },
    [resourceKey],
  );
}
