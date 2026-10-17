const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/user-service";

export const TOKEN_KEY = "shipyard.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface CallOptions {
  auth?: boolean;
  signal?: AbortSignal;
}

interface RequestOptions extends CallOptions {
  method?: Method;
  body?: unknown;
}

async function readDetail(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        const messages = detail
          .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : null))
          .filter(Boolean);
        if (messages.length > 0) return messages.join(" ");
      }
    }
  } catch {
    /* body is not JSON */
  }
  return `Request failed (${response.status})`;
}

async function request<T>(
  path: string,
  { method = "GET", body, auth = false, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Paths starting with /api/ are already complete relative paths (e.g. /api/product-service/...).
  // Anything else is relative to the user-service base (FE-2 auth calls).
  const url = path.startsWith("/api/") ? path : `${BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Network error. Please try again.");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readDetail(response));
  }

  // 204 / empty bodies are fine (mutations); anything else must be JSON.
  const text = await response.text();
  if (text === "") return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, "Unexpected response from server.");
  }
}

export const api = {
  get: <T>(path: string, options: CallOptions = {}) => request<T>(path, options),
  post: <T>(path: string, body: unknown, options: CallOptions = {}) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body: unknown, options: CallOptions = {}) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options: CallOptions = {}) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
