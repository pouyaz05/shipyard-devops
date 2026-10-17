import { TOKEN_KEY } from "../api/client";

export const USER = {
  id: "1",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  role: "user",
};

export const ADMIN = {
  id: "9",
  email: "admin@example.com",
  full_name: "Root Admin",
  role: "admin",
};

export function loginAs(): void {
  localStorage.setItem(TOKEN_KEY, "tok");
}
