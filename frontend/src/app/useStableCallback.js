import { useCallback, useLayoutEffect, useRef } from "react";
/** Stable event identity with the latest committed render's behavior.
 * @template {(...args: any[]) => any} T
 * @param {T} callback
 * @returns {T}
 */
export function useStableCallback(callback) {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  return /** @type {T} */ (useCallback((...args) => ref.current(...args), []));
}
