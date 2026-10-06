import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToastProvider, useToast } from "../ToastContext";
import NotificationHistory from "./NotificationHistory";
const auth = vi.hoisted(() => ({ user: { username: "admin" } }));
vi.mock("../AuthContext", () => ({ useAuth: () => auth }));
function App() {
  const { addToast } = useToast();
  return (
    <>
      <button onClick={() => addToast("Backup completed", "success")}>
        Notify
      </button>
      <NotificationHistory />
    </>
  );
}
const tree = () => (
  <ToastProvider>
    <App />
  </ToastProvider>
);
describe("notification memory", () => {
  beforeEach(() => {
    localStorage.clear();
    auth.user = { username: "admin" };
  });
  it("keeps dismissed messages and persists them across remounts", async () => {
    const first = render(tree());
    fireEvent.click(screen.getByText("Notify"));
    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(screen.queryByText("Backup completed")).not.toBeInTheDocument();
    first.unmount();
    render(tree());
    fireEvent.click(screen.getByLabelText("Notification history, 1 unread"));
    expect(
      within(screen.getByRole("dialog")).getByText("Backup completed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Notification history" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear history"));
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });
  it("separates history between accounts and backends", async () => {
    const first = render(tree());
    fireEvent.click(screen.getByText("Notify"));
    first.unmount();
    auth.user = { username: "other" };
    const second = render(tree());
    fireEvent.click(
      screen.getByRole("button", { name: "Notification history" }),
    );
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
    second.unmount();
    auth.user = { username: "admin" };
    localStorage.setItem("api_base_url", "https://other.example");
    render(tree());
    fireEvent.click(
      screen.getByRole("button", { name: "Notification history" }),
    );
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });
  it("clears visible notifications when the account changes", async () => {
    const view = render(tree());
    fireEvent.click(screen.getByText("Notify"));
    auth.user = null;
    view.rerender(tree());
    await waitFor(() =>
      expect(screen.queryByText("Backup completed")).not.toBeInTheDocument(),
    );
  });
});
