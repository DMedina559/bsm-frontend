import type { components } from "./generated/contract.js";
export type BackupComponent = NonNullable<
  components["schemas"]["SnapshotCreatePayload"]["components"]
>[number];
import type { OpenApiSchema } from "./operationRegistry.js";
export const contractMetadata: Readonly<{
  backupContents: Readonly<{
    components: readonly Readonly<{ id: BackupComponent; label: string }>[];
    defaults: readonly BackupComponent[];
  }>;
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
