const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  return EMAIL_RE.test(value.trim()) ? undefined : "Enter a valid email address.";
}

export function validatePassword(value: string): string | undefined {
  return value.length >= 8 ? undefined : "Password must be at least 8 characters.";
}

export function validateFullName(value: string): string | undefined {
  return value.trim().length > 0 ? undefined : "Full name is required.";
}
