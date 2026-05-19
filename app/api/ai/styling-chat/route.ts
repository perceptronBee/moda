import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitMulti, RATE_LIMITS } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/ip";
import { PRODUCTS, getProductById } from "@/lib/products";
import { safeProductPhoto } from "@/lib/security/siteUrl";

export const maxDuration = 60;

const MAX_TEXT_LEN = 1000;
const MAX_HISTORY_TURNS = 12;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Chat-style styling assistant.
 *
 * Vercel'den arkadaşın Pipeline FastAPI'sine proxy yapar.
 * STYLING_API_URL env'i ngrok URL'ini gösterir (örn https://abc.ngrok-free.app).
 * URL yoksa veya patliyorsa, demo kırılmasın diye basit bir mock cevap döner.
 *
 * Request (multipart/form-data):
 *   user_text: string
 *   chat_history: string (JSON [{role, content}, ...])
 *   image: File (opsiyonel)
 *
 * Response (JSON):
 *   {
 *     ai_response: string (Türkçe),
 *     suggested_items: Array<{id, name, deeplink, similarity_score, photo?, price?, ...}>,
 *     vision_debug?: any[],
 *   }
 */
export async function POST(req: NextRequest) {
  // ── Auth zorunlu (Gemini bütçe + kişiselleştirme) ──
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Sistem yapılandırması eksik" },
      { status: 500 },
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Önce giriş yapmalısın" },
      { status: 401 },
    );
  }

  // ── Rate limit (Gemini her chat turn'inde de çağrılıyor → koruma şart) ──
  const ip = getClientIp(req.headers) ?? "anon";
  const scope = user.id;
  const rl = rateLimitMulti([
    { key: `chat:user:${scope}:min`, config: RATE_LIMITS.aiRequest },
    { key: `chat:ip:${ip}:min`, config: RATE_LIMITS.aiRequest },
    { key: `chat:global:hr`, config: RATE_LIMITS.tryonGlobalPerHour },
  ]);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Limit aşıldı, ${rl.retryAfter} sn sonra dene` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // ── Form parse + validate ──
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form" }, { status: 400 });
  }

  const userText = (form.get("user_text") as string | null)?.slice(0, MAX_TEXT_LEN) ?? "";
  if (!userText.trim()) {
    return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });
  }

  const historyRaw = (form.get("chat_history") as string | null) ?? "[]";
  let historyParsed: unknown;
  try {
    historyParsed = JSON.parse(historyRaw);
  } catch {
    return NextResponse.json({ error: "Geçersiz chat_history" }, { status: 400 });
  }
  if (!Array.isArray(historyParsed)) {
    return NextResponse.json({ error: "chat_history dizi olmalı" }, { status: 400 });
  }
  // History'i sanitize et: son N tur, sadece role + content
  const sanitizedHistory = historyParsed
    .filter(
      (m): m is { role: string; content: string } =>
        m !== null &&
        typeof m === "object" &&
        typeof (m as { role?: unknown }).role === "string" &&
        typeof (m as { content?: unknown }).content === "string",
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content.slice(0, MAX_TEXT_LEN),
    }));

  const image = form.get("image");
  if (image instanceof Blob) {
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Görsel 8 MB'ı aşamaz" }, { status: 413 });
    }
    if (image.type && !ALLOWED_TYPES.has(image.type)) {
      return NextResponse.json({ error: "Sadece JPG/PNG/WEBP" }, { status: 415 });
    }
  }

  // ── Backend'e proxy ──
  const backendUrl = process.env.STYLING_API_URL;

  if (!backendUrl) {
    // Backend deploy edilmediyse → demo kırılmasın diye basit deterministik mock
    return NextResponse.json(mockChatResponse(userText));
  }

  // Forward to backend
  const backendForm = new FormData();
  backendForm.append("user_text", userText);
  backendForm.append("chat_history", JSON.stringify(sanitizedHistory));
  if (image instanceof Blob && image.size > 0) {
    backendForm.append("image", image, "user_image.jpg");
  }

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 55_000);

    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      body: backendForm,
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[styling-chat] backend error", res.status, text.slice(0, 200));
      return NextResponse.json(
        { error: `Stilist servisi şu an yanıt vermiyor (${res.status})` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // Enrich suggested_items with our catalog data (photo, price, type)
    // — backend sadece id + deeplink + name döndürüyor olabilir
    const enriched = Array.isArray(data?.suggested_items)
      ? data.suggested_items.map(enrichItem).filter(Boolean)
      : [];

    return NextResponse.json({
      ai_response: typeof data?.ai_response === "string" ? data.ai_response : "",
      suggested_items: enriched,
      vision_debug: data?.vision_debug ?? null,
    });
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "Zaman aşımı" : (e as Error).message;
    console.error("[styling-chat] proxy error", msg);
    return NextResponse.json(
      { error: `Bağlantı hatası: ${msg}` },
      { status: 502 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
type EnrichedItem = {
  id: string;
  name: string;
  price: number | null;
  type: string | null;
  gender: string | null;
  photo: string | null;
  deeplink: string | null;
  similarity_score?: number;
  colors?: Array<{ hex: string; percentage: number }>;
};

function enrichItem(raw: unknown): EnrichedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;

  // Catalog'tan tam ürünü çek (foto + fiyat lazım)
  const product = getProductById(id);

  return {
    id,
    name:
      typeof r.name === "string"
        ? r.name
        : product?.name ?? id,
    price: product?.price ?? null,
    type: product?.type ?? (typeof r.class === "string" ? r.class : null),
    gender: product?.gender ?? (typeof r.gender === "string" ? r.gender : null),
    photo: safeProductPhoto(
      product?.photos?.garmentFront || product?.photos?.front,
    ),
    deeplink:
      typeof r.deeplink === "string"
        ? r.deeplink
        : product?.deeplink ?? null,
    similarity_score:
      typeof r.similarity_score === "number" ? r.similarity_score : undefined,
    colors: Array.isArray(r.colors)
      ? (r.colors as Array<Record<string, unknown>>)
          .filter(
            (c) =>
              typeof c.hex === "string" && typeof c.percentage === "number",
          )
          .slice(0, 3)
          .map((c) => ({
            hex: c.hex as string,
            percentage: c.percentage as number,
          }))
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Backend yokken kullanılan mock — demo akışı yine de gösterilir.
 * Kullanıcı'nın metnine göre keyword match'le ürün seçer.
 */
function mockChatResponse(userText: string) {
  const lowered = userText.toLowerCase();

  // Basit intent → kategori eşleme
  const intentMap: Array<{ patterns: RegExp[]; types: string[]; label: string }> = [
    { patterns: [/yağmur|kar|kış|soğuk/], types: ["dis-giyim", "ayakkabi"], label: "yağmurlu/soğuk hava" },
    { patterns: [/düğün|davet|özel|şık/], types: ["ust-giyim", "alt-giyim"], label: "şık" },
    { patterns: [/spor|koş|fitness|rahat/], types: ["ust-giyim", "alt-giyim", "ayakkabi"], label: "sportif" },
    { patterns: [/iş|ofis|toplantı/], types: ["ust-giyim", "alt-giyim"], label: "iş" },
    { patterns: [/yaz|sıcak|plaj|deniz/], types: ["ust-giyim", "alt-giyim"], label: "yazlık" },
  ];

  const matched = intentMap.find((i) => i.patterns.some((p) => p.test(lowered)));
  const types = matched?.types ?? ["ust-giyim", "alt-giyim"];

  // İlgili kategorilerden ilk birkaç ürün
  const items: EnrichedItem[] = [];
  for (const t of types) {
    const p = PRODUCTS.find((p) => p.type === t && p.photos?.front);
    if (p) {
      items.push({
        id: p.id,
        name: p.name,
        price: p.price,
        type: p.type,
        gender: p.gender,
        photo: safeProductPhoto(p.photos?.garmentFront || p.photos?.front),
        deeplink: p.deeplink ?? null,
      });
    }
  }

  const aiResponse = matched
    ? `${matched.label.charAt(0).toUpperCase() + matched.label.slice(1)} bir kombin için şunları öneriyorum. ${items[0]?.name} ile ${items[1]?.name} birbirine çok yakışır — kemerli görünüm istersen üstüne bir mont da ekleyebilirsin.`
    : `Senin için katalogdan birkaç parça çıkardım. ${items.map((i) => i.name).join(", ")} bir araya gelince hoş bir kombin oluşturuyor. Daha spesifik bir şey istersen (örneğin "ofise uygun" veya "yağmurlu hava için") söyle, ona göre öneririm.`;

  return {
    ai_response: aiResponse,
    suggested_items: items,
    vision_debug: null,
    _mock: true,
  };
}
