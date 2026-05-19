import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import {
  PRODUCTS,
  getProductById,
  type Product,
  type Gender,
  type ProductType,
} from "@/lib/products";
import {
  searchPipelineByImageUrl,
  searchPipelineByText,
  type PipelineHit,
} from "@/lib/ai/pipelineSearch";
import { safeProductPhoto } from "@/lib/security/siteUrl";
import { rateLimitMulti, RATE_LIMITS } from "@/lib/security/rateLimit";
import { getClientIp } from "@/lib/security/ip";

export const maxDuration = 30;
const ALLOW_DEV_ANON = process.env.NODE_ENV !== "production";

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

function toItem(p: Product): SuggestedItem {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    type: p.type,
    photo: safeProductPhoto(p.photos?.garmentFront || p.photos?.front),
  };
}

function buildTargets(
  anchors: Product[],
  requestedCategories: ProductType[],
): ProductType[] {
  const defaultComplements: ProductType[] =
    anchors.length > 0
      ? (COMPLEMENTS[anchors[0].type] ?? [])
      : ["ust-giyim", "alt-giyim", "ayakkabi"];
  return requestedCategories.length > 0 ? requestedCategories : defaultComplements;
}

function scoreOf(hit: PipelineHit) {
  return typeof hit.similarity_score === "number" ? hit.similarity_score : 0;
}

function buildCandidatePool(
  hits: PipelineHit[],
  anchors: Product[],
  gender: Gender,
  targets: ProductType[],
): Product[] {
  const anchorIds = new Set(anchors.map((a) => a.id));
  const rank = new Map<string, number>();
  hits.forEach((h) => rank.set(h.id, scoreOf(h)));

  return hits
    .map((h) => getProductById(h.id))
    .filter((p): p is Product => Boolean(p))
    .filter((p) => p.gender === gender)
    .filter((p) => targets.includes(p.type))
    .filter((p) => !anchorIds.has(p.id))
    .filter((p) => Boolean(p.photos?.front))
    .sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0));
}

function heuristicSuggestions(
  pool: Product[],
  anchors: Product[],
  targets: ProductType[],
): Suggestion[] {
  const byType = new Map<ProductType, Product[]>();
  for (const t of targets) byType.set(t, []);
  for (const p of pool) {
    const arr = byType.get(p.type);
    if (arr && arr.length < 12) arr.push(p);
  }

  const suggestions: Suggestion[] = [];
  for (let i = 0; i < VARIATION_HINTS.length; i++) {
    const selected: Product[] = [...anchors];
    for (const t of targets) {
      const arr = byType.get(t) ?? [];
      const pick = arr[i] ?? arr[0];
      if (pick && !selected.some((x) => x.id === pick.id)) selected.push(pick);
    }
    if (selected.length < 2) continue;
    suggestions.push({
      id: `retrieval-v${i + 1}`,
      title: VARIATION_HINTS[i].title,
      reasoning: VARIATION_HINTS[i].reasoning,
      items: selected.map(toItem).slice(0, 6),
    });
  }
  return suggestions;
}

async function geminiSuggest(
  anchors: Product[],
  pool: Product[],
  targets: ProductType[],
): Promise<Array<{ title: string; reasoning: string; itemIds: string[] }>> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim();
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });
  const anchorIds = anchors.map((a) => a.id);
  const catalog = pool.slice(0, 80).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    price: p.price,
  }));

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-pro",
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Aynı kullanıcı için 3 farklı kombin önerisi üret.\n` +
              `Anchors (her kombinde kalmalı): ${JSON.stringify(anchorIds)}\n` +
              `Hedef kategoriler: ${JSON.stringify(targets)}\n` +
              `Kullanılabilir ürünler (yalnızca bu id'ler):\n${JSON.stringify(catalog)}`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                reasoning: { type: Type.STRING },
                itemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["title", "reasoning", "itemIds"],
            },
          },
        },
        required: ["suggestions"],
      },
    },
  });

  try {
    const parsed = JSON.parse(response.text ?? "{}");
    const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    return list
      .map((s: any) => ({
        title: typeof s?.title === "string" ? s.title : "",
        reasoning: typeof s?.reasoning === "string" ? s.reasoning : "",
        itemIds: Array.isArray(s?.itemIds) ? s.itemIds.filter((x: unknown) => typeof x === "string") : [],
      }))
      .filter((s: { title: string; itemIds: string[] }) => s.title && s.itemIds.length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function composeSuggestions(
  planned: Array<{ title: string; reasoning: string; itemIds: string[] }>,
  anchors: Product[],
  pool: Product[],
): Suggestion[] {
  const productById = new Map(pool.map((p) => [p.id, p]));
  for (const a of anchors) productById.set(a.id, a);

  const suggestions: Suggestion[] = [];
  for (let i = 0; i < planned.length; i++) {
    const p = planned[i];
    const ids = [...anchors.map((a) => a.id), ...p.itemIds];
    const dedup = Array.from(new Set(ids));
    const items = dedup
      .map((id) => productById.get(id))
      .filter((x): x is Product => Boolean(x))
      .map(toItem)
      .slice(0, 6);
    if (items.length < 2) continue;
    suggestions.push({
      id: `gemini-v${i + 1}`,
      title: p.title,
      reasoning: p.reasoning,
      items,
    });
  }
  return suggestions;
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
    return NextResponse.json(
      { error: "Önce giriş yapmalısın" },
      { status: 401 },
    );
  }
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

  const targets = buildTargets(anchors, requestedCategories);
  const anchorPhoto = anchors[0]?.photos?.garmentFront || anchors[0]?.photos?.front;

  let hits: PipelineHit[] = [];
  try {
    if (anchorPhoto) {
      hits = await searchPipelineByImageUrl(anchorPhoto, 60);
    } else {
      const query = `${gender} ${targets.join(" ")} kombin önerisi`;
      hits = await searchPipelineByText(query, 60);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Pipeline retrieval hatasi: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const pool = buildCandidatePool(hits, anchors, gender, targets);
  const heuristic = heuristicSuggestions(pool, anchors, targets);
  const geminiPlan = await geminiSuggest(anchors, pool, targets);
  const suggestions = geminiPlan.length > 0
    ? composeSuggestions(geminiPlan, anchors, pool)
    : heuristic;

  if (suggestions.length === 0) {
    return NextResponse.json(
      { error: "Uygun kombin adayı bulunamadı" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { suggestions: suggestions.slice(0, 3) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
