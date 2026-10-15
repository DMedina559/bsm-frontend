import { logger } from "../utils/logger";
import { sessionRuntime } from "./sessionRuntime";
import { getBackendIdentity } from "./backendIdentity";
import { createStateReconcilerModule } from "@bedrock-server-manager/runtime/stateReconciler";
export const { terminalTaskStatus, createStateReconciler, stateReconciler } =
  createStateReconcilerModule({ logger, sessionRuntime, getBackendIdentity });
