import type { SessionRuntime } from "./contracts.js";
export type { SessionRuntime, SessionSnapshot } from "./contracts.js";
export interface SessionModule {
  createSessionRuntime(): SessionRuntime;
  sessionRuntime: SessionRuntime;
}
export function createSessionRuntimeModule(): SessionModule;
