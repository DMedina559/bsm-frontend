/** Find generated-client calls by their declaration, including aliases and methods. */
export function isGeneratedApiCall(node, checker, source) {
  const text = node.expression.getText(source);
  if (["callOperation", "resolveOperationUrl", "writeOperation"].includes(text))
    return true;
  return checker
    .getTypeAtLocation(node.expression)
    .getCallSignatures()
    .some((signature) => {
      const path =
        signature.declaration?.getSourceFile().fileName.replaceAll("\\", "/") ??
        "";
      return /(?:packages\/api-client\/(?:src|dist)|frontend\/src\/api)\/operations\.d\.ts$/.test(
        path,
      );
    });
}
