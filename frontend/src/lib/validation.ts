// Formlardaki ortak doğrulama kuralları: mobil uygulamadaki lib/validation.ts ile aynı kurallar ve aynı mesajlar,
// backend'deki kurallarla da aynı (backend/validations/*.validation.ts). Her fonksiyon hata mesajı ya da undefined döner.
import type { ApiErrorBody } from '@/types/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Email is required.';
  if (!EMAIL_RE.test(value.trim())) return 'Please enter a valid email address.';
}

export function validateRequired(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required.`;
}

export function validateNewPassword(value: string): string | undefined {
  if (!value) return 'Password is required.';
  if (value.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
}

// { email: 'msg', password: undefined } → sadece hatalı alanlar kalır; boşsa form geçerli
export function compactErrors<T extends Record<string, string | undefined>>(errors: T): Partial<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Partial<T>;
}

// Sunucunun alan bazlı doğrulama hataları (422: { errors: [{ field, message }] }) → { alan: mesaj }.
// Mobildeki ApiError.fieldErrors'un karşılığı; alanı olmayan hatalar formun genel hata kutusunda kalır.
export function serverFieldErrors(error: unknown): Record<string, string> {
  const errors = (error as { data?: ApiErrorBody } | null | undefined)?.data?.errors ?? [];
  return Object.fromEntries(errors.filter((e) => e.field).map((e) => [e.field as string, e.message]));
}
