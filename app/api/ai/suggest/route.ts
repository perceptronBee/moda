import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  PRODUCTS,
  getProductById,
  type Product,
  type Gender,
  type ProductType,
} from "@/lib/products";
import { safeProductPhoto } from "@/lib/security/siteUrl";
import { rateLimitMulti, RATE_LIMITS } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/ip";

export const maxDuration = 30;

type SuggestedItem = {
  id: string;
  name: string;
  price: number;
  type: ProductType;
  photo: string | null;
};

type Suggestion = {
  id: string;
  title: string;
  reasoning: string;
  items: SuggestedItem[];
};

const COMPLEMENTS: Record<ProductType, ProductType[]> = {
  "ust-giyim": ["alt-giyim", "ayakkabi", "dis-giyim"],
  "alt-giyim": ["ust-giyim", "ayakkabi", "dis-giyim"],
  "dis-giyim": ["ust-giyim", "alt-giyim", "ayakkabi"],
  ayakkabi: ["ust-giyim", "alt-giyim", "dis-giyim"],
  aksesuar: ["ust-giyim", "alt-giyim", "ayakkabi"],
};

const VARIATION_HINTS: Array<{ title: string; reasoning: string }> = [
  {
    title: "Klasik Şehir",
    reasoning:
      "Nötr tonlar, sade kesimler — günlük şehir kullanımı için dengeli bir kombin.",
  },
  {
    title: "Rahat & Sportif",
    reasoning:
      "Rahatlık ön planda; gevşek kalıplar ve aktif kıyafetlerle gün boyu konforlu.",
  },
  {
    title: "Şık & Çarpıcı",
    reasoning:
      "Daha şık parçalarla akşam çıkışı veya özel günler için göze çarpan bir tercih.",
  },
];

function pickDeterministic<T>(arr: T[], seed: number, count: number): T[] {
  if (arr.length === 0) return [];
  // Fisher-Yates ile shuffle (seed'li)
  const indices = arr.map((_, i) => i);
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).map((i) => arr[i]);
}

function toItem(p: Product): SuggestedItem {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    type: p.type,
    photo: safeProductPhoto(p.photos?.garmentFront || p.photos?.front),
  };
}

function buildSuggestions(
  anchors: Product[],
  gender: Gender,
  requestedCategories?: ProductType[],
): Suggestion[] {
  const anchorIds = new Set(anchors.map((a) => a.id));
  const anchorTypes = new Set(anchors.map((a) => a.type));

  // Kategori belirlemesi:
  // - Kullanıcı seçtiyse: o liste (anchor kategorileri dahil olabilir → alternatif öneri)
  // - Yoksa: ilk anchor varsa onun complement seti, hiç anchor yoksa default 3'lü set
  const defaultComplements: ProductType[] =
    anchors.length > 0
      ? (COMPLEMENTS[anchors[0].type] ?? [])
      : ["ust-giyim", "alt-giyim", "ayakkabi"];

  const targets: ProductType[] =
    requestedCategories && requestedCategories.length > 0
      ? requestedCategories
      : defaultComplements;

  const candidatesByType: Record<string, Product[]> = {};
  for (const t of targets) {
    candidatesByType[t] = PRODUCTS.filter(
      (p) =>
        p.type === t &&
        p.gender === gender &&
        p.photos?.front &&
        !anchorIds.has(p.id),
    );
  }

  // Seed: anchor id'leri + kategori listesinden deterministik
  const seedSource =
    anchors.length > 0
      ? anchors.map((a) => a.id).join("|")
      : `${gender}:${targets.join(",")}`;
  const baseSeed = seedSource
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);

  const result: Suggestion[] = [];
  for (let v = 0; v < VARIATION_HINTS.length; v++) {
    const seed = baseSeed * (v + 1) * 7;
    // Anchor'ları her kombinde tut
    const items: SuggestedItem[] = anchors.map(toItem);
    for (const t of targets) {
      const pool = candidatesByType[t] ?? [];
      const picked = pickDeterministic(pool, seed + t.length, 1);
      if (picked[0]) items.push(toItem(picked[0]));
    }
    if (items.length < 2) continue;
    const idPrefix =
      anchors.length > 0
        ? anchors.map((a) => a.id).join("-")
        : "anchorless";
    result.push({
      id: `${idPrefix}-v${v + 1}`,
      title: VARIATION_HINTS[v].title,
      reasoning: VARIATION_HINTS[v].reasoning,
      items,
    });
  }
  return result;
}

/**
 * POST /api/ai/suggest
 *
 * Body (JSON):
 *   baseProductId: string
 *   gender?: "kadin" | "erkek"
 *
 * Mock suggestion engine. Arkadaşın gerçek CLIP + compatibility modeli gelince
 * bu endpoint o modeli çağıracak. UI sözleşmesi (Suggestion[]) korunacak.
 */
export async function POST(req: NextRequest) {
  // Auth opsiyonel olabilir ama rate limit için user/IP gerek
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
  // Suggest şu an mock — ama gerçek modele (Gemini text) bağlanınca aynı
  // koruma katmanları çalışmaya devam etsin diye katmanlı kuruyoruz.
  const ip = getClientIp(req.headers) ?? "anon";
  const scope = user?.id ?? `anon:${ip}`;
  const rl = rateLimitMulti([
    { key: `suggest:user:${scope}:min`, config: RATE_LIMITS.aiRequest }, // 5/dk
    { key: `suggest:ip:${ip}:min`, config: RATE_LIMITS.aiRequest }, // IP başına 5/dk (kullanıcı spam'i)
    { key: `suggest:global:hr`, config: RATE_LIMITS.tryonGlobalPerHour }, // 120/saat global
  ]);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Limit aşıldı, ${rl.retryAfter} sn sonra dene` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: {
    baseProductId?: string;
    baseProductIds?: unknown;
    gender?: string;
    categories?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  // Anchor'lar: baseProductIds (array) öncelikli, yoksa baseProductId (legacy, single)
  const rawIds: string[] = [];
  if (Array.isArray(body.baseProductIds)) {
    for (const v of body.baseProductIds) {
      if (typeof v === "string" && v.length > 0 && !rawIds.includes(v)) {
        rawIds.push(v);
      }
    }
  } else if (typeof body.baseProductId === "string" && body.baseProductId.length > 0) {
    rawIds.push(body.baseProductId);
  }
  // En fazla 5 anchor (suistimal koruması)
  const anchorIds = rawIds.slice(0, 5);

  const anchors: Product[] = [];
  for (const id of anchorIds) {
    const p = getProductById(id);
    if (p) anchors.push(p);
  }
  // İstenen id var ama hiçbiri bulunamadıysa 404
  if (anchorIds.length > 0 && anchors.length === 0) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }

  const gender: Gender =
    body.gender === "erkek" || body.gender === "kadin"
      ? body.gender
      : (anchors[0]?.gender ?? "kadin");

  // Kategori whitelist (prototype pollution / arbitrary type'a karşı)
  const VALID_TYPES: ProductType[] = [
    "ust-giyim",
    "alt-giyim",
    "dis-giyim",
    "ayakkabi",
    "aksesuar",
  ];
  const requestedCategories: ProductType[] = Array.isArray(body.categories)
    ? (body.categories.filter(
        (c): c is ProductType =>
          typeof c === "string" && (VALID_TYPES as string[]).includes(c),
      ) as ProductType[])
    : [];

  const suggestions = buildSuggestions(anchors, gender, requestedCategories);

  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "no-store" } },
  );
}
