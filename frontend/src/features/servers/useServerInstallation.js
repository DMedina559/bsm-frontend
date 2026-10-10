import { useEffect, useRef } from "react";
import { callOperation } from "../../api/operations";
import { useOperations } from "../../app/useOperations";
import { useScopedMutation } from "../../app/publicRequests";
import { operationCoordinator } from "../../app/operationCoordinator";
import { sessionRuntime } from "../../app/sessionRuntime";
import { getBackendIdentity } from "../../app/backendIdentity";
import { useDialog } from "../../contexts/DialogContext";
import { useToast } from "../../contexts/ToastContext";

export function useServerInstallation(onInstalled) {
  const { confirmAction } = useDialog();
  const { addToast } = useToast();
  const operations = useOperations();
  const operation = operations
    .filter((item) => item.kind === "install" && !item.acknowledged)
    .at(-1);
  const handled = useRef(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const write = useScopedMutation(
    "install",
    async (payload, { signal, assertCurrent }) => {
      let response = await callOperation("install_server", {
        body: payload,
        signal,
      });
      if (response?.status === "confirm_needed") {
        const confirmed = await confirmAction(response.message);
        assertCurrent();
        if (!confirmed) return;
        response = await callOperation("install_server", {
          body: { ...payload, overwrite: true },
          signal,
        });
      }
      assertCurrent();
      if (!response?.task_id)
        throw new Error(
          "The installation did not return a task ID. Try again.",
        );
      operationCoordinator.register({
        id: response.task_id,
        kind: "install",
        serverName: payload.server_name,
      });
      addToast("Installation started. Please wait...", "info");
    },
  );
  useEffect(() => {
    if (
      !operation ||
      handled.current === operation.id ||
      (!operation.terminal && operation.status !== "unknown")
    )
      return;
    handled.current = operation.id;
    const session = sessionRuntime.capture();
    const backend = getBackendIdentity();
    const assertCurrent = () => {
      if (
        !mounted.current ||
        !sessionRuntime.isCurrent(session) ||
        backend !== getBackendIdentity()
      )
        throw new DOMException("Installation page changed", "AbortError");
    };
    const success =
      ["completed", "complete", "success"].includes(operation.status) &&
      !["error", "skipped"].includes(operation.task?.result?.status);
    operationCoordinator.acknowledge(operation.id);
    if (success) {
      addToast("Installation completed successfully!", "success");
      void onInstalled(operation.serverName, assertCurrent).catch((error) => {
        if (error.name !== "AbortError")
          addToast(
            error.message || "Could not open the installed server.",
            "error",
          );
      });
    } else {
      addToast(
        operation.status === "unknown"
          ? "Installation status is unavailable. Check the server before retrying."
          : `Installation failed: ${operation.task?.error?.message || operation.task?.result?.message || operation.task?.message || operation.status}`,
        "error",
      );
    }
  }, [operation, onInstalled, addToast]);
  return {
    serverName: operation?.serverName,
    loading:
      write.isPending ||
      Boolean(
        operation && !operation.terminal && operation.status !== "unknown",
      ),
    submit: async (payload) => {
      try {
        await write.mutateAsync(payload);
      } catch (error) {
        if (error.name !== "AbortError")
          addToast(error.message || "Failed to install server.", "error");
      }
    },
  };
}
