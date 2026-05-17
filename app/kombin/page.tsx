import { PRODUCTS, TYPE_LABELS, VISIBLE_TYPES, type Product, type ProductType } from "@/lib/products";
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
export default async function KombinPage() {
  // Her kategoriden en fazla 12 ürün (fotosu olan), client'a serializable obje olarak ver
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

  const categoryLabels: Record<string, string> = {};
  for (const t of VISIBLE_TYPES) {
    categoryLabels[t] = TYPE_LABELS[t];
  }

  return (
    <KombinFlow
      groupedProducts={grouped}
      categoryLabels={categoryLabels}
    />
  );
}
