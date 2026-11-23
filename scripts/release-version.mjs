export const releaseProducts = ["api-client", "runtime", "storage", "frontend"];

/** One canonical release identity for the coordinated npm and Python distributions. */
export function resolveRelease(tag, prerelease = false) {
  const match =
    /^((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-(alpha|beta|rc)\.(0|[1-9]\d*)|(a|b|rc)(0|[1-9]\d*))?$/.exec(
      tag,
    );
  if (!match)
    throw new Error(
      "Expected an unprefixed version such as 1.4.0, 1.4.0b3, or 1.4.0-beta.3.",
    );
  const stage = match[2] ?? { a: "alpha", b: "beta", rc: "rc" }[match[4]];
  const number = match[3] ?? match[5];
  const npmVersion = match[1] + (stage ? `-${stage}.${number}` : "");
  const pythonVersion =
    match[1] +
    (stage ? `${{ alpha: "a", beta: "b", rc: "rc" }[stage]}${number}` : "");
  return {
    npmVersion,
    pythonVersion,
    distTag: stage || prerelease ? "next" : "latest",
    packages: releaseProducts.map((product) => ({
      product,
      workspace: `@bedrock-server-manager/${product}`,
      npmVersion,
      artifactName:
        product === "frontend" ? "frontend-distributions" : "shared-packages",
    })),
  };
}
