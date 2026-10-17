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
    if (
      path
        .split(/[?#]/)[0]
        .split("/")
        .some((segment) => [".", ".."].includes(decodeURIComponent(segment)))
    )
      throw new TypeError("API paths cannot contain traversal segments");
    const url = new URL(
      path.startsWith("/") && !path.startsWith("//") ? prefix + path : path,
      prefix + "/",
    );
    if (
      url.origin !== base.origin ||
      !(
        base.pathname === "/" ||
        url.pathname === base.pathname.replace(/\/+$/, "") ||
        url.pathname.startsWith(base.pathname.replace(/\/+$/, "") + "/")
      ) ||
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol)
    )
      throw new TypeError("API requests must target the configured backend");
    return url.href;
  };
}
