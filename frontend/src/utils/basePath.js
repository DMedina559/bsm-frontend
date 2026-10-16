import { getAppConfig } from "../app/config";
/**
 * @fileoverview Utility for determining dynamic base path
 */

/**
 * Gets the base path for API requests when running behind a dynamic proxy (e.g. Home Assistant Ingress)
 * Reads the backend-provided runtime prefix, falling back to pathname detection
 * for standalone hosting.
 *
 * @returns {string} The base path prefix (e.g. '/api/hassio_ingress/xyz') or empty string
 */
export const getApiProxyBasePath = () => {
  if (getAppConfig().mode === "standalone") return "";
  if (typeof window === "undefined" || !window.location) {
    return "";
  }

  const runtimePrefix =
    document.getElementById("app-asset-base")?.dataset.apiBase;
  if (runtimePrefix !== undefined) return runtimePrefix;

  const path = window.location.pathname;
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    return "";
  }
  const appMatches = [...path.matchAll(/\/app(?=\/|$)/g)];
  const appIndex = appMatches.at(-1)?.index ?? -1;

  if (appIndex > 0) {
    return path
      .substring(0, appIndex)
      .split("/")
      .map((segment) => {
        // Preserve existing escapes while encoding DOM-derived path components.
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return encodeURIComponent(segment);
        }
      })
      .join("/");
  }

  return "";
};

export function getAppBasePath() {
  const config = getAppConfig();
  if (globalThis.BSM_CONFIG?.appBase || config.mode === "standalone")
    return config.appBase;
  return `${getApiProxyBasePath()}/app`;
}

/** Resolve bundled assets on the frontend origin, preserving ingress prefixes. */
export function resolveAppAssetUrl(path) {
  const origin = window.location.origin;
  const target = new URL(
    path,
    `${origin}${getAppBasePath().replace(/\/+$/, "")}/`,
  );
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.origin !== origin ||
    target.username ||
    target.password
  ) {
    throw new Error("Asset URLs must target the frontend origin.");
  }
  return serializeHttpUrl(target, true);
}

/** Serialize validated URLs with a fixed, non-executable scheme or root prefix. */
export function serializeHttpUrl(target, relative = false) {
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  const suffix = `${target.host}${target.pathname}${target.search}${target.hash}`;
  const serialized =
    relative && !target.pathname.startsWith("//")
      ? `/${target.pathname.slice(1)}${target.search}${target.hash}`
      : target.protocol === "https:"
        ? `https://${suffix}`
        : `http://${suffix}`;
  // Percent-encode HTML metacharacters without changing URL delimiters or escapes.
  return serialized.replace(
    /[<>"']/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
