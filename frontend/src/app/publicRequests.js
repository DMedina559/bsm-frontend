import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getBackendIdentity } from "./backendIdentity";
import { queryClient } from "./queryClient";
import { sessionRuntime } from "./sessionRuntime";

/** Requests before sign-in still belong to a backend and session generation. */
export function usePublicQuery(key, load, options = {}) {
  const session = sessionRuntime.capture();
  return useQuery(
    {
      ...options,
      queryKey: [
        ...key,
        { backend: getBackendIdentity(), generation: session.generation },
      ],
      queryFn: async ({ signal }) => {
        const backend = getBackendIdentity();
        const combined = AbortSignal.any([signal, session.signal]);
        combined.throwIfAborted();
        const result = await load({ signal: combined });
        combined.throwIfAborted();
        if (
          !sessionRuntime.isCurrent(session) ||
          backend !== getBackendIdentity()
        )
          throw new DOMException("Session changed", "AbortError");
        return result;
      },
      retry: false,
      gcTime: 0,
    },
    queryClient,
  );
}

/** Scope changes and unmounts prevent a completed write from updating another page. */
export function useScopedMutation(scope, run) {
  const current = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    current.current = controller;
    return () => controller.abort();
  }, [scope]);
  const mutation = useMutation(
    {
      mutationKey: ["page-write", getBackendIdentity(), scope],
      gcTime: 0,
      retry: false,
      mutationFn: async ({
        variables,
        session,
        backend,
        controller,
        execute,
      }) => {
        const signal = AbortSignal.any([session.signal, controller.signal]);
        const assertCurrent = () => {
          signal.throwIfAborted();
          if (
            !sessionRuntime.isCurrent(session) ||
            backend !== getBackendIdentity()
          )
            throw new DOMException("Session changed", "AbortError");
        };
        assertCurrent();
        const result = await execute(variables, {
          session: { ...session, signal },
          signal,
          assertCurrent,
        });
        assertCurrent();
        return result;
      },
    },
    queryClient,
  );
  return {
    ...mutation,
    isPending: mutation.isPending && mutation.variables?.scope === scope,
    mutateAsync: (variables) =>
      mutation.mutateAsync({
        scope,
        variables,
        session: sessionRuntime.capture(),
        backend: getBackendIdentity(),
        controller: current.current,
        execute: run,
      }),
  };
}
