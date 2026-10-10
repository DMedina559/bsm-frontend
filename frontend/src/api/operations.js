import operations from "./generated/operations.json";
import { buildOperationRegistry } from "./operationRegistry";
import { request } from "../api";
function operationFor(registry, id) {
  if (!Object.hasOwn(registry, id))
    throw new Error(`Unknown API operation: ${id}`);
  return registry[id];
}
function resolveUrl(registry, id, { path = {}, query = {} } = {}) {
  const operation = operationFor(registry, id);
  for (const [kind, values] of [
    ["path", path],
    ["query", query],
  ]) {
    const declared = operation.parameters.filter(
      (parameter) => parameter.in === kind,
    );
    for (const key of Object.keys(values))
      if (!declared.some((parameter) => parameter.name === key))
        throw new Error(`Unknown ${kind} parameter: ${key}`);
    for (const parameter of declared)
      if (parameter.required && values[parameter.name] == null)
        throw new Error(`Missing ${kind} parameter: ${parameter.name}`);
  }
  let url = operation.path.replace(/\{([^}]+)\}/g, (_, key) => {
    if (path[key] == null) throw new Error(`Missing path parameter: ${key}`);
    return encodeURIComponent(String(path[key]));
  });
  const parameters = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value == null) return;
    const definition = operation.parameters.find(
      (parameter) => parameter.in === "query" && parameter.name === key,
    );
    if (typeof value === "object" && !Array.isArray(value))
      throw new Error(`Unsupported query object: ${key}`);
    if (Array.isArray(value)) {
      if (
        definition?.explode === false ||
        ["spaceDelimited", "pipeDelimited"].includes(definition?.style)
      )
        parameters.set(
          key,
          value.join(
            definition.style === "spaceDelimited"
              ? " "
              : definition.style === "pipeDelimited"
                ? "|"
                : ",",
          ),
        );
      else value.forEach((item) => parameters.append(key, String(item)));
    } else parameters.set(key, String(value));
  });
  if (parameters.size) url += `?${parameters}`;
  return url;
}
function call(registry, id, options = {}) {
  const operation = operationFor(registry, id);
  if (operation.bodyRequired && options.body === undefined)
    throw new Error(`Missing request body: ${id}`);
  if (options.body !== undefined && operation.bodyTypes.length === 0)
    throw new Error(`Operation does not accept a body: ${id}`);
  const headers = { ...options.headers, ...options.header };
  for (const parameter of operation.parameters.filter(
    (item) => item.in === "header" && item.required,
  ))
    if (headers[parameter.name] == null)
      throw new Error(`Missing header parameter: ${parameter.name}`);
  let body = options.body;
  if (
    typeof body === "string" &&
    operation.bodyTypes.includes("application/json")
  ) {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  if (
    body != null &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    operation.bodyTypes.includes("application/x-www-form-urlencoded") &&
    !operation.bodyTypes.includes("application/json")
  ) {
    body = new URLSearchParams(
      Object.entries(body)
        .filter(([, value]) => value != null)
        .map(([key, value]) => [key, String(value)]),
    );
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (body instanceof URLSearchParams)
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  else if (
    body != null &&
    operation.bodyTypes.includes("multipart/form-data") &&
    !(body instanceof FormData)
  ) {
    const form = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      if (value != null)
        for (const item of Array.isArray(value) ? value : [value])
          form.append(key, item instanceof Blob ? item : String(item));
    });
    body = form;
  }
  return request(resolveUrl(registry, id, options), {
    method: operation.method,
    body,
    headers,
    signal: options.signal,
    session: options.session,
    timeout: options.timeout,
    responseType: options.responseType ?? operation.responseType,
  });
}
export function resolveOperationUrl(id, options) {
  return resolveUrl(operations, id, options);
}
export function callOperation(id, options) {
  return call(operations, id, options);
}
/** Explicit discovery can use a backend/plugin OpenAPI schema without changing the pinned client. */
export function createOperationClient(schema) {
  const registry = buildOperationRegistry(schema);
  return Object.freeze({
    resolveOperationUrl: (id, options) => resolveUrl(registry, id, options),
    callOperation: (id, options) => call(registry, id, options),
  });
}
/** Discover an explicit backend/plugin schema using the authenticated transport. */
export async function discoverOperationClient(
  url = "/api/openapi.json",
  options = {},
) {
  const schema = await request(url, {
    method: "GET",
    signal: options.signal,
    session: options.session,
    timeout: options.timeout,
  });
  if (
    typeof schema?.openapi !== "string" ||
    !schema.openapi.startsWith("3.") ||
    !schema.paths ||
    typeof schema.paths !== "object" ||
    Array.isArray(schema.paths)
  )
    throw new Error("Invalid OpenAPI 3 schema");
  return createOperationClient(schema);
}
