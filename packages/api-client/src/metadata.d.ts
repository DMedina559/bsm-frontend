import type { OpenApiSchema } from "./operationRegistry.js";
export const contractMetadata: Readonly<{
  schemaHash: string;
  openapiVersion: string;
  title: string;
  source: string;
  operations: readonly string[];
}>;
export function compareCapabilities(
  schema: OpenApiSchema,
  required?: readonly string[],
): { missing: string[]; backendVersion: string | null };
