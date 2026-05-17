import { z } from "zod";

// Şifre kompleksite şeması — ReDoS önleme için max length 128 zorunlu
const PasswordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .max(128, "Şifre en fazla 128 karakter olabilir")
  .regex(/[A-Z]/, "En az bir büyük harf içermeli")
  .regex(/[a-z]/, "En az bir küçük harf içermeli")
  .regex(/[0-9]/, "En az bir rakam içermeli")
  .regex(
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/,
    "En az bir özel karakter içermeli (!@#$% gibi)",
  );

export const SignupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı")
    .max(100, "Ad soyad çok uzun"),
  email: z.string().email("Geçerli bir e-posta gir").max(254),
  password: PasswordSchema,
  kvkk: z.string().refine((v) => v === "on", {
    message: "KVKK metnini onaylamalısın",
  }),
});

export const LoginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta gir").max(254),
  password: z.string().min(1, "Şifre gerekli").max(128),
});

export const ResetRequestSchema = z.object({
  email: z.string().email("Geçerli bir e-posta gir").max(254),
});

export const ResetSchema = z.object({
  password: PasswordSchema,
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
