import { resolveApiUrl } from "../api/transport";
import { getApiProxyBasePath } from "./basePath";
import { isSafeUrl } from "./urlValidation";

/** Backend-relative plugin resources retain ingress; external URLs stay external. */
export function resolvePluginUrl(value, { navigation = false } = {}) {
  if (navigation && typeof value === "string" && value.startsWith("#")) {
    return window.location.pathname + (window.location.search || "") + value;
  }
  if (!isSafeUrl(value)) return null;
  try {
    if (/^https?:/i.test(value)) {
      const url = new URL(value);
      if (
        !navigation &&
        window.location.protocol === "https:" &&
        url.protocol === "http:"
      )
        return null;
      return url.href;
    }
    const relative = new URL(value, "http://plugin.invalid/");
    const path = relative.pathname + relative.search + relative.hash;
    if (
      navigation &&
      (relative.pathname === "/app" || relative.pathname.startsWith("/app/"))
    ) {
      return getApiProxyBasePath() + path;
    }
    return resolveApiUrl(path);
  } catch {
    return null;
  }
}
