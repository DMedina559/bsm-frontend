import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildOperationRegistry } from "../src/operationRegistry.js";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const { format, resolveConfig } = require("prettier");
const { default: openapiTS, astToString } = require("openapi-typescript");
const source = new URL("../src/generated/openapi.json", import.meta.url);
const schema = JSON.parse(await fs.readFile(source, "utf8"));
const operations = buildOperationRegistry(schema);
const contents =
  schema.components.schemas.SnapshotCreatePayload.properties.components;
const componentArray =
  contents.anyOf?.find((item) => item.type === "array") ?? contents;
const componentNames = componentArray.items?.enum;
if (
  !Array.isArray(componentNames) ||
  !componentArray["x-bsm-choice-labels"] ||
  !componentArray["x-bsm-default-components"]
)
  throw new Error("Backend backup content schema is missing component choices");
const backupContents = {
  components: componentNames.map((id) => ({
    id,
    label: componentArray["x-bsm-choice-labels"][id] ?? id,
  })),
  defaults: componentArray["x-bsm-default-components"],
};
const files = {
  "metadata.json": JSON.stringify({
    backupContents,
    schemaHash: createHash("sha256")
      .update(JSON.stringify(schema))
      .digest("hex"),
    openapiVersion: schema.openapi,
    title: schema.info?.title,
    source:
      "DMedina559/bedrock-server-manager: bedrock_server_manager.web.contract",
    operations: Object.keys(operations).sort(),
  }),
  "contract.d.ts": astToString(
    await openapiTS(schema, { defaultNonNullable: false }),
  ),
  "operations.json": `${JSON.stringify(operations, null, 2)}\n`,
};
const formatting = await resolveConfig(fileURLToPath(source));
for (const [name, raw] of Object.entries(files)) {
  const target = new URL(`../src/generated/${name}`, import.meta.url);
  const content = await format(raw, {
    ...formatting,
    filepath: fileURLToPath(target),
  });
  if (process.argv.includes("--check")) {
    if ((await fs.readFile(target, "utf8")) !== content)
      throw new Error(`Regenerate ${name}: npm run api:generate`);
  } else await fs.writeFile(target, content);
}
