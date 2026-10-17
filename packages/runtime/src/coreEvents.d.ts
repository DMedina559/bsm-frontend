import type { QueryKey } from "./contracts.js";
export const mutationResources: Readonly<
  Record<string, (name?: string) => QueryKey[]>
>;
export const lifecycleEvents: readonly string[];
export const coreEventTopics: string[];
