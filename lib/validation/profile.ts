import { z } from "zod";

/**
 * Zalgo / kombine işaret saldırısı koruması — birleştirici karakterleri (`\p{M}`)
 * reddet. Karakter setini sadece "harf + boşluk + ' - ." ile sınırla.
 */
export const NameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter")
    .max(100, "Ad soyad çok uzun")
    .regex(/^[\p{L}\s'\-.]+$/u, "Geçersiz karakter")
    .refine((v) => !/\p{M}/u.test(v), {
      message: "Geçersiz karakter (kombine işaret)",
    }),
});

/**
 * Telefon — TR cep: 5XX XXX XX XX
 * Veritabanına `+905XXXXXXXXX` formatında normalize edilir.
 */
const PHONE_RE = /^(\+?90)?\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2}$/;

export function normalizePhone(input: string): string {
  // Sadece rakam bırak
  const digits = String(input).replace(/[^\d]/g, "");
  // Türkiye kodu yoksa ekle
  if (digits.length === 10 && digits.startsWith("5")) return `+90${digits}`;
  if (digits.length === 11 && digits.startsWith("05"))
    return `+90${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("905"))
    return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("+905"))
    return digits;
  return `+${digits}`;
}

export const PhoneSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(PHONE_RE, "Geçerli bir Türkiye cep telefonu gir (5XX XXX XX XX)"),
  })
  .transform((d) => ({ phone: normalizePhone(d.phone) }));

export const EmailUpdateSchema = z.object({
  email: z.string().email("Geçerli bir e-posta gir").max(254),
  password: z.string().min(1, "Mevcut şifre gerekli").max(200),
});

export const PHOTO_SLOTS = ["front", "back"] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
