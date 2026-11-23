export interface RequestOptions extends Omit<RequestInit, "body" | "headers"> {
  body?: unknown;
  headers?: Record<string, string>;
  /** Milliseconds; zero disables the deadline while preserving cancellation. */
  timeout?: number;
  onResponseMetadata?: (response: {
    status: number;
    headers: Record<string, string>;
  }) => void;
  onUploadProgress?: (loaded: number, total: number | null) => void;
  onDownloadProgress?: (loaded: number, total: number | null) => void;
  /** Binary response destination; streamed with backpressure and aborted on failure. */
  downloadTo?: WritableStream<Uint8Array>;
  responseType?: "json" | "blob";
  session?: { signal: AbortSignal; generation?: number; backend?: string };
}
export class ApiError extends Error {
  constructor(message: string, status: number, data: unknown);
  status: number;
  data: unknown;
  code: string | null;
  details: unknown;
  operationResult: unknown;
  committed: boolean;
  category: string;
}
export function createHttpTransport(options: {
  baseUrl?: string;
  resolveApiUrl?: (path: string) => string;
  getToken?: () =>
    string | null | undefined | Promise<string | null | undefined>;
  fetch?: typeof fetch;
  captureSession?: () => NonNullable<RequestOptions["session"]>;
  prepareRequest?: (context: {
    session: NonNullable<RequestOptions["session"]>;
    signal: AbortSignal;
  }) => () => void;
  onResponse?: (context: {
    url: string;
    body: unknown;
    method: string;
    data: unknown;
  }) => void;
  logger?: {
    debug(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };
}): {
  request(url: string, options?: RequestOptions): Promise<unknown>;
  getBlob(url: string, options?: RequestOptions): Promise<Blob | null>;
};
