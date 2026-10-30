export function validateBackendUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Enter an HTTP or HTTPS URL without credentials, a query, or a fragment.",
    );
  if (window.location.protocol === "https:" && url.protocol === "http:")
    throw new Error(
      "An HTTPS page requires an HTTPS backend to avoid mixed content.",
    );
  return url.href.replace(/\/+$/, "");
}
