import type { operations } from "./generated/contract";
type Parameters<T> = T extends { parameters: infer P } ? P : never;
type Parameter<T, K extends PropertyKey> = K extends keyof Parameters<T>
  ? Parameters<T>[K]
  : never;
type Content<T> = T extends { content: infer C } ? C[keyof C] : null;
type Body<T> = T extends { requestBody?: infer B }
  ? Content<NonNullable<B>>
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
type Options<T> = UrlOptions<T> &
  (T extends { requestBody: unknown }
    ? { body: Body<T> }
    : { body?: Body<T> }) & { signal?: AbortSignal };
type Args<T> = {} extends T ? [options?: T] : [options: T];
export function callOperation<K extends keyof operations>(
  id: K,
  ...args: Args<Options<operations[K]>>
): Promise<Response<operations[K]>>;
export function resolveOperationUrl<K extends keyof operations>(
  id: K,
  ...args: Args<UrlOptions<operations[K]>>
): string;
