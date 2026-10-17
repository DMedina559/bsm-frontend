import { readFileSync, appendFileSync } from "node:fs";
const source = JSON.parse(
  readFileSync(
    new URL("../packages/api-client/backend-source.json", import.meta.url),
    "utf8",
  ),
);
if (
  !/^[\w.-]+\/[\w.-]+$/.test(source.repository) ||
  !/^[a-f0-9]{40}$/.test(source.ref)
)
  throw new Error(
    "The supported backend must identify a repository and immutable commit.",
  );
const override = process.env.BSM_BACKEND_REF;
const ref = !override || override === "pinned" ? source.ref : override;
if (!/^[\w./-]+$/.test(ref)) throw new Error("Invalid backend ref.");
const output = `repository=${source.repository}\nref=${ref}\n`;
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, output);
else process.stdout.write(output);
