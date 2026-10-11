import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";

export type AsyncState<T> =
  | { kind: "loading" }
  | { kind: "error"; message: string; httpStatus: number | null }
  | { kind: "success"; data: T };

export function useAsyncData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
) {
  const [state, setState] = useState<AsyncState<T>>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ kind: "success", data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError) {
          setState({ kind: "error", message: error.message, httpStatus: error.status });
        } else {
          setState({
            kind: "error",
            message: "Something went wrong. Please try again.",
            httpStatus: null,
          });
        }
      },
    );
    return () => controller.abort();
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
