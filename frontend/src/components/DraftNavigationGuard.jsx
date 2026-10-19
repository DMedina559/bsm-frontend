import { useContext, useEffect, useSyncExternalStore } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";
import { useDialog } from "../contexts/DialogContext";
import { draftRegistry } from "../app/draftRegistry";
export function isSettingsTabChange(current, next) {
  if (
    current.pathname !== "/bsm-settings" ||
    current.pathname !== next.pathname
  )
    return false;
  const before = new URLSearchParams(current.search);
  const after = new URLSearchParams(next.search);
  const tabs = [null, "general", "backups", "web", "storage", "advanced"];
  if (!tabs.includes(before.get("tab")) || !tabs.includes(after.get("tab")))
    return false;
  before.delete("tab");
  after.delete("tab");
  before.sort();
  after.sort();
  return before.toString() === after.toString();
}

function RouterGuard({ dirty }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !isSettingsTabChange(currentLocation, nextLocation) &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  const { confirmAction } = useDialog();
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    let active = true;
    void confirmAction("Discard unsaved changes and leave this page?").then(
      (leave) => {
        if (active) {
          if (leave) blocker.proceed();
          else blocker.reset();
        }
      },
    );
    return () => {
      active = false;
    };
  }, [blocker, confirmAction]);
  return null;
}
export default function DraftNavigationGuard() {
  const router = useContext(UNSAFE_DataRouterContext);
  const dirty = useSyncExternalStore(
    draftRegistry.subscribe,
    draftRegistry.dirty,
  );
  useEffect(() => {
    if (!dirty) return;
    const guard = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  return router ? <RouterGuard dirty={dirty} /> : null;
}
