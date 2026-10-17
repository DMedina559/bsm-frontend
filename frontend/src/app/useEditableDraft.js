import { usePreference } from "./usePreference";
import { getPreferenceIdentity } from "./backendIdentity";
import { browserRecords } from "./browserRecords";
import {
  createDraftPatch,
  validDraftPatch,
  restoreDraftPatch,
  supportsDraftRecovery,
} from "./draftRecovery";
import { getBackendIdentity } from "./backendIdentity";
import { sessionRuntime } from "./sessionRuntime";
import { draftRegistry } from "./draftRegistry";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
  const scope = getPreferenceIdentity(user);
  const [recoveryEnabled] = usePreference("draftRecovery", false);
  const recoveryKey = JSON.stringify([scope, resource]);
  const [recovery, setRecovery] = useState(null);
  const [persistence, setPersistence] = useState(null);
  const pendingPersistence = useRef(null);
  const persistenceScope = useRef({ scope, enabled: recoveryEnabled });
  useLayoutEffect(() => {
    persistenceScope.current = { scope, enabled: recoveryEnabled };
  }, [scope, recoveryEnabled]);
  const editedRecovery = useRef(null);
  const { generation, signal } = sessionRuntime.capture();
  const identity = `${backend}:${user?.id ?? user?.username ?? ""}:${sessionGeneration ?? 0}:${resource}`;
  const [state, setState] = useState(() => ({
    identity,
    value: data ?? empty,
    baseline: data === undefined ? null : serialize(data),
  }));
  const current = useMemo(
    () =>
      state.identity === identity
        ? state
        : {
            identity,
            value: data ?? empty,
            baseline: data === undefined ? null : serialize(data),
          },
    [state, identity, data, empty],
  );
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
  // Flush the latest edit when leaving a resource; typing only resets its timer.
  useEffect(
    () => () => {
      const job = pendingPersistence.current;
      pendingPersistence.current = null;
      job?.();
    },
    [recoveryKey],
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
    (update) => {
      editedRecovery.current = recoveryKey;
      setRecovery(null);
      setState((previous) => {
        const value =
          previous.identity === identity ? previous.value : (data ?? empty);
        return {
          ...previous,
          identity,
          touched: true,
          value: typeof update === "function" ? update(value) : update,
        };
      });
    },
    [identity, data, empty, recoveryKey],
  );
  const markSaved = useCallback(
    (submitted) => {
      if (!isCurrent()) return;
      editedRecovery.current = recoveryKey;
      setRecovery(null);
      setState((previous) =>
        previous.identity === identity
          ? {
              ...previous,
              touched: true,
              recoveredConflict: false,
              baseline: serialize(submitted),
              pendingBackend: serialize(data),
            }
          : previous,
      );
    },
    [identity, data, isCurrent, recoveryKey],
  );
  const dirty =
    current.baseline !== null && serialize(current.value) !== current.baseline;
  const conflicted =
    dirty &&
    (current.recoveredConflict ||
      (data !== undefined &&
        serialize(data) !== current.baseline &&
        serialize(data) !== current.pendingBackend));
  useEffect(() => {
    let active = true;
    if (recoveryEnabled && supportsDraftRecovery(resource)) {
      void browserRecords.read(scope, "draft", resource).then((record) => {
        if (
          active &&
          isCurrent() &&
          editedRecovery.current !== recoveryKey &&
          validDraftPatch(resource, record?.value)
        )
          setRecovery({ key: recoveryKey, record });
      });
    }
    return () => {
      active = false;
    };
  }, [scope, resource, recoveryKey, recoveryEnabled, isCurrent]);
  useEffect(() => {
    if (
      !recoveryEnabled ||
      !supportsDraftRecovery(resource) ||
      !isCurrent() ||
      !current.touched ||
      current.baseline === null
    )
      return;
    const patch = createDraftPatch(
      resource,
      JSON.parse(current.baseline),
      current.value,
    );
    let active = true;
    const persist = () => {
      if (pendingPersistence.current === persist)
        pendingPersistence.current = null;
      if (
        !persistenceScope.current.enabled ||
        persistenceScope.current.scope !== scope ||
        !sessionRuntime.isCurrent({ generation, signal }) ||
        getBackendIdentity() !== backend
      )
        return;
      const stored = dirty && patch.length;
      const saving = stored
        ? browserRecords.write(
            scope,
            "draft",
            resource,
            patch,
            7 * 24 * 60 * 60 * 1000,
          )
        : browserRecords.remove(scope, "draft", resource);
      void saving.then((success) => {
        if (active && isCurrent())
          setPersistence({
            key: recoveryKey,
            status: !success
              ? "unavailable"
              : stored
                ? "saved"
                : dirty
                  ? "excluded"
                  : "cleared",
          });
      });
    };
    pendingPersistence.current = persist;
    setPersistence({ key: recoveryKey, status: "pending" });
    const timer = dirty && patch.length ? setTimeout(persist, 400) : null;
    if (timer === null) persist();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    scope,
    resource,
    recoveryEnabled,
    current,
    dirty,
    isCurrent,
    generation,
    signal,
    backend,
    recoveryKey,
  ]);
  const recoverable =
    recoveryEnabled &&
    recovery?.key === recoveryKey &&
    !current.touched &&
    recovery.record;
  const discardRecovery = () => {
    void browserRecords.remove(scope, "draft", resource);
    setRecovery(null);
  };
  const restoreRecovery = () => {
    if (!recoverable || data === undefined || !isCurrent()) return;
    const restored = restoreDraftPatch(resource, data, recoverable.value);
    if (!restored) return;
    setState({
      identity,
      value: restored.value,
      baseline: serialize(data),
      touched: true,
      recoveredConflict: restored.conflicted,
    });
    setRecovery(null);
  };
  useEffect(() => {
    if (dirty) return draftRegistry.register();
  }, [dirty, identity]);
  const refresh = async (refetch) => {
    if (dirty && !(await confirmAction("Discard unsaved changes and refresh?")))
      return false;
    const before = serialize(current.value);
    const result = await refetch();
    if (!isCurrent() || result.error) return false;
    editedRecovery.current = recoveryKey;
    setRecovery(null);
    setState((previous) =>
      previous.identity === identity && serialize(previous.value) === before
        ? {
            identity,
            value: result.data,
            baseline: serialize(result.data),
            touched: true,
          }
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
    persistenceStatus:
      recoveryEnabled && persistence?.key === recoveryKey
        ? persistence.status
        : null,
    recoverable,
    canRestore: data !== undefined,
    restoreRecovery,
    discardRecovery,
    refresh,
  };
}
