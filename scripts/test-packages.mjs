import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const files = readdirSync(new URL("../packages/", import.meta.url), {
  recursive: true,
})
  .filter((file) => /[/\\]test[/\\].*\.test\.js$/.test(file))
  .filter(
    (file) => !process.argv[2] || file.split(/[/\\]/)[0] === process.argv[2],
  )
  .map((file) => `packages/${file}`);
if (!files.length) throw new Error("No package tests found");
const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
