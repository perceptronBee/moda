import { z } from "zod";

export const SignupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı")
    .max(100, "Ad soyad çok uzun"),
  email: z.string().email("Geçerli bir e-posta gir"),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .regex(/[A-Z]/, "En az bir büyük harf içermeli")
    .regex(/[0-9]/, "En az bir rakam içermeli"),
  kvkk: z.string().refine((v) => v === "on", {
    message: "KVKK metnini onaylamalısın",
  }),
});

export const LoginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta gir"),
  password: z.string().min(1, "Şifre gerekli"),
});

export const ResetRequestSchema = z.object({
  email: z.string().email("Geçerli bir e-posta gir"),
});

export const ResetSchema = z.object({
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalı")
    .regex(/[A-Z]/, "En az bir büyük harf içermeli")
    .regex(/[0-9]/, "En az bir rakam içermeli"),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
