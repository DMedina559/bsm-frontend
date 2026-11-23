import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ResourceIcon from "../../../src/components/ResourceIcon";
import { callOperation } from "../../../src/api/operations";
vi.mock("../../../src/api/operations", () => ({ callOperation: vi.fn() }));
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1 }, sessionGeneration: 1 }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("fetches private icons through credential-aware operations and discards late images", async () => {
  const create = vi.fn(() => "blob:private-icon");
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  let old;
  callOperation
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          old = resolve;
        }),
    )
    .mockResolvedValueOnce(new Blob(["new image"]));
  const view = render(
    <ResourceIcon
      name="Pack"
      serverName="old-server"
      packType="behavior"
      uuid="pack"
    />,
  );
  const originalSignal = callOperation.mock.calls[0][1].signal;
  view.rerender(
    <ResourceIcon
      name="Pack"
      serverName="new-server"
      packType="behavior"
      uuid="pack"
    />,
  );
  expect(originalSignal.aborted).toBe(true);
  await waitFor(() =>
    expect(screen.getByAltText("Pack icon")).toHaveAttribute(
      "src",
      "blob:private-icon",
    ),
  );
  old(new Blob(["old image"]));
  await Promise.resolve();
  expect(create).toHaveBeenCalledTimes(1);
  expect(callOperation).toHaveBeenLastCalledWith(
    "get_server_addon_icon",
    expect.objectContaining({
      path: { server_name: "new-server" },
      responseType: "blob",
      signal: expect.any(AbortSignal),
    }),
  );
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:private-icon");
});
