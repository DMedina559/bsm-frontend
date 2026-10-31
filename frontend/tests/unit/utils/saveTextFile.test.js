import { afterEach, expect, it, vi } from "vitest";
import { saveTextFile } from "../../../src/utils/saveTextFile";
afterEach(() => vi.unstubAllGlobals());
function picker(implementation) {
  vi.stubGlobal("showSaveFilePicker", implementation);
}
it("reports success only after the selected file closes", async () => {
  let finish;
  const stream = {
    write: vi.fn(),
    abort: vi.fn(),
    close: vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  };
  const choose = vi.fn(async () => ({ createWritable: async () => stream }));
  picker(choose);
  let done = false;
  const saving = saveTextFile(
    "codes.txt",
    "synthetic codes",
    new AbortController().signal,
  ).then((value) => {
    done = true;
    return value;
  });
  expect(choose).toHaveBeenCalledWith(
    expect.objectContaining({ suggestedName: "codes.txt" }),
  );
  await vi.waitFor(() => expect(stream.close).toHaveBeenCalledOnce());
  expect(done).toBe(false);
  expect(stream.write).toHaveBeenCalledWith("synthetic codes");
  finish();
  expect(await saving).toBe(true);
});
it("preserves cancellation instead of starting a second save dialog", async () => {
  picker(
    vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")),
  );
  await expect(saveTextFile("codes.txt", "codes")).rejects.toMatchObject({
    name: "AbortError",
  });
});
it("aborts incomplete writes without claiming success", async () => {
  const stream = {
    write: vi.fn().mockRejectedValue(new Error("disk full")),
    close: vi.fn(),
    abort: vi.fn(),
  };
  picker(async () => ({ createWritable: async () => stream }));
  await expect(saveTextFile("codes.txt", "codes")).rejects.toThrow("disk full");
  expect(stream.abort).toHaveBeenCalledOnce();
  expect(stream.close).not.toHaveBeenCalled();
});
it("does not write if the account/view changed during file selection", async () => {
  const abort = new AbortController();
  const createWritable = vi.fn();
  picker(async () => {
    abort.abort();
    return { createWritable };
  });
  await expect(
    saveTextFile("codes.txt", "codes", abort.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(createWritable).not.toHaveBeenCalled();
});
it("allows the fallback when unavailable or forbidden by iframe policy", async () => {
  picker(undefined);
  expect(await saveTextFile("codes.txt", "codes")).toBe(false);
  picker(
    vi.fn().mockRejectedValue(new DOMException("Embedded", "SecurityError")),
  );
  expect(await saveTextFile("codes.txt", "codes")).toBe(false);
});
