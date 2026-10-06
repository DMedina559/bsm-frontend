import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { it, expect } from "vitest";
const source = readFileSync("index.html", "utf8");
for (const path of [
  "/app",
  "/app/",
  "/app/appearance",
  "/api/hassio_ingress/token/app/appearance",
]) {
  it(`resolves relative built assets under the app mount at ${path}`, () => {
    const dom = new JSDOM(source, {
      url: `http://localhost:11325${path}`,
      runScripts: "dangerously",
    });
    const prefix = path.slice(0, path.indexOf("/app") + 4) + "/";
    expect(
      new URL("./assets/index.js", dom.window.document.baseURI).pathname,
    ).toBe(prefix + "assets/index.js");
    expect(
      new URL("./assets/index.css", dom.window.document.baseURI).pathname,
    ).toBe(prefix + "assets/index.css");
    expect(dom.window.document.querySelectorAll("base")).toHaveLength(1);
    dom.window.close();
  });
}
it("provides the app asset base before JavaScript runs", () => {
  const dom = new JSDOM(source, { url: "http://localhost:11325/app" });
  expect(
    new URL("./assets/index.js", dom.window.document.baseURI).pathname,
  ).toBe("/app/assets/index.js");
  dom.window.close();
});
