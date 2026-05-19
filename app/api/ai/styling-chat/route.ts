import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { rateLimitMulti, RATE_LIMITS } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/ip";
import {
  PRODUCTS,
  getProductById,
  type Product,
  type ProductType,
} from "@/lib/products";
import { safeProductPhoto } from "@/lib/security/siteUrl";

export const maxDuration = 90; // Pro modeli için pay
const ALLOW_DEV_ANON = process.env.NODE_ENV !== "production";

const MAX_TEXT_LEN = 1000;
const MAX_HISTORY_TURNS = 12;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Env ile değiştirilebilir — Pro daha güçlü reasoning, Flash daha hızlı/ucuz
//   gemini-2.5-pro        → en iyi kalite (~5-15 sn, ~$0.04/req)
//   gemini-2.5-flash      → dengeli (~2-4 sn, ~$0.003/req)
//   gemini-2.5-flash-lite → en hızlı (~1-2 sn, ~$0.001/req)
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-pro";

// Gemini'ye gönderilen catalog subset — token bütçesini kontrol et
const MAX_CATALOG_ITEMS = 180;

function normalizeGeminiError(message: string): string {
  if (/API_KEY_INVALID|API key not valid/i.test(message)) {
    return "GEMINI_API_KEY gecersiz. Lutfen .env.local icine gecerli bir Gemini API key koy.";
  }
  if (/PERMISSION_DENIED|forbidden|not enabled/i.test(message)) {
    return "Gemini erisim izni yok. API key izinlerini ve Generative Language API ayarini kontrol et.";
  }
  if (/UNAVAILABLE|high demand|503/i.test(message)) {
    return "Gemini su anda yogun. Birazdan tekrar dene (sistem ayni modelde otomatik retry denedi).";
  }
  return message;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const base = 450 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(base + jitter, 3000);
}

function isTransientGeminiError(message: string): boolean {
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|timeout|socket hang up|UNAVAILABLE|high demand|503/i.test(
    message,
  );
}

/**
 * POST /api/ai/styling-chat
 *
 * Eğer arkadaşın Python pipeline'ı STYLING_API_URL'de canlıysa oraya proxy yapar
 * (CLIP retrieval + Gemini reasoning). Aksi takdirde Gemini 2.5 Flash'i doğrudan
 * çağırıp katalogdan structured JSON ile öneri alır.
 */
export async function POST(req: NextRequest) {
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
    return NextResponse.json(
      { error: "Önce giriş yapmalısın" },
      { status: 401 },
    );
  }

  // Rate limit
  const ip = getClientIp(req.headers) ?? "anon";
  const rl = rateLimitMulti([
    { key: `chat:user:${user?.id ?? `anon:${ip}`}:min`, config: RATE_LIMITS.aiRequest },
    { key: `chat:ip:${ip}:min`, config: RATE_LIMITS.aiRequest },
    { key: `chat:global:hr`, config: RATE_LIMITS.tryonGlobalPerHour },
  ]);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Limit aşıldı, ${rl.retryAfter} sn sonra dene` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // Form parse
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form" }, { status: 400 });
  }

  const userText =
    (form.get("user_text") as string | null)?.slice(0, MAX_TEXT_LEN) ?? "";
  if (!userText.trim()) {
    return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });
  }

  const historyRaw = (form.get("chat_history") as string | null) ?? "[]";
  let historyParsed: unknown;
  try {
    historyParsed = JSON.parse(historyRaw);
  } catch {
    return NextResponse.json(
      { error: "Geçersiz chat_history" },
      { status: 400 },
    );
  }
  if (!Array.isArray(historyParsed)) {
    return NextResponse.json(
      { error: "chat_history dizi olmalı" },
      { status: 400 },
    );
  }
  const sanitizedHistory: Array<{ role: "user" | "assistant"; content: string }> =
    (historyParsed as Array<unknown>)
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

  const imageBlob = form.get("image");
  if (imageBlob instanceof Blob) {
    if (imageBlob.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Görsel 8 MB'ı aşamaz" },
        { status: 413 },
      );
    }
    if (imageBlob.type && !ALLOWED_TYPES.has(imageBlob.type)) {
      return NextResponse.json(
        { error: "Sadece JPG/PNG/WEBP" },
        { status: 415 },
      );
    }
  }

  // Backend (arkadaşın FastAPI) deploy edildiyse oraya proxy
  const backendUrl = process.env.STYLING_API_URL;
  if (backendUrl) {
    return proxyToBackend(backendUrl, userText, sanitizedHistory, imageBlob);
  }

  // Yoksa direkt Gemini ile çalış
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY ayarlı değil — admin'e bildir" },
      { status: 500 },
    );
  }

  try {
    const result = await runGeminiStylist({
      apiKey,
      userText,
      history: sanitizedHistory,
      image: imageBlob instanceof Blob && imageBlob.size > 0 ? imageBlob : null,
    });
    return NextResponse.json(result);
  } catch (e) {
    const raw = (e as Error).message || "Stilist hatasi";
    const msg = normalizeGeminiError(raw);
    console.error("[styling-chat] gemini error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 502 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI — direkt RAG (catalog → prompt → structured JSON)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sen profesyonel bir AI moda stilistisin. Kullanıcı ile her zaman Türkçe ve samimi bir dille konuş.

KURALLAR:
1. Yalnızca sana verilen CATALOG listesindeki ID'lerden ürün önerebilirsin. Asla katalog dışı ürün uydurma.
2. Kullanıcının mesajı bir kombin/stil talebi değilse (selam, teşekkür, sohbet, alakasız konu) ürün önerme — kısa bir cevap ver ve kullanıcıyı modaya yönlendir.
3. Ürün önerirken her parçanın ID'sini "suggested_item_ids" dizisinde döndür. ai_response içinde ürün adlarını insanca yaz (LCW-xxxxx ID gösterme).
4. Bir kombinde 2-4 farklı kategoriden parça kullan (üst + alt + ayakkabı gibi). Aynı kategoriden 2 parça önerme.
5. Cinsiyet kuralı: kullanıcı ne istediğini her zaman söylüyor — verdiğin önerideki ürünler kullanıcının cinsiyetine uygun olmalı.
6. Renk uyumu, etkinlik bağlamı, mevsim — bunları dikkate al. Sadece adında "renkli" geçen ürünü seçmek yetmez; gerçekten o etkinliğe / havaya uygun mu bak.
7. Çıktın MUTLAKA verilen JSON şemasında olmalı. Başka bir şey yazma.`;

function buildCatalogContext(gender: "kadin" | "erkek"): string {
  // Gender'a göre filtrele + her kategoriden makul sayıda örnek
  const buckets: Record<ProductType, Product[]> = {
    "ust-giyim": [],
    "alt-giyim": [],
    "dis-giyim": [],
    ayakkabi: [],
    aksesuar: [],
  };
  for (const p of PRODUCTS) {
    if (p.gender !== gender || !p.photos?.front) continue;
    buckets[p.type]?.push(p);
  }

  // Her kategoriden N tane, toplam MAX_CATALOG_ITEMS'ı geçmesin
  const perCategory = Math.floor(MAX_CATALOG_ITEMS / 5);
  const flat: Product[] = [];
  for (const arr of Object.values(buckets)) {
    flat.push(...arr.slice(0, perCategory));
  }

  // Compact format: ID | type | name (renk + parça tipi name'in içinde zaten)
  return flat
    .map((p) => `${p.id}|${p.type}|${p.name}`)
    .join("\n");
}

function extractGender(
  history: Array<{ role: string; content: string }>,
  userText: string,
): "kadin" | "erkek" {
  const combined = [...history.map((h) => h.content), userText]
    .join("\n")
    .toLowerCase();
  if (/\b(erkeğim|erkegim|erkek için|bay\b)\b/.test(combined)) return "erkek";
  return "kadin";
}

async function imageToInlinePart(image: Blob) {
  const buf = Buffer.from(await image.arrayBuffer());
  const jpeg = await sharp(buf)
    .rotate()
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return {
    inlineData: {
      mimeType: "image/jpeg",
      data: jpeg.toString("base64"),
    },
  };
}

type StylistResult = {
  ai_response: string;
  suggested_items: EnrichedItem[];
  _via: "gemini" | "backend";
};

async function runGeminiStylist({
  apiKey,
  userText,
  history,
  image,
}: {
  apiKey: string;
  userText: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  image: Blob | null;
}): Promise<StylistResult> {
  const gender = extractGender(history, userText);
  const catalog = buildCatalogContext(gender);

  const ai = new GoogleGenAI({ apiKey });

  // Conversation history → Gemini Content formatı (greeting bubble'ı zaten history'de yok)
  const contents: Array<{
    role: "user" | "model";
    parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >;
  }> = [];

  for (const m of history) {
    contents.push({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    });
  }

  // Son user turn'ü: image (varsa) + text + catalog context
  const lastUserParts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];
  if (image) {
    lastUserParts.push(await imageToInlinePart(image));
    lastUserParts.push({
      text: "Yukarıdaki fotoğraftaki kıyafetimi/kıyafetini analiz et ve uyumlu kombin öner.",
    });
  }
  lastUserParts.push({
    text:
      `Kullanıcı mesajı: ${userText}\n` +
      `Kullanıcı cinsiyeti: ${gender}\n\n` +
      `CATALOG (yalnızca buradan ID seç — format: id|kategori|isim):\n${catalog}`,
  });
  contents.push({ role: "user", parts: lastUserParts });

  const baseConfig = {
    systemInstruction: SYSTEM_PROMPT,
    temperature: 0.6,
    responseMimeType: "application/json" as const,
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        ai_response: {
          type: Type.STRING,
          description:
            "Kullanıcıya dönecek Türkçe samimi cevap. Ürün adlarını insanca yaz, ID gösterme.",
        },
        suggested_item_ids: {
          type: Type.ARRAY,
          description:
            "Önerilen ürünlerin ID'leri (catalog'tan birebir). Sohbet/selamlama ise boş dizi.",
          items: { type: Type.STRING },
        },
      },
      required: ["ai_response", "suggested_item_ids"],
    },
  };

  let result: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          ...baseConfig,
          maxOutputTokens: 420,
        },
      });
      lastError = null;
      break;
    } catch (err) {
      const e = err as Error;
      lastError = e;
      if (!isTransientGeminiError(e.message) || attempt === 3) break;
      await sleep(backoffMs(attempt));
    }
  }

  if (!result) {
    throw lastError ?? new Error("Gemini yanit uretemedi");
  }

  const text = result.text ?? "";
  let parsed: { ai_response?: unknown; suggested_item_ids?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini geçersiz JSON döndü");
  }

  const aiResponse =
    typeof parsed.ai_response === "string"
      ? parsed.ai_response
      : "Üzgünüm, şu an cevap üretemiyorum.";
  const rawIds = Array.isArray(parsed.suggested_item_ids)
    ? (parsed.suggested_item_ids.filter((x) => typeof x === "string") as string[])
    : [];

  // ID'leri katalogdan zenginleştir + cinsiyet uyumsuzlarını ele
  const enriched: EnrichedItem[] = [];
  const seen = new Set<string>();
  for (const id of rawIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const p = getProductById(id);
    if (!p) continue;
    if (p.gender !== gender) continue; // güvenlik: yanlış gender'a düşmesin
    enriched.push({
      id: p.id,
      name: p.name,
      price: p.price,
      type: p.type,
      gender: p.gender,
      photo: safeProductPhoto(p.photos?.garmentFront || p.photos?.front),
      deeplink: p.deeplink ?? null,
    });
    if (enriched.length >= 6) break;
  }

  return {
    ai_response: aiResponse,
    suggested_items: enriched,
    _via: "gemini",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND PROXY (arkadaşın FastAPI'si)
// ─────────────────────────────────────────────────────────────────────────────

async function proxyToBackend(
  backendUrl: string,
  userText: string,
  history: Array<{ role: string; content: string }>,
  imageBlob: FormDataEntryValue | null,
) {
  const backendForm = new FormData();
  backendForm.append("user_text", userText);
  backendForm.append("chat_history", JSON.stringify(history));
  if (imageBlob instanceof Blob && imageBlob.size > 0) {
    backendForm.append("image", imageBlob, "user_image.jpg");
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
      console.error(
        "[styling-chat] backend error",
        res.status,
        text.slice(0, 200),
      );
      return NextResponse.json(
        { error: `Stilist servisi yanıt vermedi (${res.status})` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const enriched = Array.isArray(data?.suggested_items)
      ? data.suggested_items.map(enrichBackendItem).filter(Boolean)
      : [];

    return NextResponse.json({
      ai_response: typeof data?.ai_response === "string" ? data.ai_response : "",
      suggested_items: enriched,
      _via: "backend",
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

function enrichBackendItem(raw: unknown): EnrichedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;
  const product = getProductById(id);
  return {
    id,
    name: typeof r.name === "string" ? r.name : product?.name ?? id,
    price: product?.price ?? null,
    type: product?.type ?? (typeof r.class === "string" ? r.class : null),
    gender: product?.gender ?? (typeof r.gender === "string" ? r.gender : null),
    photo: safeProductPhoto(
      product?.photos?.garmentFront || product?.photos?.front,
    ),
    deeplink:
      typeof r.deeplink === "string" ? r.deeplink : product?.deeplink ?? null,
    similarity_score:
      typeof r.similarity_score === "number" ? r.similarity_score : undefined,
    colors: Array.isArray(r.colors)
      ? (r.colors as Array<Record<string, unknown>>)
          .filter(
            (c) => typeof c.hex === "string" && typeof c.percentage === "number",
          )
          .slice(0, 3)
          .map((c) => ({
            hex: c.hex as string,
            percentage: c.percentage as number,
          }))
      : undefined,
  };
}
