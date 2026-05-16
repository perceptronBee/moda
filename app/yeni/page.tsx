import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS } from "@/lib/products";

export default function YeniPage() {
  const products = PRODUCTS.filter((p) => p.tag === "Yeni");

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto w-full">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-muted)] mb-4 sm:mb-6">
        <Link href="/" className="hover:text-[var(--color-fg)]">
          Anasayfa
        </Link>
        <span>/</span>
        <span className="text-[var(--color-fg)]">Yeni</span>
      </nav>

      <p className="meta mb-2">YENİ KOLEKSİYON</p>
      <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-wide mb-2">
        Yeni Gelenler
      </h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">
        Bu hafta eklenen {products.length} ürün
      </p>

      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p className="py-24 text-center text-[var(--color-muted)]">
          Henüz yeni ürün eklenmemiş.
        </p>
      )}

      <div className="h-24" />
    </div>
  );
}
