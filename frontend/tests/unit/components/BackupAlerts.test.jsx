import React from "react";
import { render } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import BackupAlerts from "../../../src/components/BackupAlerts";
const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  unsubscribe: vi.fn(),
  listener: null,
}));
vi.mock("../../../src/contexts/ToastContext", () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));
vi.mock("../../../src/contexts/WebSocketContext", () => ({
  useWebSocket: () => ({
    addMessageListener: (listener) => {
      mocks.listener = listener;
      return mocks.unsubscribe;
    },
  }),
}));
it("adds metadata-only backup alerts to notification history and releases its listener", () => {
  const view = render(<BackupAlerts />);
  mocks.listener({
    topic: "event:backup_attention",
    data: { server_name: "test", message: "A destination copy failed." },
  });
  expect(mocks.addToast).toHaveBeenCalledWith(
    expect.stringContaining("test: A destination copy failed."),
    "warning",
  );
  view.unmount();
  expect(mocks.unsubscribe).toHaveBeenCalled();
});
