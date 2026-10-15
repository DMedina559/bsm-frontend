import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve("src");
const destination = resolve("dist");
if (!existsSync(source))
  throw new Error("Run the package build from a library workspace");
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, {
  recursive: true,
  filter: (file) => !file.endsWith("openapi.json"),
});
