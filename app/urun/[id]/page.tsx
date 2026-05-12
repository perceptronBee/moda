import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById, PRODUCTS, MAIN_NAV, TYPE_LABELS } from "@/lib/products";
import { ArrowRight, Heart, Truck, RefreshCw, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) notFound();

  const related = PRODUCTS.filter(
    (p) =>
      p.gender === product.gender &&
      p.type === product.type &&
      p.id !== product.id,
  ).slice(0, 4);

  const genderLabel = MAIN_NAV.find((n) => n.slug === product.gender)!.label;
  const typeLabel = TYPE_LABELS[product.type];
  const hasDiscount =
    product.oldPrice !== undefined && product.oldPrice > product.price;

  return (
    <div className="px-6 lg:px-10 py-6 max-w-7xl mx-auto w-full">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)] mb-6">
        <Link href="/" className="hover:text-[var(--color-fg)]">
          Anasayfa
        </Link>
        <span>/</span>
        <Link href={`/${product.gender}`} className="hover:text-[var(--color-fg)]">
          {genderLabel}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-fg)]">{typeLabel}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-12">
        {/* Image */}
        <div
          className="relative aspect-[3/4] overflow-hidden"
          style={{ background: product.tone }}
        >
          {product.tag && (
            <span
              className={`absolute top-4 left-4 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 ${
                product.tag === "İndirim"
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-white text-[var(--color-fg)]"
              }`}
            >
              {product.tag}
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center font-display text-[200px] text-white/15 pointer-events-none select-none">
            {product.id}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-[var(--color-muted)] mb-2">{typeLabel}</p>
            <h1 className="font-display text-3xl lg:text-4xl tracking-wide leading-tight">
              {product.name}
            </h1>
          </div>

          <div className="flex items-baseline gap-3 pb-6 border-b border-[var(--color-line)]">
            <span
              className={`text-3xl font-semibold ${hasDiscount ? "text-[var(--color-accent)]" : ""}`}
            >
              {product.price.toLocaleString("tr-TR")} TL
            </span>
            {hasDiscount && (
              <span className="text-base text-[var(--color-muted)] line-through">
                {product.oldPrice!.toLocaleString("tr-TR")} TL
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--color-fg-soft)] leading-relaxed">
            {product.description}
          </p>

          {/* Sizes */}
          {product.sizes && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Beden Seçin</p>
                <button className="text-xs underline text-[var(--color-muted)]">
                  Beden Tablosu
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    className="min-w-[52px] border border-[var(--color-line)] hover:border-[var(--color-fg)] px-4 py-2.5 text-sm transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button className="flex-1 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors font-medium py-4 text-sm tracking-wide">
              SEPETE EKLE
            </button>
            <button
              className="w-14 border border-[var(--color-line)] hover:border-[var(--color-fg)] flex items-center justify-center transition-colors"
              aria-label="Favorilere ekle"
            >
              <Heart size={18} />
            </button>
          </div>

          {/* Kombin CTA */}
          <Link
            href={`/kombin?baseProduct=${product.id}`}
            className="group flex items-center justify-between bg-[var(--color-bg-elev)] border border-[var(--color-line)] hover:border-[var(--color-fg)] px-5 py-4 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-[var(--color-accent)]" />
              <div>
                <p className="text-sm font-medium">Bu ürünle kombin öner</p>
                <p className="text-xs text-[var(--color-muted)]">
                  Yapay zeka destekli stil önerisi
                </p>
              </div>
            </div>
            <ArrowRight
              size={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          </Link>

          {/* Info badges */}
          <div className="grid grid-cols-2 gap-3 text-xs pt-4 border-t border-[var(--color-line)]">
            <div className="flex items-center gap-2 text-[var(--color-fg-soft)]">
              <Truck size={16} />
              <span>Ücretsiz Kargo (500 TL üzeri)</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--color-fg-soft)]">
              <RefreshCw size={16} />
              <span>14 Gün İade Hakkı</span>
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-2xl tracking-wide mb-6">
            Benzer Ürünler
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <div className="h-24" />
    </div>
  );
}
