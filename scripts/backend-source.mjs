import { readFileSync, appendFileSync } from "node:fs";
const source = JSON.parse(
  readFileSync(
    new URL("../packages/api-client/backend-source.json", import.meta.url),
    "utf8",
  ),
);
if (
  source.repository !== "DMedina559/bedrock-server-manager" ||
  !/^[a-f0-9]{40}$/.test(source.ref)
)
  throw new Error(
    "The supported backend must identify DMedina559/bedrock-server-manager and an immutable commit.",
  );
const output = `revision=${source.ref}\n`;
if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, output);
else process.stdout.write(output);
