import { contractMetadata } from "@bedrock-server-manager/api-client/metadata";

// Generated from the backend Pydantic selection schema, shared with plugins.
export const backupComponents = Object.fromEntries(
  contractMetadata.backupContents.components.map(({ id, label }) => [
    id,
    label,
  ]),
);
export const defaultBackupComponents = [
  ...contractMetadata.backupContents.defaults,
];
