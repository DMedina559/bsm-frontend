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

import {
  getToken,
  resolveApiUrl,
  getAuthenticationMode,
} from "../app/connection";
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
const transport = createHttpTransport({
  resolveApiUrl,
  logger,
  captureSession: () => ({
    ...sessionRuntime.capture(),
    authenticationMode: getAuthenticationMode(),
  }),
  getToken,
  prepareRequest: ({ session, signal }) => {
    const stateTicket = stateReconciler.capture(signal);
    const authenticationMode =
      session.authenticationMode ?? getAuthenticationMode();
    return () => {
      if (
        !sessionRuntime.isCurrent(session) ||
        authenticationMode !== getAuthenticationMode() ||
        !stateReconciler.current(stateTicket) ||
        (session.backend && session.backend !== getBackendIdentity())
      )
        throw new DOMException("Session changed", "AbortError");
      signal.throwIfAborted();
    };
  },
});
let lastPolicyRevision = null;
const csrfTokens = new Map();
export function request(url, options = {}) {
  if (
    navigator.onLine === false &&
    !["GET", "HEAD", "OPTIONS"].includes(
      (options.method ?? "GET").toUpperCase(),
    )
  )
    return Promise.reject(
      new Error("Reconnect before making changes. Requests are not queued."),
    );
  const backend = getBackendIdentity();
  const generation = sessionRuntime.capture().generation;
  let revision;
  let recentRequired = false;
  let mfaRequired = false;
  let enrollmentRequired = false;
  const headers = new Headers(options.headers);
  headers.set(
    "X-BSM-Auth-Mode",
    getAuthenticationMode() === "bearer" ? "bearer" : "cookie",
  );
  const csrf = csrfTokens.get(backend);
  if (csrf && getAuthenticationMode() !== "bearer")
    headers.set("X-CSRF-Token", csrf);

  return transport
    .request(url, {
      ...options,
      headers: Object.fromEntries(headers),
      onResponseMetadata: (metadata) => {
        revision = metadata.headers["x-bsm-policy-revision"];
        recentRequired = metadata.headers["x-bsm-recent-auth"] === "required";
        mfaRequired = metadata.headers["x-bsm-mfa"] === "required";
        enrollmentRequired =
          metadata.headers["x-bsm-mfa-enrollment"] === "required";
        if (
          metadata.headers["x-bsm-csrf-token"] &&
          getBackendIdentity() === backend &&
          sessionRuntime.capture().generation === generation
        )
          csrfTokens.set(backend, metadata.headers["x-bsm-csrf-token"]);
        options.onResponseMetadata?.(metadata);
      },
      credentials:
        getAuthenticationMode() === "bearer" ? "omit" : "same-origin",
    })
    .then((data) => {
      if (
        revision &&
        sessionRuntime.capture().generation === generation &&
        getBackendIdentity() === backend
      ) {
        const previous = lastPolicyRevision;
        lastPolicyRevision = { backend, generation, revision };
        if (
          previous?.backend === backend &&
          previous.generation === generation &&
          previous.revision !== revision
        )
          setTimeout(() => {
            if (
              sessionRuntime.capture().generation === generation &&
              getBackendIdentity() === backend
            )
              window.dispatchEvent(
                new CustomEvent("bsm:access-changed", { detail: { backend } }),
              );
          }, 0);
      }
      return data;
    })
    .catch((error) => {
      if (error.status === 401 && mfaRequired) error.mfaRequired = true;
      if (
        error.status === 403 &&
        enrollmentRequired &&
        getBackendIdentity() === backend &&
        sessionRuntime.capture().generation === generation
      )
        window.dispatchEvent(
          new CustomEvent("bsm:credentials-changed", { detail: { backend } }),
        );
      if (
        error.status === 403 &&
        recentRequired &&
        sessionRuntime.capture().generation === generation &&
        getBackendIdentity() === backend
      )
        window.dispatchEvent(
          new CustomEvent("bsm:security-verification-required", {
            detail: { backend },
          }),
        );
      throw error;
    });
}
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
