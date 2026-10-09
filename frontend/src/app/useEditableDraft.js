import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import { useDialog } from "../DialogContext";
const serialize = (value) => JSON.stringify(value);
/** Keeps background reads and completed saves from replacing newer edits. */
export function useEditableDraft(resource, data, empty) {
  const { user, sessionGeneration } = useAuth();
  const { confirmAction } = useDialog();
  const identity = `${user?.id ?? user?.username ?? ""}:${sessionGeneration ?? 0}:${resource}`;
  const [state, setState] = useState(() => ({
    identity,
    value: data ?? empty,
    baseline: data === undefined ? null : serialize(data),
  }));
  const current =
    state.identity === identity
      ? state
      : {
          identity,
          value: data ?? empty,
          baseline: data === undefined ? null : serialize(data),
        };
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  useEffect(() => {
    setState((previous) => {
      if (previous.identity !== identity)
        return {
          identity,
          value: data ?? empty,
          baseline: data === undefined ? null : serialize(data),
        };
      if (
        data !== undefined &&
        (previous.baseline === null ||
          serialize(previous.value) === previous.baseline)
      )
        return { identity, value: data, baseline: serialize(data) };
      return previous;
    });
  }, [identity, data, empty]);
  const setValue = useCallback(
    (update) =>
      setState((previous) => {
        const value =
          previous.identity === identity ? previous.value : (data ?? empty);
        return {
          ...previous,
          identity,
          value: typeof update === "function" ? update(value) : update,
        };
      }),
    [identity, data, empty],
  );
  const markSaved = useCallback(
    (submitted) => {
      if (identityRef.current !== identity) return;
      setState((previous) =>
        previous.identity === identity
          ? { ...previous, baseline: serialize(submitted) }
          : previous,
      );
    },
    [identity],
  );
  const dirty =
    current.baseline !== null && serialize(current.value) !== current.baseline;
  const refresh = async (refetch) => {
    if (dirty && !(await confirmAction("Discard unsaved changes and refresh?")))
      return false;
    const before = serialize(current.value);
    const result = await refetch();
    if (identityRef.current !== identity || result.error) return false;
    setState((previous) =>
      previous.identity === identity && serialize(previous.value) === before
        ? { identity, value: result.data, baseline: serialize(result.data) }
        : previous,
    );
    return true;
  };
  return {
    value: current.value,
    setValue,
    savedSnapshot: current.baseline,
    markSaved,
    dirty,
    refresh,
  };
}
