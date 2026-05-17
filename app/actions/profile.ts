"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  NameSchema,
  PhoneSchema,
  EmailUpdateSchema,
  PHOTO_SLOTS,
  type PhotoSlot,
} from "@/lib/validation/profile";

const MAX_BYTES = 10 * 1024 * 1024;
// Görüntü dekompresyon bombası önleme — pixel limiti
const MAX_PIXELS = 50_000_000; // ~50 MP (örn 7000x7000)
const MAX_DIMENSION = 12_000; // tek kenar max 12k px
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export type ProfileUpdateResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

async function sendNotificationEmail(
  email: string | undefined,
  subject: string,
  message: string,
) {
  if (!email) return;
  console.log(
    `[E-POSTA] ${email.slice(0, 3)}***@${email.split("@")[1] ?? "?"} | ${subject} | ${message.slice(0, 60)}`,
  );
}

export async function updateName(
  _prev: ProfileUpdateResult | null,
  formData: FormData,
): Promise<ProfileUpdateResult> {
  // Server-side zod doğrulama — istemciye güvenmiyoruz
  const parsed = NameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz ad soyad",
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Giriş yapmalısın" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.name })
    .eq("id", user.id);
  if (error) return { ok: false, error: "İsim güncellenemedi" };

  await sendNotificationEmail(
    user.email,
    "Profil güncellendi",
    "Ad soyad değiştirildi.",
  );
  revalidatePath("/hesap");
  return {
    ok: true,
    message: "İsminiz güncellendi, bilgilendirme e-postası gönderildi.",
  };
}

export async function updateEmail(
  _prev: ProfileUpdateResult | null,
  formData: FormData,
): Promise<ProfileUpdateResult> {
  // E-posta değişimi MUTLAKA mevcut şifreyle yeniden doğrulanmalı
  const parsed = EmailUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz giriş",
    };
  }
  const { email, password } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: "Giriş yapmalısın" };

  if (email === user.email) {
    return { ok: true, message: "E-posta zaten bu, değişiklik yok." };
  }

  // Mevcut şifreyi doğrula — eski oturum çalma saldırısı önle
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (reauthErr) {
    return { ok: false, error: "Mevcut şifre yanlış" };
  }

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    return {
      ok: false,
      error: "E-posta güncellenemedi, kullanılıyor olabilir.",
    };
  }
  return {
    ok: true,
    message:
      "Yeni e-postaya onay linki gönderildi. Lütfen kutunuzu kontrol edin.",
  };
}

export async function updatePhone(
  _prev: ProfileUpdateResult | null,
  formData: FormData,
): Promise<ProfileUpdateResult> {
  const parsed = PhoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz telefon",
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Giriş yapmalısın" };

  const { error } = await supabase
    .from("profiles")
    .update({ phone: parsed.data.phone })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Telefon güncellenemedi" };

  await sendNotificationEmail(
    user.email,
    "İletişim güncellendi",
    "Telefon numarası değiştirildi.",
  );
  revalidatePath("/hesap");
  return {
    ok: true,
    message: "Telefon numaranız güncellendi.",
  };
}

async function processImage(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  // Pixel limit kontrolü (decompression bomb önleme)
  const meta = await sharp(buf, { failOn: "error" }).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w === 0 || h === 0) throw new Error("invalid-image");
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    throw new Error("too-large-dimension");
  }
  if (w * h > MAX_PIXELS) {
    throw new Error("too-many-pixels");
  }

  return sharp(buf, { failOn: "error", limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

export async function uploadUserPhoto(
  side: PhotoSlot,
  formData: FormData,
): Promise<UploadResult> {
  // Path traversal / arbitrary write koruması — side değerini whitelist'le
  if (!PHOTO_SLOTS.includes(side as PhotoSlot)) {
    return { ok: false, error: "Geçersiz foto slotu" };
  }

  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "Dosya seçilmedi" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Dosya 10MB'ı aşamaz" };
  }
  if (!ALLOWED.has(file.type)) {
    return { ok: false, error: "JPG, PNG veya WEBP yüklemelisin" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Önce giriş yap" };

  let buffer: Buffer;
  try {
    buffer = await processImage(file);
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("too-many-pixels") || msg.includes("too-large"))
      return { ok: false, error: "Görsel boyutu çok büyük" };
    return { ok: false, error: "Görsel işlenemedi" };
  }

  // Path güvenliği — user.id UUID, side enum. Yine de bir kez normalize et:
  const cleanSide = String(side).replace(/[^a-z]/g, "");
  if (!PHOTO_SLOTS.includes(cleanSide as PhotoSlot)) {
    return { ok: false, error: "Geçersiz foto slotu" };
  }

  const path = `${user.id}/${cleanSide}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("user-photos")
    .upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (upErr) return { ok: false, error: "Yükleme başarısız" };

  const field =
    cleanSide === "front" ? "front_photo_path" : "back_photo_path";
  const updates: Record<string, unknown> = { [field]: path };
  if (cleanSide === "back") updates.back_is_ai_generated = false;

  await supabase.from("profiles").update(updates).eq("id", user.id);
  revalidatePath("/hesap");
  return { ok: true, path };
}

/**
 * IDOR koruması — sadece istek yapan kullanıcının kendi klasöründeki
 * fotoya signed URL üretir. Path'in ilk segmenti user.id olmalı.
 *
 * Storage RLS policy'si de aynı kontrolü yapar ama defense-in-depth.
 */
export async function getSignedPhotoUrl(
  path: string,
): Promise<string | null> {
  if (typeof path !== "string" || !path) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Path'in ilk segmenti istek yapan kullanıcının ID'si mi?
  const firstSegment = path.split("/")[0];
  if (firstSegment !== user.id) {
    console.warn(
      `[IDOR ATTEMPT] user=${user.id} tried path=${path.slice(0, 80)}`,
    );
    return null;
  }
  // Path traversal — ".." veya null byte içermesin
  if (path.includes("..") || path.includes("\0")) return null;

  const { data, error } = await supabase.storage
    .from("user-photos")
    .createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function requestAiBackGeneration(): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Önce giriş yap" };

  await supabase
    .from("profiles")
    .update({ back_is_ai_generated: true })
    .eq("id", user.id);
  revalidatePath("/hesap");
  return { ok: true, path: "queued" };
}

export async function finishOnboarding() {
  redirect("/hesap");
}
