import { vi } from "vitest";

// HTTP fixtures remain separate from the production transport. The operation
// client runs normally, so its method, parameter encoding and body handling are
// exercised by page tests. These spies describe responses for each HTTP verb.
export const get = vi.fn();
export const post = vi.fn();
export const put = vi.fn();
export const del = vi.fn();
export const request = vi.fn();
export const getApiBaseUrl = vi.fn(() => "");
export const resolveApiUrl = vi.fn((url) => url);
export const downloadFile = vi.fn();
export const setApiBaseUrl = vi.fn();
const fixtures = {
  get,
  post,
  put,
  del,
  request,
  getApiBaseUrl,
  resolveApiUrl,
  downloadFile,
  setApiBaseUrl,
};
const transportRoutes = new Set([
  "/api/account",
  "/api/servers",
  "/api/account/theme",
  "/api/settings/set",
  "/auth/token",
  "/auth/reauth",
  "/auth/logout",
]);
export function configureHttpFixtures(values) {
  for (const [key, value] of Object.entries(values)) {
    if (fixtures[key] && typeof value === "function")
      fixtures[key].mockImplementation(value);
  }
}
export function createHttpTransport(actual) {
  return {
    ...actual,
    getApiBaseUrl,
    resolveApiUrl,
    downloadFile,
    setApiBaseUrl,
    request: vi.fn((url, options = {}) => {
      const method = options.method ?? "GET";
      if (
        transportRoutes.has(url.split("?")[0]) ||
        /^\/api\/server\/[^/]+\/settings\/set$/.test(url)
      )
        return Object.keys(options).length
          ? request(url, options)
          : request(url);
      if (method === "GET")
        return Object.keys(options).length ? get(url, options) : get(url);
      if (method === "POST")
        return options.body === undefined ? post(url) : post(url, options.body);
      if (method === "PUT")
        return options.body === undefined ? put(url) : put(url, options.body);
      if (method === "DELETE")
        return options.body === undefined
          ? del(url)
          : del(url, { body: options.body });
      throw new Error(`Unexpected HTTP method: ${method}`);
    }),
  };
}
