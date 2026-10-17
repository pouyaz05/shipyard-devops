import { useEffect } from "react";
import type { AsyncState } from "../hooks/useAsyncData";
import { useAuth } from "./AuthContext";

// An expired token (401) ends the session; ProtectedRoute then sends the user to /login.
export function useLogoutOnUnauthorized(state: AsyncState<unknown>): void {
  const { logout } = useAuth();
  useEffect(() => {
    if (state.kind === "error" && state.httpStatus === 401) logout();
  }, [state, logout]);
}
