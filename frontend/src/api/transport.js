import { createHttpTransport } from "@bedrock-server-manager/api-client/transport";
export { ApiError } from "@bedrock-server-manager/api-client/transport";
import { ApiError } from "@bedrock-server-manager/api-client/transport";
import { stateReconciler } from "../app/stateReconciler";
import { getBackendIdentity } from "../app/backendIdentity";
import { operationCoordinator } from "../app/operationCoordinator";
/**
 * @fileoverview Core API client for making HTTP requests.
 * Handles fetch logic, headers, authentication, and response parsing.
 */
import { sessionRuntime } from "../app/sessionRuntime";
import { getApiProxyBasePath, serializeHttpUrl } from "../utils/basePath";

import { logger } from "../utils/logger";

/**
 * Gets the configured API base URL from localStorage.
 * @returns {string} The base URL (e.g. "http://localhost:11325") or empty string.
 */
export function getApiBaseUrl() {
  return localStorage.getItem("api_base_url") || "";
}

/**
 * Sets the API base URL.
 * @param {string} url - The base URL to set.
 */
export function setApiBaseUrl(url) {
  if (!url) localStorage.removeItem("api_base_url");
  else localStorage.setItem("api_base_url", validateBackendUrl(url));
}

/** Validate an absolute backend URL before storing or sending credentials. */
export function validateBackendUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Enter an HTTP or HTTPS URL without credentials, a query, or a fragment.",
    );
  if (window.location.protocol === "https:" && url.protocol === "http:")
    throw new Error(
      "An HTTPS page requires an HTTPS backend to avoid mixed content.",
    );
  return url.href.replace(/\/+$/, "");
}

/** Resolve sockets using the same backend validation and prefix as HTTP. */
export function resolveWebSocketUrl() {
  const url = new URL(resolveApiUrl("/ws"), window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

/** Resolve API/download URLs against the configured backend, preserving ingress prefixes. */
export function resolveApiUrl(url) {
  if (typeof url !== "string" || !url.trim())
    throw new ApiError("Missing API URL", 0, null);
  const configured = getApiBaseUrl();
  const base = configured
    ? validateBackendUrl(configured)
    : getApiProxyBasePath();
  const finalUrl =
    url.startsWith("/") && !url.startsWith("//") && base
      ? `${base}${url}`
      : url;
  const backend = new URL(
    base || window.location.origin,
    window.location.origin,
  );
  const target = new URL(finalUrl, window.location.origin);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.origin !== backend.origin ||
    target.username ||
    target.password
  ) {
    throw new ApiError(
      "API requests must target the configured backend.",
      0,
      null,
    );
  }
  return serializeHttpUrl(
    target,
    finalUrl.startsWith("/") && !finalUrl.startsWith("//"),
  );
}

/**
 * Sends an HTTP request to the API.
 *
 * @param {string} url - The URL to request. relative URLs are supported.
 * @param {object} [options={}] - Fetch options (method, body, headers, etc.).
 * @returns {Promise<any>} Resolves with the response data (JSON or null for 204).
 * @throws {ApiError} If the response status is not 2xx.
 */
export const { request } = createHttpTransport({
  resolveApiUrl,
  logger,
  captureSession: () => sessionRuntime.capture(),
  getToken: () =>
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("access_token"),
  prepareRequest: ({ session, signal }) => {
    const stateTicket = stateReconciler.capture(signal);
    return () => {
      if (
        !sessionRuntime.isCurrent(session) ||
        !stateReconciler.current(stateTicket) ||
        (session.backend && session.backend !== getBackendIdentity())
      )
        throw new DOMException("Session changed", "AbortError");
      signal.throwIfAborted();
    };
  },
  onResponse: ({ url, body, method, data }) => {
    if (method !== "GET" && data?.task_id) {
      const server = url.match(/\/api\/server\/([^/]+)/)?.[1];
      operationCoordinator.register({
        id: data.task_id,
        kind: url.split("/").filter(Boolean).slice(-2).join(":"),
        serverName:
          body?.server_name ?? (server ? decodeURIComponent(server) : null),
        status: "pending",
      });
    }
  },
});
/** Binary responses share authentication, cancellation, timeouts and API errors. */
export function getBlob(url, options = {}) {
  return request(url, { ...options, method: "GET", responseType: "blob" });
}
export async function downloadFile(url, filename = "download", options = {}) {
  const blob = await getBlob(url, options);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
