import { api } from "./client";
import type { User } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizeUser(value: unknown): User {
  const raw = asRecord(value);
  return {
    id: String(raw.id ?? ""),
    email: String(raw.email ?? ""),
    full_name: String(raw.full_name ?? ""),
    role: raw.role === "admin" ? "admin" : "user",
  };
}

export async function fetchMe(signal?: AbortSignal): Promise<User> {
  return normalizeUser(await api.get<unknown>("/users/me", { auth: true, signal }));
}

// Returns the name as saved by the server.
export async function updateMyName(fullName: string): Promise<string> {
  const data = await api.patch<unknown>("/users/me", { full_name: fullName }, { auth: true });
  const saved = asRecord(data).full_name;
  return typeof saved === "string" && saved ? saved : fullName;
}
