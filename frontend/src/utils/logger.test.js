import { describe, it, expect, vi, beforeEach } from "vitest";

describe("logger", () => {
  let consoleSpy;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("logs debug message when environment is development", async () => {
    vi.stubEnv("MODE", "development");
    const { default: createLogger } = await import("./logger");
    const logger = createLogger("test");
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.debug("test debug");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("logs info message when environment is development", async () => {
    vi.stubEnv("MODE", "development");
    const { default: createLogger } = await import("./logger");
    const logger = createLogger("test");
    consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test info");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("logs warn message when environment is production", async () => {
    vi.stubEnv("MODE", "production");
    const { default: createLogger } = await import("./logger");
    const logger = createLogger("test");
    consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("test warn");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("logs error message when environment is production", async () => {
    vi.stubEnv("MODE", "production");
    const { default: createLogger } = await import("./logger");
    const logger = createLogger("test");
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("test error");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("does not log debug in production", async () => {
    vi.stubEnv("MODE", "production");
    const { default: createLogger } = await import("./logger");
    const logger = createLogger("test");
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.debug("test debug");
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("respects VITE_LOG_LEVEL", async () => {
    vi.stubEnv("VITE_LOG_LEVEL", "info");
    const { default: createLogger } = await import("./logger");
    const logger = createLogger("test");

    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.debug("test debug");
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();

    consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test info");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
