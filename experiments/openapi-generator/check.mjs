import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
const directory = new URL("./", import.meta.url);
await rm(new URL("build/", directory), { recursive: true, force: true });
for (const args of [
  [
    fileURLToPath(new URL("../../node_modules/typescript/bin/tsc", directory)),
    "-p",
    fileURLToPath(new URL("tsconfig.json", directory)),
  ],
  ["--test", fileURLToPath(new URL("client.test.mjs", directory))],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
