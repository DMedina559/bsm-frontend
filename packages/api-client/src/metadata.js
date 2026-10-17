import { buildOperationRegistry } from "./operationRegistry.js";
import metadata from "./generated/metadata.json" with { type: "json" };
export const contractMetadata = Object.freeze({
  ...metadata,
  operations: Object.freeze(metadata.operations),
});
/** Compare advertised capabilities without guessing compatibility from version strings. */
export function compareCapabilities(
  schema,
  required = contractMetadata.operations,
) {
  const supported = new Set(Object.keys(buildOperationRegistry(schema ?? {})));
  return {
    missing: required.filter((id) => !supported.has(id)),
    backendVersion:
      typeof schema?.info?.version === "string" ? schema.info.version : null,
  };
}
