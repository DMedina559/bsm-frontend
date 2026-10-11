import { useEffect } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useResourceQuery } from "./resourceQueries";
export function useApplicationMetrics() {
  const { isConnected, subscribe, unsubscribe } = useWebSocket();
  const query = useResourceQuery("applicationMetrics", undefined, {
    refetchInterval: isConnected ? 30000 : 3000,
    retry: false,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!isConnected) return;
    subscribe("application-metrics");
    void refetch();
    return () => unsubscribe("application-metrics");
  }, [isConnected, subscribe, unsubscribe, refetch]);
  return { ...query, isLive: isConnected };
}
