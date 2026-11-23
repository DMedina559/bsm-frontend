import schema from "../../../packages/api-client/src/generated/openapi.json" with { type: "json" };
import { buildOperationRegistry } from "@bedrock-server-manager/api-client/operationRegistry";
export const accessSchema = schema;
export const accessOperations = buildOperationRegistry(schema);
export function accessUser(role = "admin", values = {}) {
  const permissions = [
    ...new Set(
      Object.values(accessOperations)
        .filter((operation) => operation.access.allowed_roles?.includes(role))
        .flatMap((operation) => [
          ...(operation.access.required_permissions ?? []),
          ...(operation.access.credential_alternatives ?? []).flatMap(
            (item) => item.permissions ?? [],
          ),
        ]),
    ),
  ];
  return { role, permissions, server_access: "all", ...values };
}
