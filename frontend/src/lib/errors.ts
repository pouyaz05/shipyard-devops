import { ApiError } from "../api/client";

// A clear, user-facing message for an action that failed (save, delete, cancel, ...).
export function describeError(
  err: unknown,
  conflictMessage = "This item was changed or is in use. Reload and try again.",
): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 403) return "You don't have permission to do this.";
    if (err.status === 409 && err.message.startsWith("Request failed")) return conflictMessage;
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

// Same idea for pages that failed to load.
export function loadErrorMessage(message: string, httpStatus: number | null): string {
  if (httpStatus === 401) return "Your session has expired. Please log in again.";
  if (httpStatus === 403) return "You don't have permission to view this page.";
  return message;
}
