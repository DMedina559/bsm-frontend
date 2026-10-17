import { createHttpTransport } from "@bedrock-server-manager/api-client/transport";
export { ApiError } from "@bedrock-server-manager/api-client/transport";
import { ApiError } from "@bedrock-server-manager/api-client/transport";
import { stateReconciler } from "../app/stateReconciler";
import { getBackendIdentity } from "../app/backendIdentity";
/**
 * @fileoverview Core API client for making HTTP requests.
 * Handles fetch logic, headers, authentication, and response parsing.
 */
import { sessionRuntime } from "../app/sessionRuntime";

import { logger } from "../utils/logger";

import { getToken, resolveApiUrl } from "../app/connection";
export {
  getApiBaseUrl,
  setApiBaseUrl,
  validateBackendUrl,
  resolveApiUrl,
  resolveWebSocketUrl,
} from "../app/connection";

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
  getToken,
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
