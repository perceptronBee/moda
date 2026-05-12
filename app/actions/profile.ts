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
