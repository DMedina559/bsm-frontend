import { getBackendIdentity } from "./backendIdentity";
import { sessionRuntime } from "./sessionRuntime";
import { draftRegistry } from "./draftRegistry";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDialog } from "../contexts/DialogContext";
const serialize = (value) => JSON.stringify(value);
/** Keeps background reads and completed saves from replacing newer edits. */
export function useEditableDraft(resource, data, empty) {
  const { user, sessionGeneration } = useAuth();
  const { confirmAction } = useDialog();
  const backend = getBackendIdentity();
  const { generation, signal } = sessionRuntime.capture();
  const identity = `${backend}:${user?.id ?? user?.username ?? ""}:${sessionGeneration ?? 0}:${resource}`;
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
  useLayoutEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  const isCurrent = useCallback(
    () =>
      identityRef.current === identity &&
      !signal.aborted &&
      sessionRuntime.isCurrent({ generation, signal }) &&
      getBackendIdentity() === backend,
    [identity, generation, signal, backend],
  );
  useEffect(() => {
    setState((previous) => {
      if (previous.identity !== identity)
        return {
          identity,
          value: data ?? empty,
          baseline: data === undefined ? null : serialize(data),
        };
      if (
        previous.pendingBackend !== undefined &&
        data !== undefined &&
        serialize(data) !== previous.pendingBackend
      )
        previous = { ...previous, pendingBackend: undefined };
      if (
        data !== undefined &&
        serialize(data) !== previous.pendingBackend &&
        (previous.baseline === null ||
          (serialize(data) !== previous.baseline &&
            serialize(previous.value) === previous.baseline))
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
      if (!isCurrent()) return;
      setState((previous) =>
        previous.identity === identity
          ? {
              ...previous,
              baseline: serialize(submitted),
              pendingBackend: serialize(data),
            }
          : previous,
      );
    },
    [identity, data, isCurrent],
  );
  const dirty =
    current.baseline !== null && serialize(current.value) !== current.baseline;
  const conflicted =
    dirty &&
    data !== undefined &&
    serialize(data) !== current.baseline &&
    serialize(data) !== current.pendingBackend;
  useEffect(() => {
    if (dirty) return draftRegistry.register();
  }, [dirty, identity]);
  const refresh = async (refetch) => {
    if (dirty && !(await confirmAction("Discard unsaved changes and refresh?")))
      return false;
    const before = serialize(current.value);
    const result = await refetch();
    if (!isCurrent() || result.error) return false;
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
    conflicted,
    refresh,
  };
}
