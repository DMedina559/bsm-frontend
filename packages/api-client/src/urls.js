/** Resolve backend paths without browser location or ingress metadata. */
export function createUrlResolver(baseUrl) {
  const base = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new TypeError(
      "Expected an HTTP or HTTPS backend URL without credentials, query, or fragment",
    );
  const prefix = base.href.replace(/\/+$/, "");
  return (path) => {
    if (typeof path !== "string" || !path.trim())
      throw new TypeError("Missing API URL");
    const url = new URL(
      path.startsWith("/") && !path.startsWith("//") ? prefix + path : path,
      prefix + "/",
    );
    if (
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol)
    )
      throw new TypeError("API requests must target the configured backend");
    return url.href;
  };
}
