import { spawn, execFileSync } from "node:child_process";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run with npm run dev");
execFileSync(process.execPath, [npm, "run", "build:packages"], {
  stdio: "inherit",
});
const children = ["dev:packages", "dev:web"].map((script) =>
  spawn(process.execPath, [npm, "run", script], { stdio: "inherit" }),
);
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
};
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
children.forEach((child) =>
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  }),
);
