import { useCallback } from "react";
import { ApiError } from "../api/client";
import { describeError } from "../lib/errors";
import { useAuth } from "./AuthContext";

// Turns an error into a message; a 401 also ends the session.
export function useApiError() {
  const { logout } = useAuth();
  return useCallback(
    (err: unknown, conflictMessage?: string) => {
      if (err instanceof ApiError && err.status === 401) logout();
      return describeError(err, conflictMessage);
    },
    [logout],
  );
}
