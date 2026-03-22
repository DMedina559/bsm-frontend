import { describe, it, expect } from "vitest";
import { isSafeUrl } from "./urlValidation";

describe("isSafeUrl", () => {
  it("should allow secure https protocols", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("https://example.com/page")).toBe(true);
  });

  it("should allow http protocols", () => {
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("http://127.0.0.1")).toBe(true);
  });

  it("should allow safe relative paths", () => {
    expect(isSafeUrl("/api/data")).toBe(true);
    expect(isSafeUrl("./local/path.html")).toBe(true);
    expect(isSafeUrl("../parent/dir")).toBe(true);
    expect(isSafeUrl("/")).toBe(true);
  });

  it("should block unsafe protocols like javascript:", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("javascript:confirm(document.domain)")).toBe(false);
    expect(isSafeUrl("  javascript:alert(1)")).toBe(false); // test leading whitespace
    expect(isSafeUrl("\tjavascript:alert(1)")).toBe(false);
  });

  it("should block unsafe protocols like data:", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("data:image/svg+xml;base64,PHN2Z...")).toBe(false);
  });

  it("should block unsafe protocols like vbscript: or mailto:", () => {
    expect(isSafeUrl('vbscript:msgbox("hello")')).toBe(false);
    expect(isSafeUrl("mailto:test@example.com")).toBe(false);
  });

  it("should block protocol-relative URLs (starts with //)", () => {
    // These could potentially bypass protocol restrictions depending on the page's protocol
    expect(isSafeUrl("//example.com/malicious")).toBe(false);
  });

  it("should reject non-string or empty inputs", () => {
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl({})).toBe(false);
    expect(isSafeUrl(123)).toBe(false);
  });
});
