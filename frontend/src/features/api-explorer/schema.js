import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildOperationRegistry } from "@bedrock-server-manager/api-client/operationRegistry";

export function resolve(schema, value) {
  const seen = new Set();
  while (value?.$ref) {
    const ref = value.$ref;
    if (!ref.startsWith("#/") || seen.has(ref))
      throw new Error(`Unsupported reference: ${ref}`);
    seen.add(ref);
    value = ref
      .slice(2)
      .split("/")
      .reduce(
        (node, key) => node?.[key.replace(/~1/g, "/").replace(/~0/g, "~")],
        schema,
      );
    if (!value) throw new Error(`Missing reference: ${ref}`);
  }
  return value ?? {};
}

export function inspectSchema(schema) {
  if (
    !/^3\./.test(schema?.openapi) ||
    !schema.paths ||
    typeof schema.paths !== "object" ||
    Array.isArray(schema.paths)
  )
    throw new Error("Load an OpenAPI 3 JSON document with paths.");
  const registry = buildOperationRegistry(schema);
  return Object.entries(registry).map(([id, entry]) => {
    // Imported documents always execute against the configured BSM connection.
    if (/[\\?#]/.test(entry.path) || entry.path.startsWith("//"))
      throw new Error(`Unsupported API path: ${entry.path}`);
    const item = resolve(schema, schema.paths[entry.path]);
    const definition = resolve(schema, item[entry.method.toLowerCase()]);
    const parameters = new Map();
    for (const raw of [
      ...(item.parameters ?? []),
      ...(definition.parameters ?? []),
    ]) {
      const parameter = resolve(schema, raw);
      parameters.set(`${parameter.in}:${parameter.name}`, parameter);
    }
    return {
      ...entry,
      id,
      definition,
      parameters: [...parameters.values()],
      request: resolve(schema, definition.requestBody),
    };
  });
}

export function inputValue(schema, spec, text) {
  let type = resolve(schema, spec);
  if (type.anyOf || type.oneOf)
    type = resolve(
      schema,
      (type.anyOf ?? type.oneOf).find((s) => s.type !== "null"),
    );
  if (type.type === "string" || !type.type) return text;
  return JSON.parse(text);
}

const validators = new WeakMap();
export function validateValue(schema, spec, value) {
  let cache = validators.get(schema);
  if (!cache) {
    cache = new Map();
    validators.set(schema, cache);
  }
  let validate = cache.get(spec);
  if (!validate) {
    const ajv = new Ajv({
      strict: false,
      allErrors: true,
      validateFormats: true,
    });
    addFormats(ajv);
    validate = ajv.compile({
      ...spec,
      components: schema.components,
      $defs: schema.$defs,
    });
    cache.set(spec, validate);
  }
  if (!validate(value))
    throw new Error(
      validate.errors
        .map((error) => `${error.instancePath || "/"} ${error.message}`)
        .join("; "),
    );
}

export function prepareCall(schema, operation, values, bodyText) {
  const options = { path: {}, query: {}, header: {} };
  for (const parameter of operation.parameters) {
    const key = `${parameter.in}:${parameter.name}`;
    const text = values[key] ?? "";
    if (text === "" && !parameter.required) continue;
    if (text === "") throw new Error(`Missing ${parameter.name}`);
    if (!Object.hasOwn(options, parameter.in))
      throw new Error(`Unsupported parameter location: ${parameter.in}`);
    const value = inputValue(schema, parameter.schema, text);
    validateValue(schema, parameter.schema ?? {}, value);
    options[parameter.in][parameter.name] = value;
  }
  const media = operation.request.content ?? {};
  if (bodyText.trim()) {
    if (!media["application/json"])
      throw new Error("This operation does not accept a JSON body.");
    options.body = JSON.parse(bodyText);
    validateValue(schema, media["application/json"].schema ?? {}, options.body);
  } else if (operation.request.required)
    throw new Error("A request body is required.");
  return options;
}

export function exampleValue(schema, raw, seen = new Set()) {
  if (raw?.$ref && seen.has(raw.$ref)) return null;
  const next = new Set(seen);
  if (raw?.$ref) next.add(raw.$ref);
  const spec = resolve(schema, raw);
  if (spec.example !== undefined) return spec.example;
  if (spec.default !== undefined) return spec.default;
  if (spec.const !== undefined) return spec.const;
  if (spec.enum) return spec.enum[0];
  if (spec.anyOf || spec.oneOf)
    return exampleValue(
      schema,
      (spec.anyOf ?? spec.oneOf).find((item) => item.type !== "null") ?? {},
      next,
    );
  if (spec.type === "object" || spec.properties)
    return Object.fromEntries(
      Object.entries(spec.properties ?? {})
        .filter(
          ([key, value]) => spec.required?.includes(key) && !value.readOnly,
        )
        .map(([key, value]) => [key, exampleValue(schema, value, next)]),
    );
  if (spec.type === "array") return [];
  if (spec.type === "boolean") return false;
  if (spec.type === "integer" || spec.type === "number")
    return spec.minimum ?? 0;
  return "";
}

export const pretty = (value) => JSON.stringify(value, null, 2) ?? "";
export function schemaType(schema, raw) {
  if (raw?.$ref)
    return raw.$ref.split("/").at(-1).replace(/~1/g, "/").replace(/~0/g, "~");
  const spec = resolve(schema, raw);
  if (spec.anyOf || spec.oneOf)
    return (spec.anyOf ?? spec.oneOf)
      .map((s) => schemaType(schema, s))
      .join(" | ");
  if (spec.type === "array") return `${schemaType(schema, spec.items)}[]`;
  return spec.type ?? (spec.properties ? "object" : "JSON");
}
export function objectFields(schema, raw) {
  const spec = resolve(schema, raw);
  if (spec.allOf)
    return spec.allOf.reduce((acc, part) => {
      const item = objectFields(schema, part);
      return {
        ...acc,
        ...item,
        properties: { ...acc.properties, ...item.properties },
        required: [...(acc.required ?? []), ...(item.required ?? [])],
      };
    }, spec);
  return spec;
}
