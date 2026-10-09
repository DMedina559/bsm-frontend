import operations from "./generated/operations.json";
import { request } from "../api";
/** Runtime companion for the generated operationId contract. */
export function resolveOperationUrl(id, { path = {}, query = {} } = {}) {
  const operation = operations[id];
  if (!operation) throw new Error(`Unknown API operation: ${id}`);
  let url = operation.path.replace(/\{([^}]+)\}/g, (_, key) => {
    if (path[key] == null) throw new Error(`Missing path parameter: ${key}`);
    return encodeURIComponent(String(path[key]));
  });
  const parameters = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null) {
      if (Array.isArray(value))
        value.forEach((item) => parameters.append(key, String(item)));
      else parameters.set(key, String(value));
    }
  });
  if (parameters.size) url += `?${parameters}`;
  return url;
}

export function callOperation(id, options = {}) {
  return request(resolveOperationUrl(id, options), {
    method: operations[id].method,
    body: options.body,
    signal: options.signal,
  });
}
