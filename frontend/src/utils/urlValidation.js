/**
 * Validates a URL to ensure it is safe to be used in an iframe or anchor href.
 * It permits absolute URLs with http: or https: protocols.
 * It also permits relative paths starting with /, ./, or ../ (excluding protocol-relative //)
 *
 * @param {string} url - The URL to validate.
 * @returns {boolean} True if the URL is deemed safe, false otherwise.
 */
export const isSafeUrl = (url) => {
  if (!url || typeof url !== "string") return false;

  // Trim whitespace which might obscure protocol schemes
  const trimmedUrl = url.trim();

  // Allow safe relative paths
  // ^\/[^/]   -> Starts with / but not //
  // ^\.\/     -> Starts with ./
  // ^\.\.\/   -> Starts with ../
  if (/^(\/[^/]|\.\/|\.\.\/)/.test(trimmedUrl)) {
    return true;
  }

  // Allow simple root path /
  if (trimmedUrl === "/") {
    return true;
  }

  // Check if it's an absolute URL with a safe protocol
  try {
    const parsedUrl = new URL(trimmedUrl);
    // Explicitly allow only http and https to block javascript:, data:, vbscript:, etc.
    return ["http:", "https:"].includes(parsedUrl.protocol);
  } catch {
    // If it fails to parse and isn't a simple relative path, deny it.
    return false;
  }
};
