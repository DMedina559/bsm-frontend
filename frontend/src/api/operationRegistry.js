/** Shared schema interpretation used by generation and explicit plugin discovery. */
const METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);
export function buildOperationRegistry(schema) {
  const resolve = (value) => {
    if (!value?.$ref) return value;
    if (!value.$ref.startsWith("#/"))
      throw new Error("External OpenAPI references are unsupported");
    const target = value.$ref
      .slice(2)
      .split("/")
      .reduce(
        (current, key) =>
          current?.[key.replace(/~1/g, "/").replace(/~0/g, "~")],
        schema,
      );
    if (!target) throw new Error(`Unresolved OpenAPI reference: ${value.$ref}`);
    return target;
  };
  const registry = Object.create(null);
  for (const [path, rawItem] of Object.entries(schema.paths ?? {})) {
    const item = resolve(rawItem);
    for (const [method, rawOperation] of Object.entries(item)) {
      if (!METHODS.has(method)) continue;
      const operation = resolve(rawOperation);
      if (!operation.operationId) continue;
      if (Object.hasOwn(registry, operation.operationId))
        throw new Error(`Duplicate operation ID: ${operation.operationId}`);
      if (!path.startsWith("/") || path.startsWith("//"))
        throw new Error(`Invalid API path: ${path}`);
      const parameters = new Map();
      for (const raw of [
        ...(item.parameters ?? []),
        ...(operation.parameters ?? []),
      ]) {
        const parameter = resolve(raw);
        parameters.set(`${parameter.in}:${parameter.name}`, {
          name: parameter.name,
          in: parameter.in,
          required: parameter.required === true,
          style: parameter.style,
          explode: parameter.explode,
        });
      }
      const body = resolve(operation.requestBody);
      const success = Object.entries(operation.responses ?? {})
        .filter(([status]) => /^2\d\d$|^2XX$/.test(status))
        .map(([, response]) => resolve(response));
      const binary = success.some((response) =>
        Object.entries(response.content ?? {}).some(
          ([type, value]) =>
            type === "application/octet-stream" ||
            resolve(value.schema)?.format === "binary",
        ),
      );
      registry[operation.operationId] = {
        method: method.toUpperCase(),
        path,
        parameters: [...parameters.values()],
        bodyRequired: body?.required === true,
        bodyTypes: Object.keys(body?.content ?? {}),
        responseType: binary ? "blob" : "json",
      };
    }
  }
  return registry;
}
