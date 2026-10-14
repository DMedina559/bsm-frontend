import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "../../api/transport";
import { useAuth } from "../../contexts/AuthContext";
import { useWebSocket } from "../../contexts/WebSocketContext";
import { getPreferenceIdentity } from "../../app/backendIdentity";
import { queryKeys } from "../../app/queryKeys";
import {
  captureStateRequest,
  reconcileResourceSnapshot,
} from "../../app/applicationState";

export function usePluginPage({ url, parameters, server, inline }) {
  const { user, sessionGeneration } = useAuth();
  const identity = getPreferenceIdentity(user);
  const endpoint = useMemo(() => {
    if (!url) return null;
    let result;
    try {
      result = new URL(url, window.location.origin);
    } catch {
      return null;
    }
    new URLSearchParams(parameters).forEach((value, key) => {
      if (key !== "url" && !result.searchParams.has(key))
        result.searchParams.append(key, value);
    });
    if (server && !result.searchParams.has("server"))
      result.searchParams.set("server", server);
    return result.pathname + result.search;
  }, [url, parameters, server]);
  const key = [
    ...queryKeys.pluginPage(endpoint, server),
    { identity, generation: sessionGeneration ?? 0 },
  ];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(endpoint) && !inline && identity !== null,
    queryFn: async ({ signal }) => {
      const ticket = captureStateRequest(signal);
      const data = await request(endpoint, { signal });
      if (!data || typeof data !== "object")
        throw new Error("Invalid page definition.");
      return reconcileResourceSnapshot(
        "pluginPage",
        endpoint,
        key,
        data,
        ticket,
      );
    },
    refetchInterval: (query) => {
      const interval = Number(query.state.data?.refreshInterval);
      return Number.isFinite(interval) && interval > 0
        ? Math.max(1000, interval < 1000 ? interval * 1000 : interval)
        : false;
    },
  });
  return {
    ...query,
    schema: inline ?? query.data,
    canRefresh: Boolean(endpoint) && !inline,
    loading: !inline && Boolean(endpoint) && query.isPending,
    error: inline
      ? null
      : !endpoint
        ? url
          ? "Invalid schema URL"
          : "No schema URL provided"
        : query.error?.message,
    scope: JSON.stringify(key),
  };
}

export function usePluginSubscriptions(schema, server, scope) {
  const { isConnected, subscribe, unsubscribe, addMessageListener } =
    useWebSocket();
  const [snapshots, setSnapshots] = useState({ scope, messages: {} });
  const topicsKey = JSON.stringify(
    (schema?.websocketSubscriptions ?? [])
      .filter((topic) => typeof topic === "string")
      .map((topic) => topic.replace("{server}", server || ""))
      .filter(Boolean),
  );
  useEffect(() => {
    if (!isConnected) return;
    const topics = JSON.parse(topicsKey);
    topics.forEach(subscribe);
    return () => topics.forEach(unsubscribe);
  }, [isConnected, topicsKey, subscribe, unsubscribe]);
  useEffect(() => {
    const topics = new Set(JSON.parse(topicsKey));
    setSnapshots({ scope, messages: {} });
    return addMessageListener((message) => {
      if (topics.has(message.topic))
        setSnapshots((previous) => ({
          scope,
          messages: {
            ...(previous.scope === scope ? previous.messages : {}),
            [message.topic]: message,
          },
        }));
    });
  }, [scope, topicsKey, addMessageListener]);
  return snapshots.scope === scope ? snapshots.messages : {};
}
