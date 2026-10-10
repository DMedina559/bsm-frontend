import { request, downloadFile } from "../../api/transport";
import { useScopedMutation } from "../../app/publicRequests";
import { useToast } from "../../contexts/ToastContext";

export function usePluginActions({
  scope,
  formState,
  query,
  searchParams,
  setSearchParams,
  setActiveModalId,
}) {
  const { addToast } = useToast();
  const write = useScopedMutation(
    scope,
    async (action, { signal, session, assertCurrent }) => {
      if (action.type === "download_file") {
        await downloadFile(action.endpoint, action.filename || "download", {
          signal,
          session,
        });
        return;
      }
      let body = {
        ...(action.payload ?? {}),
        ...(action.includeFormState ? formState : {}),
      };
      if (Object.values(body).some((value) => value instanceof File)) {
        const form = new FormData();
        Object.entries(body).forEach(([key, value]) => {
          if (value != null) form.append(key, value);
        });
        body = form;
      }
      const result = await request(action.endpoint, {
        method: "POST",
        body,
        signal,
        session,
      });
      assertCurrent();
      if (result?.status !== "success")
        throw new Error(result?.message || "Action failed");
      if (action.refresh && query.canRefresh) await query.refetch();
      assertCurrent();
      return result;
    },
  );
  return async (action) => {
    if (!action) return;
    if (action.type === "api_call" || action.type === "download_file") {
      try {
        const result = await write.mutateAsync(action);
        if (action.type === "api_call") {
          addToast(result?.message || "Action successful", "success");
          if (action.closeModal) setActiveModalId(null);
        }
      } catch (error) {
        if (error.name !== "AbortError")
          addToast(error.message || "Action error", "error");
      }
    } else if (action.type === "navigate") {
      const next = new URLSearchParams(searchParams);
      if (action.params)
        Object.entries(action.params).forEach(([key, value]) =>
          next.set(key, value),
        );
      else if (action.url) next.set("url", action.url);
      setSearchParams(next);
    } else if (action.type === "open_modal" && action.modalId)
      setActiveModalId(action.modalId);
    else if (action.type === "close_modal") setActiveModalId(null);
  };
}
