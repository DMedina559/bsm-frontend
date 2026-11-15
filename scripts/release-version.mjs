export const releaseProducts = ["api-client", "runtime", "storage", "frontend"];

/** One canonical release identity for the coordinated npm and Python distributions. */
export function resolveRelease(tag, prerelease = false) {
  const match =
    /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-(alpha|beta|rc)\.(0|[1-9]\d*))?$/.exec(
      tag,
    );
  if (!match)
    throw new Error(
      "Expected v<major>.<minor>.<patch> or v<version>-alpha|beta|rc.<number>.",
    );
  const npmVersion = tag.slice(1);
  const pythonVersion =
    match[1] +
    (match[2]
      ? `${{ alpha: "a", beta: "b", rc: "rc" }[match[2]]}${match[3]}`
      : "");
  return {
    npmVersion,
    pythonVersion,
    distTag: match[2] || prerelease ? "next" : "latest",
    packages: releaseProducts.map((product) => ({
      product,
      workspace: `@bedrock-server-manager/${product}`,
      npmVersion,
      artifactName:
        product === "frontend" ? "frontend-distributions" : "shared-packages",
    })),
  };
}
