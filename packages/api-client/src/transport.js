import { createUrlResolver } from "./urls.js";
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.code = data?.error?.code ?? null;
    this.details = data?.error?.details ?? null;
    this.operationResult = this.details?.result ?? null;
    this.committed = this.operationResult?.committed === true;
    if (this.committed)
      this.message +=
        " The change was saved, but follow-up work failed. Refresh before trying again.";
    this.category =
      this.code === "operation_incomplete"
        ? "incomplete"
        : status === 503
          ? "unavailable"
          : status === 401
            ? "unauthorized"
            : status === 403
              ? "forbidden"
              : status === 409
                ? "conflict"
                : status === 422
                  ? "validation"
                  : status === 0
                    ? "network"
                    : "server";
  }
}

function abortable(value, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    if (signal.aborted) return aborted();
    signal.addEventListener("abort", aborted, { once: true });
    Promise.resolve(value)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", aborted));
  });
}

/** @param {Parameters<typeof import("./transport.d.ts").createHttpTransport>[0]} dependencies
 * @returns {ReturnType<typeof import("./transport.d.ts").createHttpTransport>} */
export function createHttpTransport({
  baseUrl,
  resolveApiUrl = createUrlResolver(baseUrl),
  getToken = () => null,
  fetch: fetcher = (...args) => globalThis.fetch(...args),
  captureSession = () => ({ signal: new AbortController().signal }),
  prepareRequest = ({ signal }) =>
    () =>
      signal.throwIfAborted(),
  onResponse = () => {},
  logger = { debug() {}, warn() {}, error() {} },
}) {
  /** @param {string} url @param {import("./transport.d.ts").RequestOptions} [options] */
  async function request(url, options = {}) {
    const {
      method = "GET",
      body,
      headers = {},
      timeout = 30000,
      responseType = "json",
      session = captureSession(),
      ...restOptions
    } = options;
    const timeoutSignal = AbortSignal.timeout(timeout);
    const signal = AbortSignal.any([
      session.signal,
      timeoutSignal,
      ...(restOptions.signal ? [restOptions.signal] : []),
    ]);
    const assertCurrent = prepareRequest({ session, signal });

    assertCurrent();
    const defaultHeaders = {
      Accept: responseType === "blob" ? "*/*" : "application/json",
    };

    const normalizedHeaders = new Headers(defaultHeaders);
    new Headers(headers).forEach((value, key) =>
      normalizedHeaders.set(key, value),
    );
    /** @type {RequestInit & { headers: Record<string, string> }} */
    const config = {
      method: method.toUpperCase(),
      headers: {},
      ...restOptions,
      signal,
    };

    const credential = getToken();
    const token =
      credential && typeof credential !== "string"
        ? await abortable(credential, signal)
        : credential;
    assertCurrent();
    if (token) {
      normalizedHeaders.set("Authorization", `Bearer ${token}`);
    }

    if (body !== undefined) {
      const raw =
        body instanceof FormData ||
        body instanceof URLSearchParams ||
        body instanceof Blob ||
        body instanceof ArrayBuffer ||
        ArrayBuffer.isView(body);
      const contentType = normalizedHeaders.get("Content-Type");
      if (
        !raw &&
        typeof body !== "string" &&
        (!contentType || contentType.includes("application/json"))
      ) {
        normalizedHeaders.set(
          "Content-Type",
          contentType || "application/json",
        );
        config.body = JSON.stringify(body);
      } else config.body = /** @type {BodyInit} */ (body);
    }

    config.headers = Object.fromEntries(
      [...normalizedHeaders].map(([key, value]) => [
        {
          authorization: "Authorization",
          "content-type": "Content-Type",
          accept: "Accept",
        }[key] ?? key,
        value,
      ]),
    );
    try {
      const finalUrl = resolveApiUrl(url);

      logger.debug(`[API] Request: ${config.method} ${finalUrl}`, {
        method: config.method,
        url: finalUrl,
        headers: {
          ...Object.fromEntries(
            Object.entries(config.headers).map(([key, value]) => [
              key,
              /authorization|cookie|token|secret|api-key/i.test(key)
                ? "[redacted]"
                : value,
            ]),
          ),
        },
      });

      const response = await fetcher(finalUrl, config);
      assertCurrent();

      if (response.status === 204) {
        logger.debug(`[API] Response (No Content)`, {
          status: response.status,
          url: finalUrl,
        });
        return null;
      }

      const contentType = response.headers.get("content-type");
      let data;

      if (response.ok && responseType === "blob") {
        if (contentType?.includes("text/html"))
          throw new ApiError("Session expired (Redirected to App)", 401, null);
        data = await response.blob();
      } else if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (err) {
          signal.throwIfAborted();
          if (err.name === "AbortError" || err.name === "TimeoutError")
            throw err;
          // Fallback if JSON parsing fails but header said JSON
          logger.error(`[API] Error: Invalid JSON response`, {
            url: finalUrl,
            status: response.status,
            error: err,
          });
          throw new ApiError(
            "Invalid JSON response from server",
            response.status,
            null,
          );
        }
      } else {
        // If not JSON, treat as text (could be HTML error page, plain text, etc.)
        const text = await response.text();

        // If we expected JSON (based on Accept header) but got HTML (e.g. 404 page, 500 error page, or Login page redirect)
        // we should probably treat it as an error unless the caller explicitly handles it.
        if (!response.ok) {
          logger.error(`[API] Error: Non-JSON response`, {
            url: finalUrl,
            status: response.status,
            responseType: "text",
          });
          throw new ApiError(
            `Request failed with status ${response.status} (Non-JSON response)`,
            response.status,
            text,
          );
        }

        // If success (200) but HTML (e.g. redirected to login page without 401), this is tricky.
        // Legacy behavior might just return the text.
        // But usually our API should return JSON.
        data = text;

        // Check if it looks like the login page (common issue when session expires and backend redirects instead of 401)
        if (
          typeof text === "string" &&
          text.toLowerCase().includes("<!doctype html>")
        ) {
          logger.warn(`[API] Detected HTML redirect, forcing 401 error`, {
            url: finalUrl,
          });
          // Force a 401 style error so AuthContext can handle logout
          throw new ApiError("Session expired (Redirected to App)", 401, null);
        }
      }

      assertCurrent();
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        if (typeof data?.error?.message === "string") {
          errorMessage = data.error.message;
        } else if (typeof data === "object" && data !== null && data.message) {
          errorMessage = data.message;
        } else if (typeof data === "object" && data !== null && data.detail) {
          // FastAPI often returns 'detail'
          errorMessage = Array.isArray(data.detail)
            ? data.detail
                .map(
                  (issue) =>
                    `${issue.loc?.join(".") || "Request"}: ${issue.msg || "Invalid value"}`,
                )
                .join("; ")
            : String(data.detail);
        } else if (typeof data === "string" && data.length > 0) {
          errorMessage = data.substring(0, 200);
        }

        logger.error(`[API] Error: Request failed`, {
          url: finalUrl,
          status: response.status,
          message: errorMessage,
          responseType: typeof data,
        });
        throw new ApiError(errorMessage, response.status, data);
      }

      // Legacy API sometimes returns { status: "error", message: "..." } even with 200 OK
      if (
        data &&
        typeof data === "object" &&
        data.status &&
        data.status === "error"
      ) {
        logger.error(`[API] Error: Application error in 200 OK`, {
          url: finalUrl,
          message: data.message,
          responseType: typeof data,
        });
        throw new ApiError(
          data.message || "Application error",
          response.status,
          data,
        );
      }

      logger.debug(`[API] Response`, {
        url: finalUrl,
        status: response.status,
        responseType: typeof data,
      });
      onResponse({ url, body, method: config.method, data });
      return data;
    } catch (error) {
      if (error.name === "AbortError" || error.name === "TimeoutError")
        throw error;
      if (error instanceof ApiError) {
        throw error;
      }
      // Network errors
      logger.error(`[API] Network Error`, {
        url: url,
        message: error.message,
        error: error,
      });
      throw new ApiError(error.message, 0, null);
    }
  }

  return {
    request,
    getBlob: (url, options = {}) =>
      request(url, { ...options, method: "GET", responseType: "blob" }),
  };
}
