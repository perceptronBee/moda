import { redirect } from "next/navigation";
import {
  PRODUCTS,
  TYPE_LABELS,
  VISIBLE_TYPES,
  getProductById,
  type ProductType,
  type Gender,
} from "@/lib/products";
import { safeProductPhoto } from "@/lib/security/siteUrl";
import { createClient } from "@/lib/supabase/server";
import { KombinFlow } from "./KombinFlow";

export type PickableProduct = {
  id: string;
  name: string;
  price: number;
  type: ProductType;
  gender: Gender;
  photo: string | null;
};

// Pratik olarak sınır yok — feed'deki en kalabalık kategori bile bunun altında.
// Bu sayı sadece bug/feed-poisoning karşı koruma; client'a ürünler [kadın, erkek]
// sırayla iniyor, kullanıcı gender toggle ile ayırıyor.
const MAX_PER_CATEGORY = 500;
const ALLOW_DEV_ANON = process.env.NODE_ENV !== "production";

function isValidGender(v: string | undefined): v is Gender {
  return v === "kadin" || v === "erkek" || v === "cocuk";
}

// Server Component — ürün listesini kategorilere göre hazırla
export default async function KombinPage({
  searchParams,
}: {
  searchParams: Promise<{
    baseProduct?: string;
    baseProducts?: string;
    mode?: string;
    gender?: string;
  }>;
}) {
  const sp = await searchParams;

  // ── Auth gate: AI özellikleri sadece giriş yapmış kullanıcılara ──
  // Anonim trafik Gemini bütçesini şişirmesin + kişiselleştirme için kayıt şart.
  let user: { id: string } | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Dev'de anon erişime izin ver; prod'da fail-closed.
  }
  if (!user && !ALLOW_DEV_ANON) {
    const qs = new URLSearchParams();
    if (sp.mode) qs.set("mode", sp.mode);
    if (sp.baseProduct) qs.set("baseProduct", sp.baseProduct);
    if (sp.baseProducts) qs.set("baseProducts", sp.baseProducts);
    if (sp.gender) qs.set("gender", sp.gender);
    const dest = qs.toString() ? `/kombin?${qs.toString()}` : "/kombin";
    redirect(`/giris?next=${encodeURIComponent(dest)}`);
  }


  // Anchors: baseProducts=a,b,c veya baseProduct=a (geriye uyumlu)
  const anchorIds: string[] = [];
  if (sp.baseProducts) {
    for (const raw of sp.baseProducts
      .split(",")
      .map((s) => s.trim())
      .slice(0, 5)) {
      if (raw && !anchorIds.includes(raw)) anchorIds.push(raw);
    }
  }
  if (sp.baseProduct && !anchorIds.includes(sp.baseProduct)) {
    anchorIds.unshift(sp.baseProduct);
  }
  const anchorProducts = anchorIds
    .map((id) => getProductById(id))
    .filter((p): p is NonNullable<ReturnType<typeof getProductById>> => Boolean(p));
  const baseProduct = anchorProducts[0]; // tryon mode + gender default için

  // mode:
  //   "tryon"   = manuel pick + try-on (preselected + ekstra) — anchor zorunlu
  //   "suggest" = AI 3 kombin önersin — anchor opsiyonel
  //   "chat"    = serbest sohbet AI stilisti — anchor opsiyonel
  //   "pick"    = default
  const mode: "pick" | "tryon" | "suggest" | "chat" =
    sp.mode === "chat"
      ? "chat"
      : sp.mode === "suggest"
        ? "suggest"
        : sp.mode === "tryon" && baseProduct
          ? "tryon"
          : "pick";

  // Cinsiyet filtresi: önce URL param, sonra baseProduct'tan, sonra default "kadin"
  const gender: Gender = isValidGender(sp.gender)
    ? sp.gender
    : (baseProduct?.gender ?? "kadin");

  const grouped: Record<string, PickableProduct[]> = {};

  for (const t of VISIBLE_TYPES) {
    const kadinItems = PRODUCTS.filter(
      (p) => p.type === t && p.gender === "kadin" && p.photos?.front,
    ).slice(0, MAX_PER_CATEGORY);

    const erkekItems = PRODUCTS.filter(
      (p) => p.type === t && p.gender === "erkek" && p.photos?.front,
    ).slice(0, MAX_PER_CATEGORY);

    const items = [...kadinItems, ...erkekItems].map(
      (p): PickableProduct => ({
        id: p.id,
        name: p.name,
        price: p.price,
        type: p.type,
        gender: p.gender,
        photo: safeProductPhoto(p.photos?.garmentFront || p.photos?.front),
      }),
    );

    if (items.length > 0) {
      grouped[t] = items;
    }
  }

  // Tüm anchor ürünlerini PickableProduct'a çevir
  const anchors: PickableProduct[] = anchorProducts
    .filter((p) => p.photos?.front)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      type: p.type,
      gender: p.gender,
      photo: safeProductPhoto(p.photos?.garmentFront || p.photos?.front),
    }));

  // Anchor ürünlerini kendi kategorilerinde listenin başına koy
  for (const a of anchors) {
    const list = grouped[a.type] ?? [];
    const exists = list.findIndex((p) => p.id === a.id);
    if (exists >= 0) {
      const [item] = list.splice(exists, 1);
      list.unshift(item);
    } else {
      list.unshift(a);
    }
    grouped[a.type] = list.slice(0, MAX_PER_CATEGORY * 2);
  }

  const categoryLabels: Record<string, string> = {};
  for (const t of VISIBLE_TYPES) {
    categoryLabels[t] = TYPE_LABELS[t];
  }

  return (
    <KombinFlow
      groupedProducts={grouped}
      categoryLabels={categoryLabels}
      anchors={anchors}
      mode={mode}
      gender={gender}
    />
  );
}
