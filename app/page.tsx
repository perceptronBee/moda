import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS, MAIN_NAV, getProductsByGender } from "@/lib/products";
import { RETAILERS } from "@/lib/affiliate/retailers";
import { ArrowRight, Store } from "lucide-react";

export default function HomePage() {
  const newArrivals = PRODUCTS.filter((p) => p.tag === "Yeni").slice(0, 4);
  const onSale = PRODUCTS.filter((p) => p.tag === "İndirim").slice(0, 4);

  return (
    <div className="flex flex-col">
      {/* Hero — Kadın + Erkek 50/50 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-1 bg-[var(--color-line)]">
        <Link
          href="/kadin"
          className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[520px] overflow-hidden group"
          style={{ background: "#9b9b9b" }}
        >
          <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12 bg-gradient-to-t from-black/35 via-transparent to-transparent">
            <p className="text-white text-sm tracking-wider mb-2">
              YENİ SEZON
            </p>
            <h2 className="font-display text-6xl lg:text-8xl text-white tracking-wide mb-4">
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

        <Link
          href="/erkek"
          className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[520px] overflow-hidden group"
          style={{ background: "#2a2a2a" }}
        >
          <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12 bg-gradient-to-t from-black/40 via-transparent to-transparent">
            <p className="text-white text-sm tracking-wider mb-2">
              YENİ SEZON
            </p>
            <h2 className="font-display text-6xl lg:text-8xl text-white tracking-wide mb-4">
              ERKEK
            </h2>
            <span className="inline-flex items-center gap-2 text-white text-sm font-medium group-hover:gap-3 transition-all">
              Koleksiyonu Keşfet <ArrowRight size={16} />
            </span>
          </div>
          <div className="absolute right-6 top-6 font-display text-[120px] lg:text-[200px] text-white/10 leading-none pointer-events-none">
            02
          </div>
        </Link>
      </section>

      {/* Yeni gelenler */}
      {newArrivals.length > 0 && (
        <Section title="Yeni Gelenler" subtitle="Bu hafta eklenenler" href="/?tag=yeni">
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
          href="/?tag=indirim"
        >
          {onSale.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Section>
      )}

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
