import { ApiError } from "../api/client";

export function cartErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409 && err.message.startsWith("Request failed")) {
      return "Not enough stock available for this item.";
    }
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
