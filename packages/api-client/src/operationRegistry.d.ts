export interface OpenApiSchema {
  paths?: Record<string, unknown>;
  components?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface OperationDefinition {
  method: string;
  path: string;
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
    style?: string;
    explode?: boolean;
  }>;
  bodyRequired: boolean;
  bodyTypes: string[];
  responseType: "json" | "blob";
}
export function buildOperationRegistry(
  schema: OpenApiSchema,
): Record<string, OperationDefinition>;
