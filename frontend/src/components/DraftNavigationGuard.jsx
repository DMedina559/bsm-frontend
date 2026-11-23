import { use, useEffect, useSyncExternalStore } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";
import { useDialog } from "../contexts/DialogContext";
import { draftRegistry } from "../app/draftRegistry";
import { isSettingsTabChange } from "../utils/settingsNavigation";

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
  const router = use(UNSAFE_DataRouterContext);
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
