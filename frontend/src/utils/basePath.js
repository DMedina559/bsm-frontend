/**
 * @fileoverview Utility for determining dynamic base path
 */

/**
 * Gets the base path for API requests when running behind a dynamic proxy (e.g. Home Assistant Ingress)
 * It calculates the path prefix by removing /app/ and everything after it from the current path.
 *
 * @returns {string} The base path prefix (e.g. '/api/hassio_ingress/xyz') or empty string
 */
export const getApiProxyBasePath = () => {
  if (typeof window === "undefined" || !window.location) {
    return "";
  }

  const path = window.location.pathname;
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    return "";
  }
  const appIndex = path.search(/\/app(?:\/|$)/);

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

/** Resolve bundled assets on the frontend origin, preserving ingress prefixes. */
export function resolveAppAssetUrl(path) {
  const origin = window.location.origin;
  const target = new URL(path, origin);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.origin !== origin ||
    target.username ||
    target.password
  ) {
    throw new Error("Asset URLs must target the frontend origin.");
  }
  return `${target.pathname}${target.search}${target.hash}`;
}
