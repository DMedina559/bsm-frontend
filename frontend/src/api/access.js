import { request } from "./transport";

/** Access metadata is discovered through the session-aware authenticated transport. */
export function loadAccessSchema({ signal } = {}) {
  return request("/api/openapi.json", { signal });
}
