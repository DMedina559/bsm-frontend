import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const version = "7.26.0";
const checksum =
  "1760050094997b9cc790cc1350be095f15da8c08a996b184d3eadc4ccda5e35e";
const directory = new URL("./", import.meta.url);
const cache = new URL(".cache/", directory);
await mkdir(cache, { recursive: true });
const jar =
  process.env.OPENAPI_GENERATOR_JAR ??
  fileURLToPath(new URL(`openapi-generator-${version}.jar`, cache));
let bytes;
try {
  bytes = await readFile(jar);
} catch (error) {
  if (error.code !== "ENOENT" || process.env.OPENAPI_GENERATOR_JAR) throw error;
  const response = await fetch(
    `https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/${version}/openapi-generator-cli-${version}.jar`,
  );
  if (!response.ok)
    throw new Error(`Generator download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (createHash("sha256").update(bytes).digest("hex") !== checksum)
  throw new Error("OpenAPI Generator checksum mismatch");
if (!process.env.OPENAPI_GENERATOR_JAR) await writeFile(jar, bytes);
await rm(new URL("generated/", directory), { recursive: true, force: true });
const result = spawnSync(
  "java",
  [
    "-jar",
    jar,
    "generate",
    "-c",
    fileURLToPath(new URL("config.json", directory)),
    "-i",
    fileURLToPath(
      new URL(
        "../../packages/api-client/src/generated/openapi.json",
        directory,
      ),
    ),
    "-o",
    fileURLToPath(new URL("generated/", directory)),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
