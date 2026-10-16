/** Release tags identify products; registry versions never include the prefix. */
export function resolveReleaseTag(product, tag, prerelease = false) {
  if (product === "api-client") {
    const match = /^api-client-v(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(
      tag,
    );
    if (
      !match ||
      match[1]
        .split(".")
        .some((part) => part.length > 1 && part.startsWith("0")) ||
      match[2]
        ?.split(".")
        .some(
          (part) =>
            !part ||
            (/^\d+$/.test(part) && part.length > 1 && part.startsWith("0")),
        )
    )
      throw new Error("Expected a canonical api-client-v<SemVer> release tag.");
    return {
      version: tag.slice("api-client-v".length),
      distTag: match[2] || prerelease ? "next" : "latest",
    };
  }
  if (product === "frontend") {
    const match =
      /^frontend-((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:((?:a|b|rc))(0|[1-9]\d*))?$/.exec(
        tag,
      );
    if (!match)
      throw new Error(
        "Expected frontend-<version>, for example frontend-1.3.0b7 or frontend-1.3.0.",
      );
    const suffix = match[2]
      ? `-${{ a: "alpha", b: "beta", rc: "rc" }[match[2]]}.${match[3]}`
      : "";
    return {
      version: tag.slice("frontend-".length),
      npmVersion: match[1] + suffix,
      distTag: suffix || prerelease ? "next" : "latest",
    };
  }
  throw new Error("Unknown release product");
}
