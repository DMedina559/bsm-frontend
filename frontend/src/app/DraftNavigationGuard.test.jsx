import { useEffect } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Link } from "react-router-dom";
import { expect, it, vi } from "vitest";
import DraftNavigationGuard from "./DraftNavigationGuard";
import { draftRegistry } from "./draftRegistry";
const confirm = vi.hoisted(() => vi.fn());
vi.mock("../DialogContext", () => ({
  useDialog: () => ({ confirmAction: confirm }),
}));
function Editor() {
  useEffect(() => draftRegistry.register(), []);
  return (
    <>
      <DraftNavigationGuard />
      <Link to="/next">Leave</Link>
    </>
  );
}
it("protects dirty drafts on internal navigation and browser close", async () => {
  const router = createMemoryRouter([
    { path: "/", element: <Editor /> },
    { path: "/next", element: <p>Next page</p> },
  ]);
  const view = render(<RouterProvider router={router} />);
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  confirm.mockResolvedValueOnce(false);
  fireEvent.click(screen.getByText("Leave"));
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(router.state.blockers.values().next().value?.state).toBe(
      "unblocked",
    ),
  );
  expect(router.state.location.pathname).toBe("/");
  confirm.mockResolvedValueOnce(true);
  fireEvent.click(screen.getByText("Leave"));
  await screen.findByText("Next page");
  view.unmount();
  expect(draftRegistry.dirty()).toBe(false);
  router.dispose();
});
