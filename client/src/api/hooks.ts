/**
 * Minimal typed data-access hooks.
 *
 * Deliberately hand-written rather than a query library: the CRM needs exactly
 * three behaviours — load with cancellation, re-run on demand, and run a
 * mutation once per intent — and adding a cache layer would introduce a second
 * place where CRM truth lives. PostgreSQL stays the only source of truth, and
 * a refetch is how the UI learns what it now says.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./errors";

export type LoadState = "idle" | "loading" | "success" | "error";

export interface ApiResource<T> {
  data: T | null;
  error: ApiError | null;
  state: LoadState;
  /** True only for the FIRST load, so a refetch does not blank the screen. */
  initialLoading: boolean;
  reload: () => void;
}

function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  return new ApiError({
    status: 0,
    code: "REQUEST_FAILED",
    message: cause instanceof Error ? cause.message : "تعذر إكمال الطلب.",
  });
}

/**
 * Load a resource, re-running whenever `deps` change.
 *
 * The in-flight request is aborted when deps change or the component unmounts,
 * so a slow response for an old filter can never overwrite a newer one.
 */
export function useApiResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
): ApiResource<T> {
  const enabled = options.enabled !== false;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [state, setState] = useState<LoadState>(enabled ? "loading" : "idle");
  const [nonce, setNonce] = useState(0);
  const loadedOnce = useRef(false);

  // The fetcher is usually an inline closure, so it is read through a ref
  // instead of being a dependency — otherwise every render would refetch.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState("loading");

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!active) return;
        loadedOnce.current = true;
        setData(result);
        setError(null);
        setState("success");
      })
      .catch((cause) => {
        // An abort is this hook superseding itself, not a failure to show.
        if (!active || (cause instanceof DOMException && cause.name === "AbortError")) return;
        loadedOnce.current = true;
        setError(toApiError(cause));
        setState("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    data,
    error,
    state,
    initialLoading: state === "loading" && !loadedOnce.current,
    reload,
  };
}

export interface ApiAction<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | null>;
  pending: boolean;
  error: ApiError | null;
  reset: () => void;
}

/**
 * Run a mutation.
 *
 * While one call is in flight further calls are DROPPED rather than queued.
 * With the per-intent `Idempotency-Key` in `http.ts` this is the double-click
 * guard: the second click produces no second durable mutation, and no second
 * request either.
 */
export function useApiAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): ApiAction<TArgs, TResult> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const actionRef = useRef(action);
  actionRef.current = action;

  const run = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await actionRef.current(...args);
      return result;
    } catch (cause) {
      if (mounted.current) setError(toApiError(cause));
      return null;
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}
