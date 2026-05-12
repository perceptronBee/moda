"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  SignupSchema,
  LoginSchema,
  ResetRequestSchema,
  ResetSchema,
} from "@/lib/validation/auth";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fieldErrorsFromZod(
  err: import("zod").ZodError,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export async function signup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Form bilgilerini kontrol et",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const { fullName, email, password } = parsed.data;
  const supabase = await createClient();
  const reqHeaders = await headers();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? `http://${reqHeaders.get("host")}`;
  const ip =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    reqHeaders.get("x-real-ip") ??
    null;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/hesap/foto-yukle`,
    },
  });
  if (error) {
    return { ok: false, error: "Kayıt başarısız oldu. Lütfen tekrar dene." };
  }

  // E-posta verify gerekiyorsa user var ama session yok.
  // profiles satırını user_id ile yarat (signUp sonrası anon session olabilir; insert RLS auth.uid()=id ister)
  // E-mail confirm kapalıysa session anında verilir; açıksa profil callback'te oluşturulur.
  if (data.user && data.session) {
    await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      kvkk_accepted_at: new Date().toISOString(),
      kvkk_ip: ip,
    });
  }
  redirect("/kayit/dogrula");
}

export async function login(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "E-posta veya şifre geçersiz",
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: "E-posta veya şifre geçersiz" };
  }
  const next = (formData.get("next") as string) || "/";
  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = ResetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "Geçerli bir e-posta gir" };
  }
  const supabase = await createClient();
  const reqHeaders = await headers();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? `http://${reqHeaders.get("host")}`;
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/sifre-yenile`,
  });
  // Her zaman ok dön — e-mail enumeration engellemek için
  return { ok: true };
}

export async function updatePassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = ResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Şifre kuralları sağlanmıyor",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: "Şifre güncellenemedi" };
  redirect("/hesap");
}
