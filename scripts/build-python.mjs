import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pythonDirectory = fileURLToPath(new URL("../python/", import.meta.url));
const webAssets = fileURLToPath(new URL("../frontend/dist/", import.meta.url));
const packagedAssets = fileURLToPath(
  new URL("../python/src/bsm_frontend/static/", import.meta.url),
);
if (!existsSync(new URL("../frontend/dist/index.html", import.meta.url)))
  throw new Error("Build the web interface before packaging Python assets.");
rmSync(packagedAssets, { recursive: true, force: true });
cpSync(webAssets, packagedAssets, { recursive: true });
rmSync(new URL("../python/dist/", import.meta.url), {
  recursive: true,
  force: true,
});
const result = spawnSync(process.env.PYTHON || "python", ["-m", "build"], {
  cwd: pythonDirectory,
  stdio: "inherit",
});
if (result.error)
  throw new Error(
    "Python's build package is required. Install it with python -m pip install build.",
    { cause: result.error },
  );
process.exitCode = result.status ?? 1;
