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
      const version = (channels.current.get(channel) || 0) + 1;
      const requestEpoch = epoch.current;
      channels.current.set(channel, version);
      return {
        current: () =>
          keyRef.current === resourceKey &&
          epoch.current === requestEpoch &&
          channels.current.get(channel) === version,
      };
    },
    [resourceKey],
  );
}
