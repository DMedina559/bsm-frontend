import { useAccess } from "./useAccess";
import { useEffect } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useResourceQuery } from "./resourceQueries";
export function useApplicationMetrics(enabled = true) {
  const { can } = useAccess();
  enabled = enabled && can("runtime:metrics");
  const { isConnected, subscribe, unsubscribe } = useWebSocket();
  const query = useResourceQuery("applicationMetrics", undefined, {
    enabled,
    refetchInterval: enabled ? (isConnected ? 30000 : 3000) : false,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!enabled) return;
    if (!isConnected) {
      void refetch();
      return;
    }
    subscribe("application-metrics");
    void refetch();
    return () => unsubscribe("application-metrics");
  }, [enabled, isConnected, subscribe, unsubscribe, refetch]);
  return { ...query, isLive: isConnected };
}
