import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS, TYPE_LABELS, VISIBLE_TYPES } from "@/lib/products";
import { ArrowRight, Sparkles, Wand2, Camera } from "lucide-react";

export default function HomePage() {
  const newArrivals = PRODUCTS.filter((p) => p.tag === "Yeni").slice(0, 8);
  const onSale = PRODUCTS.filter(
    (p) => p.oldPrice && p.oldPrice > p.price,
  ).slice(0, 8);

  // Popüler — orta fiyatlı, foto'lu ürünlerden seçim
  const popular = PRODUCTS.filter((p) => p.photos?.front && !p.tag)
    .sort((a, b) => {
      // Deterministik seed
      const ha = a.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
      const hb = b.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
      return (ha % 100) - (hb % 100);
    })
    .slice(0, 8);

  // Editör seçimleri — farklı subset
  const editorPicks = PRODUCTS.filter(
    (p) => p.photos?.front && p.colorVariants && p.colorVariants.length >= 2,
  ).slice(0, 4);

  // Her tip için bir örnek ürün
  const byType: Record<string, (typeof PRODUCTS)[number]> = {};
  for (const p of PRODUCTS) {
    if (!byType[p.type] && p.photos?.front) byType[p.type] = p;
  }

  return (
    <div className="flex flex-col">
      {/* Hero — Kadın + Erkek 50/50 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-1 bg-[var(--color-line)]">
        <Link
          href="/kadin"
          className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[560px] overflow-hidden group bg-[#9b9b9b]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/kadin.jpg"
            alt="Kadın koleksiyonu"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12 bg-gradient-to-t from-black/55 via-black/15 to-transparent">
            <p className="text-white text-sm tracking-wider mb-2">YENİ SEZON</p>
            <h2 className="font-display text-6xl lg:text-8xl text-white tracking-wide mb-4 drop-shadow-lg">
              KADIN
            </h2>
            <span className="inline-flex items-center gap-2 text-white text-sm font-medium group-hover:gap-3 transition-all">
              Koleksiyonu Keşfet <ArrowRight size={16} />
            </span>
          </div>
          <div className="absolute right-6 top-6 font-display text-[120px] lg:text-[200px] text-white/15 leading-none pointer-events-none mix-blend-overlay">
            01
          </div>
        </Link>

        <Link
          href="/erkek"
          className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[560px] overflow-hidden group bg-[#2a2a2a]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/erkek.jpg"
            alt="Erkek koleksiyonu"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12 bg-gradient-to-t from-black/60 via-black/15 to-transparent">
            <p className="text-white text-sm tracking-wider mb-2">YENİ SEZON</p>
            <h2 className="font-display text-6xl lg:text-8xl text-white tracking-wide mb-4 drop-shadow-lg">
              ERKEK
            </h2>
            <span className="inline-flex items-center gap-2 text-white text-sm font-medium group-hover:gap-3 transition-all">
              Koleksiyonu Keşfet <ArrowRight size={16} />
            </span>
          </div>
          <div className="absolute right-6 top-6 font-display text-[120px] lg:text-[200px] text-white/15 leading-none pointer-events-none mix-blend-overlay">
            02
          </div>
        </Link>
      </section>

      {/* Yeni Gelenler */}
      {newArrivals.length > 0 && (
        <Section
          title="Yeni Gelenler"
          subtitle="Bu hafta eklenenler"
          href="/yeni"
        >
          {newArrivals.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Section>
      )}

      {/* AI Kombin CTA banner */}
      <section className="px-4 sm:px-6 lg:px-10 my-8 max-w-7xl mx-auto w-full">
        <Link
          href="/kombin"
          className="relative block overflow-hidden group"
          style={{
            background:
              "linear-gradient(135deg, #0f0f0f 0%, #1c1c1c 55%, #2a2a2a 100%)",
          }}
        >
          {/* Sağ tarafta büyük dekoratif AI siluet */}
          <div className="absolute top-0 right-0 w-full lg:w-1/2 h-full pointer-events-none overflow-hidden">
            <div
              className="absolute -right-20 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-10"
              style={{
                background:
                  "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
              }}
            />
            {/* Noktalar */}
            <span className="absolute top-10 right-16 w-1.5 h-1.5 bg-white opacity-30" />
            <span className="absolute top-24 right-32 w-2.5 h-2.5 bg-white opacity-20" />
            <span className="absolute top-40 right-12 w-1 h-1 bg-white opacity-40" />
            <span className="absolute bottom-12 right-20 w-2 h-2 bg-white opacity-25" />
            <span className="absolute bottom-28 right-44 w-1.5 h-1.5 bg-white opacity-30" />
            <span className="absolute bottom-44 right-8 w-1 h-1 bg-white opacity-30" />
          </div>

          <div className="relative px-6 py-12 lg:px-16 lg:py-20 max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span
                className="w-10 h-10 flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                <Sparkles size={18} className="text-white" />
              </span>
              <p className="meta text-white/70 tracking-[0.2em]">
                YAPAY ZEKA ASİSTAN
              </p>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-wide text-white leading-tight mb-4">
              Sana Özel
              <br />
              <span className="text-[var(--color-accent)]">Kombin Öner</span>
            </h2>

            <p className="text-white/70 text-sm sm:text-base max-w-md mb-8 leading-relaxed">
              Fotoğrafını yükle, yapay zeka stiline uygun kombini hazırlasın
              ve <span className="text-white">üzerine giydirsin</span>.
            </p>

            <div className="inline-flex items-center gap-3 bg-white text-black group-hover:bg-[var(--color-accent)] group-hover:text-white transition-colors px-6 py-3.5 text-sm font-medium tracking-wide">
              Hemen Dene
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </div>
          </div>
        </Link>
      </section>

      {/* Kategoriden Seç */}
      {Object.keys(byType).length > 0 && (
        <section className="px-4 sm:px-6 lg:px-10 py-10 max-w-7xl mx-auto w-full">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="meta mb-1">KEŞFET</p>
              <h2 className="font-display text-2xl sm:text-3xl tracking-wide">
                Kategoriden Seç
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {VISIBLE_TYPES.filter((t) => byType[t]).map((t) => {
              const p = byType[t]!;
              return (
                <Link
                  key={t}
                  href={`/kadin?tip=${t}`}
                  className="relative aspect-[3/4] overflow-hidden group"
                  style={{ background: "#f0f0f0" }}
                >
                  {p.photos?.front && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.photos.front}
                      alt={TYPE_LABELS[t]}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-end p-4 lg:p-6">
                    <div className="text-white">
                      <h3 className="font-display text-xl lg:text-2xl tracking-wide">
                        {TYPE_LABELS[t]}
                      </h3>
                      <p className="text-xs lg:text-sm text-white/80 mt-1 flex items-center gap-1">
                        Keşfet <ArrowRight size={12} />
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* İndirim */}
      {onSale.length > 0 && (
        <Section
          title="İndirim"
          subtitle={`%${Math.max(
            ...onSale.map((p) =>
              Math.round((1 - p.price / p.oldPrice!) * 100),
            ),
          )}'a varan fırsatlar`}
          accent
          href="/indirim"
        >
          {onSale.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Section>
      )}

      {/* Popüler */}
      {popular.length > 0 && (
        <Section title="Bu Hafta Popüler" subtitle="Çok tercih edilenler">
          {popular.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Section>
      )}

      {/* Editör Seçimleri — renk varyantı zengin olanlar */}
      {editorPicks.length > 0 && (
        <Section
          title="Editör Seçimleri"
          subtitle="Farklı renk seçenekleri ile"
        >
          {editorPicks.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Section>
      )}

      {/* Alt CTA — Try-on */}
      <section className="px-4 sm:px-6 lg:px-10 mt-10 mb-16 max-w-7xl mx-auto w-full">
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-px"
          style={{ backgroundColor: "var(--color-line)" }}
        >
          <div
            className="p-8 lg:p-10"
            style={{ backgroundColor: "var(--color-bg-elev)" }}
          >
            <Camera
              size={28}
              className="text-[var(--color-accent)] mb-4"
            />
            <h3 className="font-display text-xl tracking-wide mb-2">
              Fotoğrafını Yükle
            </h3>
            <p className="text-sm text-[var(--color-fg-soft)]">
              Önden ve arkadan bir fotoğrafını yükle. Yapay zekamız stiline
              uygun parçaları senin üzerinde dener.
            </p>
          </div>
          <div
            className="p-8 lg:p-10"
            style={{ backgroundColor: "var(--color-bg-elev)" }}
          >
            <Wand2
              size={28}
              className="text-[var(--color-accent)] mb-4"
            />
            <h3 className="font-display text-xl tracking-wide mb-2">
              AI Kombin Önersin
            </h3>
            <p className="text-sm text-[var(--color-fg-soft)]">
              Yüzlerce ürün arasından sana uygun kombinleri saniyeler içinde
              hazırlar.
            </p>
          </div>
          <div
            className="p-8 lg:p-10"
            style={{ backgroundColor: "var(--color-bg-elev)" }}
          >
            <Sparkles
              size={28}
              className="text-[var(--color-accent)] mb-4"
            />
            <h3 className="font-display text-xl tracking-wide mb-2">
              Üzerinde Dene
            </h3>
            <p className="text-sm text-[var(--color-fg-soft)]">
              Seçtiğin kombinin senin üzerinde nasıl duracağını gör — sepete
              eklemeden önce.
            </p>
          </div>
        </div>

        <Link
          href="/kombin"
          className="mt-4 flex items-center justify-center gap-2 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors py-4 text-sm font-medium tracking-wide"
        >
          <Sparkles size={16} /> Şimdi Dene
        </Link>
      </section>
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
    <section className="px-4 sm:px-6 lg:px-10 py-10 max-w-7xl mx-auto w-full">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2
            className={`font-display text-2xl sm:text-3xl tracking-wide ${accent ? "text-[var(--color-accent)]" : ""}`}
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {children}
      </div>
    </section>
  );
}
