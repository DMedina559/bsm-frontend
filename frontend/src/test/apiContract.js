import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import contract from "../api/generated/openapi.json";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat("binary", true);
const validators = new Map();
const routes = Object.entries(contract.paths).map(([path, methods]) => ({
  path,
  methods,
  segments: path.split("/"),
}));
function routeFor(url) {
  const segments = new URL(url, "http://bsm.test").pathname.split("/");
  return routes.find(
    (item) =>
      item.segments.length === segments.length &&
      item.segments.every(
        (part, index) => part.startsWith("{") || part === segments[index],
      ),
  );
}
export const hasApiRoute = (url) => Boolean(routeFor(url));
function operationFor(method, url) {
  const route = routeFor(url);
  const operation = route?.methods[method.toLowerCase()];
  if (!operation)
    throw new Error(`Undeclared backend operation: ${method} ${url}`);
  return operation;
}
function assertSchema(schema, value, label) {
  if (!schema) return;
  const key = JSON.stringify(schema);
  if (!validators.has(key))
    validators.set(
      key,
      ajv.compile({ ...schema, components: contract.components }),
    );
  const validate = validators.get(key);
  if (!validate(value))
    throw new Error(`${label}: ${ajv.errorsText(validate.errors)}`);
}
export function assertApiRequest(method, url, body) {
  const operation = operationFor(method, url);
  const request = operation.requestBody;
  if (request?.required && body === undefined)
    throw new Error(`Missing body for ${operation.operationId}`);
  if (!request && body !== undefined)
    throw new Error(`Unexpected body for ${operation.operationId}`);
  assertSchema(
    request?.content?.["application/json"]?.schema,
    body,
    `Request ${operation.operationId}`,
  );
}
export function assertApiResponse(method, url, data, status = 200) {
  const operation = operationFor(method, url);
  const response = operation.responses[String(status)];
  if (!response)
    throw new Error(
      `Undeclared response status ${status} for ${operation.operationId}`,
    );
  assertSchema(
    response.content?.["application/json"]?.schema,
    data,
    `Response ${operation.operationId}`,
  );
}
