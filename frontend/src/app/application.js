import { createApplicationRuntime } from "@bedrock-server-manager/runtime";
import { queryClient } from "./queryClient";
import { getConnectionIdentity, resolveWebSocketUrl } from "./connection";
import { browserPlatform } from "./browserPlatform";
import { logger } from "../utils/logger";

/** One owner for each application's runtime, cache and operation adapter. */
export function createFrontendApplication(options) {
  /** @type {import("@bedrock-server-manager/runtime").CallOperation} */
  let callOperation;
  const runtime = createApplicationRuntime({
    ...options,
    callOperation: (...args) => callOperation(...args),
  });
  return {
    ...runtime,
    start({ callOperation: caller, ...owner }) {
      if (typeof caller !== "function")
        throw new Error(
          "An operation caller is required before application startup.",
        );
      callOperation = caller;
      return runtime.start(owner);
    },
  };
}
export const application = createFrontendApplication({
  queryClient,
  getBackendIdentity: getConnectionIdentity,
  resolveWebSocketUrl,
  platform: browserPlatform,
  logger,
});
