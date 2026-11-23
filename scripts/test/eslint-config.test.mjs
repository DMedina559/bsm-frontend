import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint();
const filePath = "frontend/src/LintContract.jsx";
async function rulesFor(source) {
  const [result] = await eslint.lintText(source, { filePath });
  return new Set(result.messages.map((message) => message.ruleId));
}

test("React linting catches missing keys and invalid DOM properties", async () => {
  const rules = await rulesFor(
    'export default function List({ items }) { return <ul clasName="list">{items.map(item => <li>{item.name}</li>)}</ul>; }',
  );
  assert.ok(rules.has("@eslint-react/no-missing-key"));
  assert.ok(rules.has("@eslint-react/dom-no-unknown-property"));
});

test("ESLint tracks undefined JSX components without the old React plugin", async () => {
  const rules = await rulesFor(
    "export default function View() { return <MissingComponent />; }",
  );
  assert.ok(rules.has("no-undef"));
});

test("official Hooks checks remain enabled without duplicate React checks", async () => {
  const rules = await rulesFor(
    'import { useState } from "react"; export default function View({ enabled }) { if (enabled) useState(0); return <div />; }',
  );
  assert.ok(rules.has("react-hooks/rules-of-hooks"));
  assert.ok(!rules.has("@eslint-react/rules-of-hooks"));
});
