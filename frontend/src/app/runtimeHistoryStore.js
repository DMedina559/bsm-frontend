import { application } from "./application";
import { createRuntimeHistory } from "./runtimeHistory";
let storage;
try {
  storage = globalThis.localStorage;
} catch {
  /* Memory-only history. */
}
export const runtimeHistory = createRuntimeHistory({
  diagnostics: application.diagnostics,
  storage,
});
