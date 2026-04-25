import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  request,
  get,
  post,
  put,
  del,
  ApiError,
  getApiBaseUrl,
  setApiBaseUrl,
} from "./api";

describe("api", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("getApiBaseUrl returns empty string if not set", () => {
    expect(getApiBaseUrl()).toBe("");
  });

  it("setApiBaseUrl sets the base URL correctly", () => {
    setApiBaseUrl("http://test.com/");
    expect(getApiBaseUrl()).toBe("http://test.com");
  });

  it("setApiBaseUrl removes the base URL if falsy", () => {
    setApiBaseUrl("http://test.com");
    setApiBaseUrl("");
    expect(getApiBaseUrl()).toBe("");
  });

  describe("request", () => {
    it("handles 204 No Content", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 204,
        }),
      );
      const res = await request("/test");
      expect(res).toBeNull();
    });

    it("handles valid JSON response", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ data: "test" }),
        }),
      );
      const res = await request("/test");
      expect(res).toEqual({ data: "test" });
    });

    it("handles invalid JSON response", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.reject(new Error("Invalid JSON")),
        }),
      );
      await expect(request("/test")).rejects.toThrow(ApiError);
      await expect(request("/test")).rejects.toThrow(
        "Invalid JSON response from server",
      );
    });

    it("handles non-JSON response error", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 404,
          ok: false,
          headers: new Headers({ "content-type": "text/html" }),
          text: () => Promise.resolve("Not Found"),
        }),
      );
      await expect(request("/test")).rejects.toThrow(ApiError);
    });

    it("handles non-JSON HTML redirect response", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "text/html" }),
          text: () => Promise.resolve("<!doctype html><html></html>"),
        }),
      );
      await expect(request("/test")).rejects.toThrow(
        "Session expired (Redirected to App)",
      );
    });

    it("handles API error with detail", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 400,
          ok: false,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({ detail: "Bad Request Detail" }),
        }),
      );
      await expect(request("/test")).rejects.toThrow("Bad Request Detail");
    });

    it("handles legacy API error in 200 response", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () =>
            Promise.resolve({ status: "error", message: "Legacy Error" }),
        }),
      );
      await expect(request("/test")).rejects.toThrow("Legacy Error");
    });

    it("handles network error", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.reject(new Error("Network Error")),
      );
      await expect(request("/test")).rejects.toThrow("Network Error");
    });
  });

  describe("helper methods", () => {
    it("get calls request with GET method", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        }),
      );
      await get("/test");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("post calls request with POST method and body", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        }),
      );
      await post("/test", { data: "test" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ data: "test" }),
        }),
      );
    });

    it("put calls request with PUT method and body", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        }),
      );
      await put("/test", { data: "test" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ data: "test" }),
        }),
      );
    });

    it("del calls request with DELETE method", async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        }),
      );
      await del("/test");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
