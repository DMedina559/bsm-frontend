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
  const appIndex = path.indexOf("/app");

  if (appIndex > 0) {
    return path.substring(0, appIndex);
  }

  return "";
};
