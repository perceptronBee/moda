import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductById, PRODUCTS, MAIN_NAV, TYPE_LABELS } from "@/lib/products";
import { RETAILERS } from "@/lib/affiliate/retailers";
import { safeExternalUrl } from "@/lib/security/siteUrl";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";

function ProductPhoto({
  src,
  tone,
  id,
  alt,
  tag,
}: {
  src?: string;
  tone?: string;
  id: string;
  alt: string;
  tag?: string;
}) {
  return (
    <div
      className="relative aspect-[3/4] overflow-hidden"
      style={{ background: src ? "#f5f5f5" : tone }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center font-display text-[120px] text-white/15 pointer-events-none select-none">
          {id}
        </div>
      )}
      {tag && (
        <span
          className={`absolute top-4 left-4 text-xs font-semibold uppercase tracking-wider px-3 py-1.5 ${
            tag === "İndirim"
              ? "bg-[var(--color-accent)] text-white"
              : "bg-white text-[var(--color-fg)]"
          }`}
        >
          {tag}
        </span>
      )}
    </div>
  );
}
import { ProductActions } from "@/components/ProductActions";
import { ProductGallery } from "@/components/ProductGallery";

// 1000+ ürün için statik gen worker'ı zorlar — runtime SSR daha iyi
// export async function generateStaticParams() {
//   return PRODUCTS.map((p) => ({ id: p.id }));
// }

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

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 sm:gap-8 lg:gap-12">
        {/* Galeri — mobilde kaydırmalı, desktop'ta grid */}
        <ProductGallery
          photos={[
            { src: product.photos?.front, label: product.tag ?? "Ön" },
            ...(product.photos?.back ? [{ src: product.photos.back, label: "Arka" }] : []),
            ...(product.photos?.garmentFront
              ? [{ src: product.photos.garmentFront, label: "Ürün · Ön" }]
              : []),
            ...(product.photos?.garmentBack
              ? [{ src: product.photos.garmentBack, label: "Ürün · Arka" }]
              : []),
          ]}
          productId={product.id}
          productName={product.name}
          tone={product.tone}
        />

        {/* Info — mobilde önemli bilgiler önce, açıklama altta */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-sm text-[var(--color-muted)]">{typeLabel}</p>
              {product.retailer && (
                <>
                  <span className="text-[var(--color-muted)]">·</span>
                  <p className="text-sm font-medium">
                    {RETAILERS[product.retailer].name}
                  </p>
                </>
              )}
            </div>
            <h1 className="font-display text-xl sm:text-2xl lg:text-4xl tracking-wide leading-tight">
              {product.name}
            </h1>
          </div>

          <div className="flex items-baseline gap-3 pb-4 lg:pb-6 border-b border-[var(--color-line)]">
            <span
              className={`text-2xl lg:text-3xl font-semibold ${hasDiscount ? "text-[var(--color-accent)]" : ""}`}
            >
              {product.price.toLocaleString("tr-TR")} TL
            </span>
            {hasDiscount && (
              <span className="text-sm lg:text-base text-[var(--color-muted)] line-through">
                {product.oldPrice!.toLocaleString("tr-TR")} TL
              </span>
            )}
          </div>

          {/* Renk varyantları — aynı baseName'e sahip ürünler */}
          {product.colorVariants && product.colorVariants.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-sm font-medium">Renk</p>
                {product.color && (
                  <p className="text-xs text-[var(--color-muted)]">
                    · {product.color}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Aktif renk */}
                <div
                  className="relative w-14 h-14 border-2 border-[var(--color-fg)] overflow-hidden"
                  title={product.color ?? "Aktif"}
                >
                  {product.photos?.front ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.photos.front}
                      alt={product.color ?? ""}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[var(--color-bg-soft)]" />
                  )}
                </div>
                {product.colorVariants.map((v) => (
                  <Link
                    key={v.id}
                    href={`/urun/${v.id}`}
                    title={v.color}
                    className="relative w-14 h-14 border border-[var(--color-line)] hover:border-[var(--color-fg)] overflow-hidden transition-colors"
                  >
                    {v.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.photo}
                        alt={v.color}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[var(--color-bg-soft)] flex items-center justify-center text-[10px]">
                        {v.color.slice(0, 3)}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* AI CTA'ları — mobilde grid (yan yana), lg'de stack (üst üste detaylı) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[var(--color-accent)]" />
              <span className="meta">YAPAY ZEKA</span>
            </div>

            {/* Mobil: 2 sütunlu grid — ikisi de fold üstünde */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {/* 1) Üstümde Dene — primary */}
              <Link
                href={`/kombin?baseProduct=${product.id}&mode=tryon-only`}
                className="group relative flex items-center justify-between gap-2 lg:px-5 px-3 py-3 lg:py-4 transition-all overflow-hidden border-2"
                style={{
                  backgroundColor: "var(--color-fg)",
                  borderColor: "var(--color-fg)",
                  color: "var(--color-bg)",
                }}
              >
                <span
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: "var(--color-accent)" }}
                />
                <div className="flex items-center gap-2 lg:gap-3 relative min-w-0">
                  <span
                    className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "var(--color-accent)" }}
                  >
                    <Sparkles size={16} className="text-white" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs lg:text-sm font-semibold tracking-wide truncate">
                      Üstümde Dene
                    </p>
                    <p className="hidden lg:block text-xs opacity-70">
                      Fotoğrafını yükle, sadece bu ürünü AI ile giydirelim
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform shrink-0"
                />
              </Link>

              {/* 2) Kombin Oluştur — secondary */}
              <Link
                href={`/kombin?baseProduct=${product.id}`}
                className="group relative flex items-center justify-between gap-2 lg:px-5 px-3 py-3 lg:py-4 transition-all overflow-hidden border"
                style={{
                  backgroundColor: "var(--color-bg-elev)",
                  borderColor: "var(--color-line-strong)",
                  color: "var(--color-fg)",
                }}
              >
                <div className="flex items-center gap-2 lg:gap-3 relative min-w-0">
                  <span
                    className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center shrink-0 border"
                    style={{ borderColor: "var(--color-line-strong)" }}
                  >
                    <Sparkles size={16} className="text-[var(--color-accent)]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs lg:text-sm font-semibold tracking-wide truncate">
                      <span className="lg:hidden">Kombin Öner</span>
                      <span className="hidden lg:inline">AI ile Kombin Oluştur</span>
                    </p>
                    <p className="hidden lg:block text-xs text-[var(--color-fg-soft)]">
                      Bu ürünle eşleşen tam kombini sana giydirelim
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform shrink-0"
                />
              </Link>
            </div>
          </div>

          {/* Actions: beden seçici + sepete ekle (mobilde sticky alt bar) */}
          <ProductActions
            productId={product.id}
            sizes={product.sizes}
            price={product.price}
            oldPrice={product.oldPrice}
            productName={product.name}
          />

          {/* Açıklama */}
          {product.description && (
            <p className="text-sm text-[var(--color-fg-soft)] leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Mağazada Satın Al — deeplink scheme/render-time validate edilir (XSS koruması) */}
          {(() => {
            const safeHref = safeExternalUrl(product.deeplink);
            const retailerName = product.retailer
              ? RETAILERS[product.retailer as keyof typeof RETAILERS]?.name
              : null;
            if (!safeHref || !retailerName) return null;
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex items-center justify-between border border-[var(--color-line)] hover:border-[var(--color-fg)] px-5 py-4 transition-colors group"
                style={{ backgroundColor: "var(--color-bg-elev)" }}
              >
                <div>
                  <p className="text-sm font-medium">{retailerName}'de Satın Al</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    Mağaza sayfasına yönlendirilirsin
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </a>
            );
          })()}

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

      {/* Mobilde sticky alt bar yer kaplasın diye boşluk */}
      <div className="h-24 lg:h-24 pb-20 lg:pb-0" />
    </div>
  );
}
