import React, { useEffect, useState } from "react";
import { callOperation } from "../api/operations";
import { getBackendIdentity } from "../app/backendIdentity";
import { useAuth } from "../contexts/AuthContext";

/** Fetch private server images through the same credential boundary as their list. */
export default function ResourceIcon({
  serverName,
  packType,
  uuid,
  name,
  world = false,
  className,
  fallback,
}) {
  const { user, sessionGeneration } = useAuth() ?? {};
  const backend = getBackendIdentity();
  const owner = user?.id;
  const key = JSON.stringify([
    backend,
    owner,
    sessionGeneration,
    serverName,
    packType,
    uuid,
    world,
  ]);
  const [source, setSource] = useState(null);
  useEffect(() => {
    if (owner == null) return;
    const controller = new AbortController();
    let url;
    const request = world
      ? callOperation("get_world_icon", {
          path: { server_name: serverName },
          responseType: "blob",
          signal: controller.signal,
        })
      : callOperation("get_server_addon_icon", {
          path: { server_name: serverName },
          query: { pack_type: packType, uuid },
          responseType: "blob",
          signal: controller.signal,
        });
    void request
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setSource({ key, url });
      })
      .catch(() => {
        /* The server remains usable when its optional icon is unavailable. */
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, owner, serverName, packType, uuid, world]);
  const url = source?.key === key ? source.url : undefined;
  return (
    <img
      key={url || fallback}
      className={className}
      src={url || fallback}
      hidden={!url && !fallback}
      alt={name ? `${name} icon` : ""}
      style={
        world
          ? undefined
          : {
              width: "48px",
              height: "48px",
              objectFit: "cover",
              borderRadius: "4px",
              flexShrink: 0,
            }
      }
      onError={(event) => {
        if (fallback && event.currentTarget.getAttribute("src") !== fallback)
          event.currentTarget.src = fallback;
        else event.currentTarget.hidden = true;
      }}
    />
  );
}
