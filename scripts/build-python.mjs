import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(process.env.PYTHON || "python", ["-m", "build"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
});
if (result.error)
  throw new Error(
    "Python's build package is required. Install it with python -m pip install build.",
    { cause: result.error },
  );
process.exitCode = result.status ?? 1;
