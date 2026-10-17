import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "bsm-frontend-smoke-"));
const config = join(directory, "config");
const data = join(directory, "data");
mkdirSync(config);
mkdirSync(data);
const child = spawn(
  process.env.BSM_BACKEND_PYTHON || "python",
  [
    "-m",
    "bedrock_server_manager",
    "--config-dir",
    config,
    "--data-dir",
    data,
    "--db-url",
    `sqlite+aiosqlite:///${join(data, "bsm.db")}`,
    "web",
    "start",
    "--host",
    "127.0.0.1",
    "--port",
    "4180",
  ],
  { stdio: "inherit" },
);
const stop = () => {
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 15_000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("error", (error) => {
  console.error(error);
  rmSync(directory, { recursive: true, force: true });
  process.exit(1);
});
child.on("exit", (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exit(code ?? 0);
});
