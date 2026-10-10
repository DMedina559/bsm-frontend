import { buildOperationRegistry } from "../src/api/operationRegistry.js";
import fs from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";
const source = new URL("../src/api/generated/openapi.json", import.meta.url);
const schema = JSON.parse(await fs.readFile(source, "utf8"));
const operations = buildOperationRegistry(schema);
const files = {
  "contract.d.ts": astToString(await openapiTS(schema, { defaultNonNullable: false })),
  "operations.json": `${JSON.stringify(operations, null, 2)}\n`,
};
for (const [name, content] of Object.entries(files)) {
  const target = new URL(`../src/api/generated/${name}`, import.meta.url);
  if (process.argv.includes("--check")) {
    if ((await fs.readFile(target, "utf8")) !== content)
      throw new Error(`Regenerate ${name}: npm run api:generate`);
  } else await fs.writeFile(target, content);
}
