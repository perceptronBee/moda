import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS, MAIN_NAV, getProductsByGender } from "@/lib/products";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  const newArrivals = PRODUCTS.filter((p) => p.tag === "Yeni").slice(0, 4);
  const onSale = PRODUCTS.filter((p) => p.tag === "İndirim").slice(0, 4);

  return (
    <div className="flex flex-col">
      {/* Hero — simple promo */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-1 bg-[var(--color-line)]">
        <Link
          href="/kadin"
          className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[480px] overflow-hidden group"
          style={{ background: "#9b9b9b" }}
        >
          <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12 bg-gradient-to-t from-black/30 via-transparent to-transparent">
            <p className="text-white text-sm tracking-wider mb-2">
              YENİ SEZON
            </p>
            <h2 className="font-display text-5xl lg:text-7xl text-white tracking-wide mb-4">
              KADIN
            </h2>
            <span className="inline-flex items-center gap-2 text-white text-sm font-medium group-hover:gap-3 transition-all">
              Koleksiyonu Keşfet <ArrowRight size={16} />
            </span>
          </div>
          <div className="absolute right-6 top-6 font-display text-[120px] lg:text-[200px] text-white/10 leading-none pointer-events-none">
            01
          </div>
        </Link>

        <div className="grid grid-rows-2 gap-1 bg-[var(--color-line)]">
          <Link
            href="/erkek"
            className="relative overflow-hidden group min-h-[240px]"
            style={{ background: "#2a2a2a" }}
          >
            <div className="absolute inset-0 flex flex-col justify-end p-8 bg-gradient-to-t from-black/40 via-transparent to-transparent">
              <p className="text-white text-xs tracking-wider mb-1">
                YENİ SEZON
              </p>
              <h2 className="font-display text-4xl lg:text-5xl text-white tracking-wide mb-2">
                ERKEK
              </h2>
              <span className="inline-flex items-center gap-2 text-white text-sm group-hover:gap-3 transition-all">
                İncele <ArrowRight size={14} />
              </span>
            </div>
          </Link>
          <Link
            href="/cocuk"
            className="relative overflow-hidden group min-h-[240px]"
            style={{ background: "#c8c8c8" }}
          >
            <div className="absolute inset-0 flex flex-col justify-end p-8 bg-gradient-to-t from-black/30 via-transparent to-transparent">
              <p className="text-white text-xs tracking-wider mb-1">
                YENİ SEZON
              </p>
              <h2 className="font-display text-4xl lg:text-5xl text-white tracking-wide mb-2">
                ÇOCUK
              </h2>
              <span className="inline-flex items-center gap-2 text-white text-sm group-hover:gap-3 transition-all">
                İncele <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Yeni gelenler */}
      {newArrivals.length > 0 && (
        <Section title="Yeni Gelenler" subtitle="Bu hafta eklenenler" href="/kadin">
          {newArrivals.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Section>
      )}

      {/* İndirim */}
      {onSale.length > 0 && (
        <Section
          title="İndirim"
          subtitle="Sınırlı süreli fırsatlar"
          accent
          href="/kadin"
        >
          {onSale.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Section>
      )}

      {/* Kategori vitrini */}
      <section className="px-6 lg:px-10 py-16 max-w-7xl mx-auto w-full">
        <h2 className="font-display text-3xl tracking-wide mb-8">
          Tüm Kategoriler
        </h2>
        <div className="grid grid-cols-3 gap-4 md:gap-6">
          {MAIN_NAV.map((c) => {
            const count = getProductsByGender(c.slug).length;
            const tone =
              c.slug === "kadin"
                ? "#9b9b9b"
                : c.slug === "erkek"
                  ? "#2a2a2a"
                  : "#c8c8c8";
            return (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className="group block"
              >
                <div
                  className="aspect-square relative overflow-hidden mb-3"
                  style={{ background: tone }}
                >
                  <div className="absolute inset-0 flex items-center justify-center font-display text-5xl md:text-6xl text-white tracking-wide group-hover:scale-105 transition-transform">
                    {c.label}
                  </div>
                </div>
                <p className="meta text-center">{count} ÜRÜN</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="h-24" />
    </div>
  );
}

function Section({
  title,
  subtitle,
  href,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="px-6 lg:px-10 py-12 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2
            className={`font-display text-3xl tracking-wide ${accent ? "text-[var(--color-accent)]" : ""}`}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-[var(--color-muted)] mt-1">{subtitle}</p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="text-sm hover:text-[var(--color-accent)] transition-colors flex items-center gap-1 group"
          >
            Tümünü Gör{" "}
            <ArrowRight
              size={14}
              className="group-hover:translate-x-1 transition-transform"
            />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {children}
      </div>
    </section>
  );
}
