import { parse, generate } from "css-tree";

const fields = [
  ["--bsm-page", "--bg-color"],
  [
    "--bsm-surface",
    "--container-background-color",
    "--server-card-background-color",
  ],
  ["--bsm-accent", "--primary-color"],
];

function specificity(selector) {
  const result = [0, 0, 0];
  selector.children?.forEach((node) => {
    if (node.type === "IdSelector") result[0]++;
    else if (["ClassSelector", "AttributeSelector"].includes(node.type))
      result[1]++;
    else if (node.type === "TypeSelector" && node.name !== "*") result[2]++;
    else if (node.type === "PseudoElementSelector") result[2]++;
    else if (node.type === "PseudoClassSelector" && node.name !== "where") {
      if (["is", "not", "has"].includes(node.name)) {
        const list = node.children?.first;
        const choices = list?.children?.toArray().map(specificity) ?? [];
        const maximum = choices.sort(compare).at(-1) ?? [0, 0, 0];
        maximum.forEach((value, index) => {
          result[index] += value;
        });
      } else result[1]++;
    }
  });
  return result;
}
function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function resolveVariables(value, tokens, seen = new Set()) {
  if (seen.size > 20) return null;
  const start = value.indexOf("var(");
  if (start < 0) return value;
  let depth = 1,
    end = start + 4;
  for (; end < value.length && depth; end++) {
    if (value[end] === "(") depth++;
    else if (value[end] === ")") depth--;
  }
  if (depth) return null;
  const args = value.slice(start + 4, end - 1);
  const comma = args.indexOf(",");
  const name = (comma < 0 ? args : args.slice(0, comma)).trim();
  if (seen.has(name)) return null;
  const replacement =
    tokens.get(name)?.value ??
    (comma < 0 ? null : args.slice(comma + 1).trim());
  if (replacement == null) return null;
  const resolved = resolveVariables(
    replacement,
    tokens,
    new Set([...seen, name]),
  );
  if (resolved == null) return null;
  return resolveVariables(
    value.slice(0, start) + resolved + value.slice(end),
    tokens,
    seen,
  );
}

/** Read theme colors as data. Never install CSS, imports, images, or font rules. */
export function extractCustomThemePreview(
  css,
  theme,
  mode = "dark",
  mediaMatches = (query) => window.matchMedia?.(query).matches ?? false,
) {
  if (typeof css !== "string" || css.length > 1024 * 1024) return null;
  try {
    const ast = parse(css, { parseCustomProperty: false });
    const doc = document.implementation.createHTMLDocument("");
    doc.documentElement.dataset.theme = theme;
    doc.documentElement.dataset.mode = mode;
    const targets = [doc.documentElement, doc.body];
    const declarations = targets.map(() => new Map());
    const visit = (nodes) =>
      nodes.forEach((node) => {
        if (node.type === "Atrule" && node.block) {
          const condition = node.prelude ? generate(node.prelude) : "";
          if (node.name === "media") {
            const query = condition.replace(
              /\(prefers-color-scheme:\s*(dark|light)\)/g,
              (_, value) =>
                value === mode ? "(min-width:0px)" : "(max-width:-1px)",
            );
            if (!mediaMatches(query)) return;
          } else if (node.name === "supports") {
            if (!globalThis.CSS?.supports?.(condition)) return;
          } else if (node.name !== "layer") return;
          visit(node.block.children);
        }
        if (node.type !== "Rule" || node.prelude?.type !== "SelectorList")
          return;
        node.prelude.children.forEach((selector) => {
          const text = generate(selector);
          const weight = specificity(selector);
          targets.forEach((target, index) => {
            let matches;
            try {
              matches = target.matches(text);
            } catch {
              return;
            }
            if (!matches) return;
            node.block.children.forEach((declaration) => {
              if (
                declaration.type !== "Declaration" ||
                !declaration.property.startsWith("--")
              )
                return;
              const priority = [Number(declaration.important), ...weight];
              const previous = declarations[index].get(declaration.property);
              if (!previous || compare(priority, previous.priority) >= 0)
                declarations[index].set(declaration.property, {
                  value: generate(declaration.value).trim(),
                  priority,
                });
            });
          });
        });
      });
    visit(ast.children);
    const tokens = new Map([...declarations[0], ...declarations[1]]);
    const probe = doc.createElement("span").style;
    const colors = fields.map((names) => {
      for (const name of names) {
        const raw = tokens.get(name)?.value;
        const color = raw && resolveVariables(raw, tokens);
        if (
          !color ||
          /^(inherit|initial|unset|revert|revert-layer|currentcolor)$/i.test(
            color,
          )
        )
          continue;
        probe.color = "";
        probe.color = color;
        if (probe.color) return color;
      }
      return null;
    });
    if (colors.every((color) => color == null)) return null;
    const fallback =
      mode === "light"
        ? ["#f3f6f4", "#ffffff", "#087b57"]
        : ["#030b0d", "#082223", "#00ed95"];
    return { colors: colors.map((color, index) => color ?? fallback[index]) };
  } catch {
    return null;
  }
}
