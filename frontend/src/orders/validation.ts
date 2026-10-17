export function validateRequired(value: string, label: string): string | undefined {
  return value.trim() ? undefined : `${label} is required.`;
}
