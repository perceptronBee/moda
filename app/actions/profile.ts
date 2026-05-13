"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export type ProfileUpdateResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// Demo amaçlı mock e-posta gönderim fonksiyonu
async function sendNotificationEmail(email: string | undefined, subject: string, message: string) {
  if (!email) return;
  console.log(`[E-POSTA GÖNDERİLDİ] Kime: ${email} | Konu: ${subject} | İçerik: ${message}`);
}

export async function updateName(
  _prev: ProfileUpdateResult | null,
  formData: FormData,
): Promise<ProfileUpdateResult> {
  const name = formData.get("name") as string;
  if (!name) return { ok: false, error: "Ad Soyad boş olamaz" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Giriş yapmalısın" };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  if (error) return { ok: false, error: "İsim güncellenemedi" };
  
  await sendNotificationEmail(user.email, "Profiliniz güncellendi", "Ad Soyad bilginiz başarıyla değiştirildi.");
  
  revalidatePath("/hesap");
  return { ok: true, message: "İsminiz başarıyla güncellendi ve size bir bilgilendirme e-postası gönderildi." };
}

export async function updateEmail(
  _prev: ProfileUpdateResult | null,
  formData: FormData,
): Promise<ProfileUpdateResult> {
  const email = formData.get("email") as string;
  if (!email) return { ok: false, error: "E-posta boş olamaz" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Giriş yapmalısın" };
  if (email === user.email) return { ok: true, message: "Mevcut e-posta adresinizi girdiniz, değişiklik yapılmadı." };
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { ok: false, error: "E-posta güncellenemedi, kullanılıyor olabilir." };
  
  // Supabase auth.updateUser zaten onay maili gönderir.
  return { ok: true, message: "Yeni e-posta adresinize bir onay bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin." };
}

export async function updatePhone(
  _prev: ProfileUpdateResult | null,
  formData: FormData,
): Promise<ProfileUpdateResult> {
  const phone = formData.get("phone") as string;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Giriş yapmalısın" };
  const { error } = await supabase.from("profiles").update({ phone }).eq("id", user.id);
  if (error) return { ok: false, error: "Telefon güncellenemedi" };

  await sendNotificationEmail(user.email, "İletişim bilgileriniz güncellendi", "Telefon numaranız başarıyla değiştirildi.");

  revalidatePath("/hesap");
  return { ok: true, message: "Telefon numaranız başarıyla güncellendi ve size bir bilgilendirme e-postası gönderildi." };
}

async function processImage(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return sharp(Buffer.from(arrayBuffer))
    .rotate() // EXIF orientation'ı uygula
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

export async function uploadUserPhoto(
  side: "front" | "back",
  formData: FormData,
): Promise<UploadResult> {
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
  } catch {
    return { ok: false, error: "Görsel işlenemedi" };
  }

  const path = `${user.id}/${side}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("user-photos")
    .upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (upErr) return { ok: false, error: "Yükleme başarısız" };

  const field =
    side === "front" ? "front_photo_path" : "back_photo_path";
  const updates: Record<string, unknown> = { [field]: path };
  if (side === "back") updates.back_is_ai_generated = false;

  await supabase.from("profiles").update(updates).eq("id", user.id);
  revalidatePath("/hesap");
  return { ok: true, path };
}

export async function getSignedPhotoUrl(
  path: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("user-photos")
    .createSignedUrl(path, 60 * 60); // 1 saat
  if (error || !data) return null;
  return data.signedUrl;
}

export async function requestAiBackGeneration(): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Önce giriş yap" };

  // İleride AI servisine kuyruğa atma noktası — şimdilik sadece flag set
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
