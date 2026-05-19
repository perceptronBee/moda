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
    return NextResponse.json(mockChatResponse(userText, sanitizedHistory));
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
 * Önce intent detect: kullanıcı sohbet mi ediyor yoksa öneri mi istiyor?
 * - SOHBET → moda dışı/küçük konuşma → ürün döndürme, modaya yönlendir
 * - OFF-TOPIC → "ben moda stilistiyim" cevabı
 * - ARAMA → keyword-eşleştir, kategoriden ürün dön
 */

const GREETING_PATTERNS = [
  /\b(merhaba|selam|selamlar|naber|nbr|ne haber|nasılsın|nasılsin|nasilsin|iyimisin|iyi misin|hey|hi|hello|hola|sa|aleyküm|aleykum|günaydın|gunaydin|akşamlar|aksamlar|tünaydın|gece)\b/i,
];

const ACK_PATTERNS = [
  /^\s*(teşekkür|tesekkur|sağol|sagol|saol|saolasın|thanks|ty|tnx|ok|tamam|peki|anladım|anladim|harika|süper|super|olur|yes|yok|hayır|hayir|no)[\s.!?]*$/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(kimsin|nesin|ne yapıyorsun|adın ne|hava nasıl|hava durumu|yemek|tarif|haber|maç|futbol|şarkı|film|dizi|kitap|tatil|tatile|cumhurba|seçim|sınav|matematik|kod|python|javascript|whatsapp|instagram)\b/i,
];

function detectIntent(text: string): "greeting" | "ack" | "off_topic" | "search" {
  const t = text.trim();
  if (!t) return "search"; // boş → varsayılan
  if (ACK_PATTERNS.some((p) => p.test(t))) return "ack";
  if (GREETING_PATTERNS.some((p) => p.test(t))) return "greeting";
  if (OFF_TOPIC_PATTERNS.some((p) => p.test(t))) return "off_topic";
  return "search";
}

function extractGenderFromHistory(
  history: Array<{ role: string; content: string }>,
): "kadin" | "erkek" {
  for (let i = history.length - 1; i >= 0; i--) {
    const c = history[i].content.toLowerCase();
    if (/\b(erkeğim|erkegim|erkek|bay\b|adam)\b/.test(c)) return "erkek";
    if (/\b(kadınım|kadinim|kadın|kadin|bayan|kız|kiz)\b/.test(c)) return "kadin";
  }
  return "kadin"; // default
}

// Deterministik shuffle — aynı seed aynı sıra üretir
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mockChatResponse(
  userText: string,
  history: Array<{ role: string; content: string }>,
) {
  const intent = detectIntent(userText);

  if (intent === "greeting") {
    return {
      ai_response:
        "Selam! Ben bir AI moda stilistiyim, sana uygun kombin önerileri sunabilirim. Nereye gidiyorsun, nasıl bir tarz istersin? Mesela 'yağmurlu hava için' veya 'ofise uygun' diyebilirsin.",
      suggested_items: [],
      vision_debug: null,
      _mock: true,
      _intent: intent,
    };
  }

  if (intent === "ack") {
    return {
      ai_response:
        "Başka bir kombin önermemi ister misin? Tarz ya da etkinlik söyle, ona göre çıkarayım.",
      suggested_items: [],
      vision_debug: null,
      _mock: true,
      _intent: intent,
    };
  }

  if (intent === "off_topic") {
    return {
      ai_response:
        "Ben bir AI moda stilistiyim, sadece kıyafet ve kombin önerileri konusunda yardımcı olabilirim. Hangi tür bir kombin arıyorsun? Yağmurlu hava, ofis, düğün, spor — ne istersen söyle.",
      suggested_items: [],
      vision_debug: null,
      _mock: true,
      _intent: intent,
    };
  }

  // ── ARAMA: kombin öneri akışı ──
  const lowered = userText.toLowerCase();
  const gender = extractGenderFromHistory(history);

  // Kullanıcı belirli kategori istediyse onları kullan
  const requestedCategories: string[] = [];
  if (/üst\s*giy|tişört|gömlek|sweat|bluz/i.test(lowered))
    requestedCategories.push("ust-giyim");
  if (/alt\s*giy|pantolon|jean|şort|etek/i.test(lowered))
    requestedCategories.push("alt-giyim");
  if (/dış\s*giy|mont|kaban|ceket|yağmurluk/i.test(lowered))
    requestedCategories.push("dis-giyim");
  if (/ayakkabı|bot|spor ayakkabı|sneaker/i.test(lowered))
    requestedCategories.push("ayakkabi");

  const intentMap: Array<{ patterns: RegExp[]; types: string[]; label: string }> = [
    { patterns: [/yağmur|yağışlı/], types: ["dis-giyim", "alt-giyim", "ayakkabi"], label: "yağmurlu hava" },
    { patterns: [/kış|kar|soğuk/], types: ["dis-giyim", "ust-giyim", "alt-giyim"], label: "kışlık" },
    { patterns: [/düğün|davet|özel|şık|akşam/], types: ["ust-giyim", "alt-giyim"], label: "şık" },
    { patterns: [/spor|koş|fitness|antren/], types: ["ust-giyim", "alt-giyim", "ayakkabi"], label: "sportif" },
    { patterns: [/iş|ofis|toplantı/], types: ["ust-giyim", "alt-giyim"], label: "iş" },
    { patterns: [/yaz|sıcak|plaj|deniz/], types: ["ust-giyim", "alt-giyim"], label: "yazlık" },
    { patterns: [/kampüs|üniversite|okul/], types: ["ust-giyim", "alt-giyim", "ayakkabi"], label: "kampüs" },
    { patterns: [/renkli|canlı|şen/], types: ["ust-giyim", "alt-giyim", "ayakkabi"], label: "renkli" },
    { patterns: [/günlük|rahat|gündelik/], types: ["ust-giyim", "alt-giyim"], label: "günlük" },
  ];

  const matched = intentMap.find((i) => i.patterns.some((p) => p.test(lowered)));
  const types =
    requestedCategories.length > 0
      ? requestedCategories
      : matched?.types ?? ["ust-giyim", "alt-giyim", "ayakkabi"];

  // Deterministik shuffle ile her query farklı sonuç versin —
  // ama aynı query aynı sonuç (cacheable). Seed: userText + gender + history length
  const seed =
    [...userText].reduce((s, c) => s + c.charCodeAt(0), 0) +
    history.length * 31 +
    (gender === "erkek" ? 7 : 11);

  const items: EnrichedItem[] = [];
  for (const t of types) {
    const pool = PRODUCTS.filter(
      (p) => p.type === t && p.gender === gender && p.photos?.front,
    );
    if (pool.length === 0) continue;
    const shuffled = seededShuffle(pool, seed + t.length * 13);
    const p = shuffled[0];
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

  // Cevap metnini items'a göre dinamik ve doğal kur — hard-coded suffix yok
  let aiResponse: string;
  if (items.length === 0) {
    aiResponse = "Bu istek için katalogda uygun ürün bulamadım. Başka bir tarz veya kategori söyler misin?";
  } else if (items.length === 1) {
    aiResponse = `${matched ? matched.label.charAt(0).toUpperCase() + matched.label.slice(1) + " için" : "Sana"} ${items[0].name} önerebilirim. Eşlik edecek başka parça istersen söyle.`;
  } else {
    const labelPart = matched
      ? `${matched.label.charAt(0).toUpperCase() + matched.label.slice(1)} bir kombin için`
      : "Sana uygun bir kombin için";
    const namesList =
      items.length === 2
        ? `${items[0].name} ve ${items[1].name}`
        : `${items.slice(0, -1).map((i) => i.name).join(", ")} ve ${items[items.length - 1].name}`;
    aiResponse = `${labelPart} ${namesList} birlikte güzel duruyor. Beğenmediğin parça olursa söyle, alternatif önereyim.`;
  }

  return {
    ai_response: aiResponse,
    suggested_items: items,
    vision_debug: null,
    _mock: true,
    _intent: intent,
  };
}
