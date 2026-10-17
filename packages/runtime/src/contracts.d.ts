/** Host contracts shared by the runtime's module factories. */
export type Cleanup = () => void;
export type QueryKey = readonly unknown[];
export type Data = Record<string, unknown>;
export interface Logger {
  debug(message: string, details?: unknown): void;
  warn(message: string, details?: unknown): void;
  error(message: string, details?: unknown): void;
}
export interface SessionSnapshot {
  generation: number;
  signal: AbortSignal;
}
export interface SessionRuntime {
  capture(): SessionSnapshot;
  isCurrent(snapshot: SessionSnapshot): boolean;
  onReset(cleanup: Cleanup): Cleanup;
  reset(): number;
}
export interface StateTicket {
  readonly clock: number;
  readonly signal?: AbortSignal;
  readonly session: SessionSnapshot;
  readonly backend: string;
}
export interface ReconcileOptions<T = unknown> {
  source?: "http" | "event" | "local";
  ticket?: StateTicket;
  revision?: number | null;
  epoch?: string | null;
  eventId?: string;
  transition?: (previous: T, next: T, newerRevision: boolean) => boolean;
}
export interface StateRecord<T = unknown> {
  key: QueryKey;
  value: T;
  source: "http" | "event" | "local";
  clock: number;
  requestClock: number;
  revision?: number;
  epoch: string | null;
  payloadReleased?: boolean;
}
export type ReconcileResult<T> =
  | ({ accepted: true } & StateRecord<T>)
  | ({ accepted: false } & Partial<StateRecord<T>>);
export interface TaskSnapshot extends Data {
  id?: string;
  task_id?: string;
  status: string;
  revision?: number;
  epoch?: string;
  progress?: unknown;
  result?: unknown;
  error?: { code?: string; message?: string; details?: unknown } | null;
}
export interface EpochChange {
  epoch: string;
  previous: string;
  ticket?: StateTicket;
}
export interface StateReconciler {
  capture(signal?: AbortSignal): StateTicket;
  current(ticket?: StateTicket | null): boolean;
  onEpochChange(listener: (change: EpochChange) => void): Cleanup;
  accept<T>(
    key: QueryKey,
    value: T,
    options?: ReconcileOptions<T>,
  ): ReconcileResult<T>;
  read<T = unknown>(key: QueryKey): StateRecord<T> | undefined;
  entries<T = unknown>(prefix: string): StateRecord<T>[];
  releaseTaskPayload(id: string | number): void;
  forget(key: QueryKey): boolean;
  clear(): void;
  task(
    data: TaskSnapshot,
    options?: ReconcileOptions<TaskSnapshot>,
  ): ReconcileResult<TaskSnapshot>;
}
export interface QueryFilters {
  queryKey?: QueryKey;
  predicate?: (query: {
    queryKey: QueryKey;
    state: { data: unknown };
  }) => boolean;
  refetchType?: "none" | "active" | "inactive" | "all";
}
/** A structural cache interface; no dependency on a particular cache library. */
export interface QueryClient {
  clear?(): void;
  cancelQueries(filters: QueryFilters): Promise<void>;
  invalidateQueries(filters: QueryFilters): Promise<void>;
  removeQueries(filters: QueryFilters): void;
  resetQueries(): Promise<void>;
  setQueriesData<T>(
    filters: QueryFilters,
    updater: T | ((current: T | undefined) => T | undefined),
  ): unknown;
  fetchQuery<T>(options: {
    queryKey: QueryKey;
    queryFn: (context: { signal: AbortSignal }) => Promise<T>;
  }): Promise<T>;
}
export type LifecycleEvent =
  "online" | "offline" | "visibilitychange" | "bsm:socket-connected";
/** Only the socket members actually used by the runtime are required. */
type SocketCallback<Event> = { handle(event: Event): void }["handle"];
export interface RuntimeSocket {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: SocketCallback<unknown> | null;
  onmessage: SocketCallback<{ data: string }> | null;
  onerror: SocketCallback<unknown> | null;
  onclose: SocketCallback<unknown> | null;
}
export interface RuntimePlatform {
  isOnline(): boolean;
  isVisible(): boolean;
  getToken(): string | null | undefined;
  createWebSocket(url: string): RuntimeSocket;
  connected(): void;
  addEventListener(type: LifecycleEvent, listener: () => void): void;
  removeEventListener(type: LifecycleEvent, listener: () => void): void;
}
/** Scheduler handles are opaque and owned by the host. */
export interface RuntimeScheduler<Handle = unknown> {
  setTimeout(callback: () => void, delay: number): Handle;
  clearTimeout(handle: Handle | null | undefined): void;
  setInterval(callback: () => void, delay: number): Handle;
  clearInterval(handle: Handle | null | undefined): void;
  queueMicrotask(callback: () => void): void;
  now(): number;
  random(): number;
}
export interface Operation extends Data {
  availability?: "available" | "unavailable";
  id: string;
  kind?: string;
  serverName?: string;
  status: string;
  terminal: boolean;
  createdAt: number;
  updatedAt: number;
  acknowledged?: boolean;
  progress?: unknown;
  task?: TaskSnapshot;
}
export interface OperationInput extends Data {
  id: string | number;
  kind?: string;
  serverName?: string;
  status?: string;
}
export interface OperationCoordinator {
  subscribe(listener: (operations: Operation[]) => void): Cleanup;
  get(id: string | number): Operation | null;
  list(): Operation[];
  register(input: OperationInput): Operation;
  markUnavailable(id: string | number, error: unknown): void;
  reconcileTask(
    message: SocketMessage,
    options?: ReconcileOptions<TaskSnapshot> & { synchronize?: boolean },
  ): boolean;
  acknowledge(id: string | number): boolean;
  remove(id: string | number): boolean;
  clear(): void;
}
export interface SocketMessage extends Data {
  type: string;
  topic?: string;
  data?: unknown;
  revision?: number;
  epoch?: string;
  event_id?: string;
}
export interface ConnectionState {
  isConnected: boolean;
  isFallback: boolean;
  connectionState:
    | "disconnected"
    | "connecting"
    | "reconnecting"
    | "authenticating"
    | "connected"
    | "failed";
}
export interface WebSocketManager {
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  sendMessage(message: unknown): void;
  reconnect(): void;
  start(identity: string | null): Cleanup;
}
export interface WebSocketModule {
  createWebSocketManager(callbacks: {
    onMessage(message: SocketMessage, ticket: StateTicket): void;
    onState(state: ConnectionState): void;
  }): WebSocketManager;
}
export interface MetricsSample extends Data {
  timestamp: number;
  epoch: string;
  revision: number;
  asyncio_task_count: number;
  loop_lag_ms: number;
  servers: ({ server_name: string } & Data)[];
}
export interface MetricsSnapshot extends Data {
  latest: MetricsSample;
  history: MetricsSample[];
  interval_seconds?: number;
  history_limit?: number;
}
export interface MetricsModule {
  metricsFields: string[];
  validMetricsSample(sample: unknown): sample is MetricsSample;
  reconcileMetricsSnapshot(
    data: MetricsSnapshot,
    options?: ReconcileOptions<MetricsSnapshot>,
  ): ReconcileResult<MetricsSnapshot>;
  reconcileMetricsEvent(
    sample: MetricsSample,
    options?: ReconcileOptions<MetricsSnapshot>,
  ): ReconcileResult<MetricsSnapshot>;
}
export interface ApplicationStateModule {
  captureStateRequest(signal?: AbortSignal): StateTicket;
  reconcileMonitorSnapshot<T extends Data>(
    data: T,
    name: string,
    ticket: StateTicket,
  ): T | undefined;
  reconcileServerSnapshot<
    T extends Data & { servers: ({ name: string } & Data)[] },
  >(
    data: T,
    ticket: StateTicket,
  ): T;
  reconcileResourceSnapshot<T>(
    resource: string,
    target: string | null,
    key: QueryKey,
    data: T,
    ticket: StateTicket,
  ): T | undefined;
  synchronizeServerEvent(message: SocketMessage, ticket?: StateTicket): boolean;
  reconcileSocketMessage(message: SocketMessage, ticket?: StateTicket): boolean;
  reconcileTaskResponse(data: TaskSnapshot, ticket: StateTicket): boolean;
}
export type CallOperation = (
  operationId: string,
  options: {
    path?: Record<string, string>;
    signal: AbortSignal;
  },
) => Promise<unknown>;
export interface RecoveryModule {
  startOperationRecovery(
    identity?: string | null,
    generation?: number,
  ): Cleanup;
}
