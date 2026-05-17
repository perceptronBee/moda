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
import { getSiteUrl, safeNextPath } from "@/lib/security/siteUrl";
import { getClientIp } from "@/lib/security/ip";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";

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

// Rate-limit key: trusted IP varsa onu, yoksa cookie ID hash'ini kullan.
// Header'a güvenmeyiz; en kötü ihtimalle "anonymous" bucket'a düşer.
async function rateLimitKey(prefix: string, email?: string): Promise<string> {
  const reqHeaders = await headers();
  const ip = getClientIp(reqHeaders);
  // E-posta ile birlikte hash — aynı kullanıcının kaba kuvvet denemesini yakala
  const emailKey = email ? `:${email.toLowerCase().slice(0, 64)}` : "";
  return `${prefix}:${ip ?? "anon"}${emailKey}`;
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

  // Rate limit — saatte 5 kayıt isteği
  const limit = rateLimit(
    await rateLimitKey("signup", email),
    RATE_LIMITS.signup,
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: `Çok fazla kayıt denemesi. ${Math.ceil(limit.retryAfter / 60)} dakika sonra tekrar dene.`,
    };
  }

  const supabase = await createClient();
  const reqHeaders = await headers();
  const siteUrl = getSiteUrl(); // GÜVENLİ — host header DEĞİL
  const ip = getClientIp(reqHeaders); // güvenilir IP veya null

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
    return { ok: false, error: "E-posta veya şifre geçersiz" };
  }

  // Rate limit — 15dk'da 8 deneme (IP + email kombo)
  const limit = rateLimit(
    await rateLimitKey("login", parsed.data.email),
    RATE_LIMITS.login,
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: `Çok fazla başarısız deneme. ${Math.ceil(limit.retryAfter / 60)} dakika sonra tekrar dene.`,
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

  // Open redirect koruması — sadece internal path
  const next = safeNextPath(formData.get("next"), "/");
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

  // Rate limit — e-mail bombing önle
  const limit = rateLimit(
    await rateLimitKey("reset", parsed.data.email),
    RATE_LIMITS.passwordReset,
  );
  if (!limit.ok) {
    // E-mail enumeration sızdırmamak için ok dön ama gönderme
    return { ok: true };
  }

  const supabase = await createClient();
  const siteUrl = getSiteUrl();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/sifre-yenile`,
  });
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
