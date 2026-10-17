import { watch } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run with npm run dev:packages");
let timer;
const build = () => {
  try {
    execFileSync(process.execPath, [npm, "run", "build:packages"], {
      cwd: root,
      stdio: "inherit",
    });
  } catch {
    console.error("Package build failed; watching for the next edit.");
  }
};
for (const name of ["api-client", "runtime", "storage"]) {
  watch(
    new URL(`../packages/${name}/src/`, import.meta.url),
    { recursive: true },
    () => {
      clearTimeout(timer);
      timer = setTimeout(build, 100);
    },
  );
}
console.log(
  "Watching shared package source. Run npm run dev:web in another terminal.",
);
