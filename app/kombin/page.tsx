import {
  PRODUCTS,
  TYPE_LABELS,
  VISIBLE_TYPES,
  getProductById,
  type ProductType,
} from "@/lib/products";
import { safeProductPhoto } from "@/lib/security/siteUrl";
import { KombinFlow } from "./KombinFlow";

export type PickableProduct = {
  id: string;
  name: string;
  price: number;
  type: ProductType;
  photo: string | null;
};

// Server Component — ürün listesini kategorilere göre hazırla, client bundle'a tam katalog sızmaz
export default async function KombinPage({
  searchParams,
}: {
  searchParams: Promise<{ baseProduct?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const baseProduct = sp.baseProduct
    ? getProductById(sp.baseProduct)
    : undefined;
  // "tryon-only" — baseProduct ile birlikte gelir, ürün seçim aşaması atlanır
  const mode: "pick" | "tryon-only" =
    sp.mode === "tryon-only" && baseProduct ? "tryon-only" : "pick";

  // Her kategoriden en fazla 12 ürün (fotosu olan), client'a serializable obje
  const grouped: Record<string, PickableProduct[]> = {};

  for (const t of VISIBLE_TYPES) {
    const items = PRODUCTS.filter((p) => p.type === t && p.photos?.front)
      .slice(0, 12)
      .map((p): PickableProduct => ({
        id: p.id,
        name: p.name,
        price: p.price,
        type: p.type,
        photo: safeProductPhoto(p.photos?.garmentFront || p.photos?.front),
      }));
    if (items.length > 0) {
      grouped[t] = items;
    }
  }

  // baseProduct varsa, kendi kategorisinde başa koy (yoksa ekle)
  let preselect: PickableProduct | null = null;
  if (baseProduct && baseProduct.photos?.front) {
    preselect = {
      id: baseProduct.id,
      name: baseProduct.name,
      price: baseProduct.price,
      type: baseProduct.type,
      photo: safeProductPhoto(
        baseProduct.photos.garmentFront || baseProduct.photos.front,
      ),
    };
    const list = grouped[baseProduct.type] ?? [];
    const exists = list.findIndex((p) => p.id === baseProduct.id);
    if (exists >= 0) {
      // başa al
      const [item] = list.splice(exists, 1);
      list.unshift(item);
    } else {
      list.unshift(preselect);
    }
    grouped[baseProduct.type] = list.slice(0, 12);
  }

  const categoryLabels: Record<string, string> = {};
  for (const t of VISIBLE_TYPES) {
    categoryLabels[t] = TYPE_LABELS[t];
  }

  return (
    <KombinFlow
      groupedProducts={grouped}
      categoryLabels={categoryLabels}
      preselectId={preselect?.id ?? undefined}
      preselectCategory={preselect?.type ?? undefined}
      mode={mode}
    />
  );
}
