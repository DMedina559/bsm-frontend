import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerBlobDownload } from "../../../src/utils/download";

describe("triggerBlobDownload", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the object URL alive while the Save As dialog is open and revokes after focus grace period", () => {
    vi.useFakeTimers();
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:keep-alive");
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function () {
        expect(this.isConnected).toBe(true);
        expect(this.download).toBe("archive.bsmbackup");
      });

    triggerBlobDownload(new Blob(["data"]), "archive.bsmbackup");

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[href="blob:keep-alive"]')).toBeNull();
    expect(revokeSpy).not.toHaveBeenCalled();

    // Advance 30 seconds while Save As dialog is open -> still not revoked
    vi.advanceTimersByTime(30_000);
    expect(revokeSpy).not.toHaveBeenCalled();

    // User closes Save As dialog and window regains focus -> timer resets to 60s
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(59_000);
    expect(revokeSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(revokeSpy).toHaveBeenCalledExactlyOnceWith("blob:keep-alive");
  });

  it("revokes immediately if anchor.click throws synchronously", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:failed-click");
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => triggerBlobDownload(new Blob(["x"]), "file.txt")).toThrow(
      "blocked",
    );
    expect(revokeSpy).toHaveBeenCalledExactlyOnceWith("blob:failed-click");
    expect(document.querySelector('a[href="blob:failed-click"]')).toBeNull();
  });
});
