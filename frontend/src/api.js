/**
 * @fileoverview Core API client for making HTTP requests.
 * Handles fetch logic, headers, authentication, and response parsing.
 */

import { logger } from "./utils/logger";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

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
  if (!url) {
    localStorage.removeItem("api_base_url");
  } else {
    // Ensure no trailing slash
    localStorage.setItem("api_base_url", url.replace(/\/$/, ""));
  }
}

/**
 * Sends an HTTP request to the API.
 *
 * @param {string} url - The URL to request. relative URLs are supported.
 * @param {object} [options={}] - Fetch options (method, body, headers, etc.).
 * @returns {Promise<any>} Resolves with the response data (JSON or null for 204).
 * @throws {ApiError} If the response status is not 2xx.
 */
export async function request(url, options = {}) {
  const { method = "GET", body, headers = {}, ...restOptions } = options;

  const defaultHeaders = {
    Accept: "application/json",
  };

  const config = {
    method: method.toUpperCase(),
    headers: { ...defaultHeaders, ...headers },
    credentials: "include",
    ...restOptions,
  };

  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  if (body) {
    if (
      !config.headers["Content-Type"] &&
      !(body instanceof FormData) &&
      typeof body === "object"
    ) {
      config.headers["Content-Type"] = "application/json";
      config.body = JSON.stringify(body);
    } else {
      config.body = body;
    }
  }

  try {
    // Prepend base URL if the URL is relative (starts with /)
    const baseUrl = getApiBaseUrl();
    const finalUrl = url.startsWith("/") && baseUrl ? `${baseUrl}${url}` : url;

    logger.debug(`[API Request] ${config.method} ${finalUrl}`);

    const response = await fetch(finalUrl, config);

    if (response.status === 204) {
      logger.debug(
        `[API Response] ${response.status} ${finalUrl} (No Content)`,
      );
      return null;
    }

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        // Fallback if JSON parsing fails but header said JSON
        logger.error(`[API Error] Invalid JSON response for ${finalUrl}`);
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
        logger.error(
          `[API Error] Request failed: ${response.status} (Non-JSON response) for ${finalUrl}`,
        );
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
        logger.warn(
          `[API Response] Detected HTML redirect for ${finalUrl}, forcing 401 error`,
        );
        // Force a 401 style error so AuthContext can handle logout
        throw new ApiError("Session expired (Redirected to App)", 401, null);
      }
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      if (typeof data === "object" && data !== null && data.message) {
        errorMessage = data.message;
      } else if (typeof data === "object" && data !== null && data.detail) {
        // FastAPI often returns 'detail'
        errorMessage = data.detail;
      } else if (typeof data === "string" && data.length > 0) {
        errorMessage = data.substring(0, 200);
      }

      logger.error(
        `[API Error] ${response.status} ${finalUrl}: ${errorMessage}`,
      );
      throw new ApiError(errorMessage, response.status, data);
    }

    // Legacy API sometimes returns { status: "error", message: "..." } even with 200 OK
    if (
      data &&
      typeof data === "object" &&
      data.status &&
      data.status === "error"
    ) {
      logger.error(
        `[API Error] Application error in 200 OK for ${finalUrl}: ${data.message}`,
      );
      throw new ApiError(
        data.message || "Application error",
        response.status,
        data,
      );
    }

    logger.debug(`[API Response] ${response.status} ${finalUrl}`);
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network errors
    logger.error(`[API Network Error] ${url}: ${error.message}`);
    throw new ApiError(error.message, 0, null);
  }
}

// ... helpers
export function get(url, options = {}) {
  return request(url, { ...options, method: "GET" });
}

export function post(url, body, options = {}) {
  return request(url, { ...options, method: "POST", body });
}

export function put(url, body, options = {}) {
  return request(url, { ...options, method: "PUT", body });
}

export function del(url, options = {}) {
  return request(url, { ...options, method: "DELETE" });
}
