import type { operations } from "./generated/contract";
type Parameters<T> = T extends { parameters: infer P } ? P : never;
type Parameter<T, K extends PropertyKey> = K extends keyof Parameters<T>
  ? Parameters<T>[K]
  : never;
type Content<T> = T extends { content: infer C } ? C[keyof C] : null;
type RequestContent<T> = T extends { content: infer C } ? C : never;
type Body<T> = T extends { requestBody?: infer B }
  ? RequestContent<NonNullable<B>> extends infer C
    ? {
        [M in keyof C]: M extends "multipart/form-data"
          ? C[M] | FormData
          : M extends "application/x-www-form-urlencoded"
            ? C[M] | URLSearchParams
            : C[M];
      }[keyof C]
    : never
  : never;
type Response<T> = T extends { responses: infer R }
  ? {
      [S in keyof R]: `${S & (string | number)}` extends `2${string}`
        ? Content<R[S]>
        : never;
    }[keyof R]
  : never;
type Field<K extends string, V> = [NonNullable<V>] extends [never]
  ? { [P in K]?: never }
  : undefined extends V
    ? { [P in K]?: V }
    : { [P in K]: V };
type UrlOptions<T> = Field<"path", Parameter<T, "path">> &
  Field<"query", Parameter<T, "query">>;
export type SessionSnapshot = {
  generation: number;
  signal: AbortSignal;
  backend?: string;
};
type Options<T> = UrlOptions<T> &
  Field<"header", Parameter<T, "header">> &
  (T extends { requestBody: unknown }
    ? { body: Body<T> }
    : { body?: Body<T> }) & {
    signal?: AbortSignal;
    session?: SessionSnapshot;
    timeout?: number;
    headers?: Record<string, string>;
  };
type Args<T> = {} extends T ? [options?: T] : [options: T];
export function callOperation<
  K extends keyof operations,
  R extends "json" | "blob" = "json",
>(
  id: K,
  ...args: Args<Options<operations[K]> & { responseType?: R }>
): Promise<R extends "blob" ? Blob | null : Response<operations[K]>>;
export function resolveOperationUrl<K extends keyof operations>(
  id: K,
  ...args: Args<UrlOptions<operations[K]>>
): string;

export function createOperationClient(schema: {
  paths?: Record<string, unknown>;
  components?: Record<string, unknown>;
}): {
  resolveOperationUrl(
    id: string,
    options?: {
      path?: Record<string, string | number>;
      query?: Record<string, unknown>;
    },
  ): string;
  callOperation(
    id: string,
    options?: {
      path?: Record<string, string | number>;
      query?: Record<string, unknown>;
      header?: Record<string, string>;
      body?: unknown;
      signal?: AbortSignal;
      session?: SessionSnapshot;
      timeout?: number;
      responseType?: "json" | "blob";
    },
  ): Promise<unknown>;
};
export function discoverOperationClient(
  url?: string,
  options?: {
    signal?: AbortSignal;
    session?: SessionSnapshot;
    timeout?: number;
  },
): Promise<ReturnType<typeof createOperationClient>>;
