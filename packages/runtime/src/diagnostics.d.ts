import type { Data } from "./contracts.js";
export type DiagnosticStatus = "ok" | "degraded" | "unavailable" | "unknown";
export interface DiagnosticIssue extends Data {
  message: string;
}
export interface DiagnosticSnapshot extends Data {
  instance_id: string;
  snapshot_id: string;
  collected_at: number;
  summary: {
    status: DiagnosticStatus;
    ready: boolean | null;
    findings?: { subsystem: string; issue: DiagnosticIssue }[] | null;
  };
  sections: {
    name: string;
    owner: string;
    status: DiagnosticStatus;
    issues?: DiagnosticIssue[] | null;
    data: Data | null;
  }[];
}
export interface DiagnosticHistory extends Data {
  available: boolean;
  records: (Data & {
    id: string;
    operation: string;
    subsystem: string;
    timestamp: number;
    correlation_id?: string | null;
    outcome: "completed" | "failed" | "cancelled";
  })[];
  next_cursor?: string | null;
}
export interface DiagnosticRuns extends Data {
  available: boolean;
  runs: (Data & { instance_id: string })[];
}
export interface DiagnosticActivity extends Data {
  scope: "application";
  events: (Data & { active: Data[]; recent: Data[] }) | null;
  operations: (Data & { active: Data[]; recent: Data[] }) | null;
  subscriptions: (Data & { items: Data[] }) | null;
  issues?: DiagnosticIssue[];
  truncated?: boolean;
}
export interface DiagnosticTrace extends Data {
  operations?: DiagnosticActivity["operations"];
  operations_available?: boolean;
  events_available: boolean;
  tasks_available: boolean;
  tasks: unknown[];
  history: DiagnosticHistory;
}
/** Validators return the original value and throw for malformed responses. */
export function validateDiagnosticSnapshot(value: unknown): DiagnosticSnapshot;
export function validateDiagnosticHistory(value: unknown): DiagnosticHistory;
export function validateDiagnosticRuns(value: unknown): DiagnosticRuns;
export function validateDiagnosticTrace(value: unknown): DiagnosticTrace;

export function validateDiagnosticActivity(value: unknown): DiagnosticActivity;
