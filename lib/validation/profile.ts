import { z } from "zod";

export const NameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter")
    .max(100, "Ad soyad çok uzun")
    .regex(/^[\p{L}\p{M}\s'\-.]+$/u, "Geçersiz karakter"),
});

export const PhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+?90)?\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/,
      "Geçerli bir Türkiye cep telefonu gir (örn: 5XX XXX XX XX)",
    )
    .max(20),
});

export const EmailUpdateSchema = z.object({
  email: z.string().email("Geçerli bir e-posta gir").max(254),
  password: z.string().min(1, "Mevcut şifre gerekli").max(200),
});

export const PHOTO_SLOTS = ["front", "back"] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
