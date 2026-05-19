import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callVtonTryOn } from "@/lib/ai/vton";
import { rateLimitMulti, RATE_LIMITS } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/ip";

export const maxDuration = 300; // Lokal'de uzun süreli idm-vton için (Vercel Pro: 300sn, Hobby: 60sn ile sınırlı)
const ALLOW_DEV_ANON = process.env.NODE_ENV !== "production";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/ai/try-on
 *
 * Body (multipart/form-data):
 *   base_image: File (kullanıcının fotoğrafı)
 *   item_1, item_2, ... : File (giydirilecek ürünlerin fotoğrafı)
 *
 * Auth: Supabase oturum (giriş yapmış kullanıcı zorunlu)
 * Rate limit: kullanıcı başına dakikada 5 (AI fatura koruması)
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers) ?? "anon";

  // Auth (dev'de geçici anon kullanım serbest)
  let user: { id: string } | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    if (!ALLOW_DEV_ANON) {
      return NextResponse.json(
        { error: "Sistem yapılandırması eksik" },
        { status: 500 },
      );
    }
  }
  if (!user && !ALLOW_DEV_ANON) {
    return NextResponse.json({ error: "Önce giriş yap" }, { status: 401 });
  }

  // Rate limit — KATMANLI (Gemini API key bütçe koruması)
  //   1. dakikada 3   (bot spam)
  //   2. saatte 15    (kullanıcı başına makul üst sınır)
  //   3. günde 40     (~$10 Gemini bütçesi/user)
  //   4. saatte 120   (GLOBAL — tüm kullanıcıların toplam tavanı)
  //   5. günde 800    (GLOBAL — günlük API key bütçesi)
  const userScope = `tryon:user:${user?.id ?? `anon:${ip}`}`;
  const ipScope = `tryon:ip:${ip}`;
  const rl = rateLimitMulti([
    { key: `${userScope}:min`, config: RATE_LIMITS.tryonPerMinute },
    { key: `${ipScope}:min`, config: RATE_LIMITS.tryonPerMinute },
    { key: `${userScope}:hr`, config: RATE_LIMITS.tryonPerHour },
    { key: `${userScope}:day`, config: RATE_LIMITS.tryonPerDay },
    { key: `tryon:global:hr`, config: RATE_LIMITS.tryonGlobalPerHour },
    { key: `tryon:global:day`, config: RATE_LIMITS.tryonGlobalPerDay },
  ]);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `AI limiti aşıldı, ${rl.retryAfter} sn sonra dene` },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  // Form parse
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form" }, { status: 400 });
  }

  const baseImage = form.get("base_image");
  if (!(baseImage instanceof Blob) || baseImage.size === 0) {
    return NextResponse.json(
      { error: "base_image gerekli" },
      { status: 400 },
    );
  }

  // Item dosyalarını topla (item_1, item_2, ...)
  const items: Blob[] = [];
  let totalBytes = baseImage.size;
  for (let i = 1; i <= MAX_FILES; i++) {
    const v = form.get(`item_${i}`);
    if (!(v instanceof Blob)) continue;
    if (v.size === 0) continue;
    if (v.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `item_${i} 10MB'ı aşıyor` },
        { status: 413 },
      );
    }
    totalBytes += v.size;
    items.push(v);
  }
  if (items.length === 0) {
    return NextResponse.json(
      { error: "En az 1 item dosyası gerekli (item_1, item_2, ...)" },
      { status: 400 },
    );
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "Toplam dosya boyutu 30MB'ı aşıyor" },
      { status: 413 },
    );
  }

  // Mime type check
  for (const blob of [baseImage, ...items]) {
    if (!ALLOWED.has(blob.type)) {
      return NextResponse.json(
        { error: "JPG/PNG/WEBP dışı format kabul edilmiyor" },
        { status: 400 },
      );
    }
  }

  // Python servisine forward
  let result;
  try {
    result = await callVtonTryOn({
      baseImage,
      itemImages: items,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Python API Çağrısı Başarısız: " + (err.message || String(err)) },
      { status: 500 }
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 502 },
    );
  }

  // Result data URL'i base64 → tarayıcı render edebilir
  return NextResponse.json(
    { resultImage: result.resultDataUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
