import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS, TYPE_LABELS, type ProductType, type Gender } from "@/lib/products";
import { RETAILERS, type RetailerSlug } from "@/lib/affiliate/retailers";

export function generateStaticParams() {
  return Object.keys(RETAILERS).map((slug) => ({ slug }));
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tip?: string; cinsiyet?: string }>;
}) {
  const { slug } = await params;
  const { tip, cinsiyet } = await searchParams;

  if (!RETAILERS[slug as RetailerSlug]) notFound();
  const retailer = RETAILERS[slug as RetailerSlug];

  let products = PRODUCTS.filter((p) => p.retailer === retailer.slug);

  const activeType = (tip as ProductType | "tumu") ?? "tumu";
  const activeGender = (cinsiyet as Gender | "tumu") ?? "tumu";

  if (activeType !== "tumu") products = products.filter((p) => p.type === activeType);
  if (activeGender !== "tumu") products = products.filter((p) => p.gender === activeGender);

  function urlFor(overrides: { tip?: string | null; cinsiyet?: string | null }) {
    const sp = new URLSearchParams();
    const nextTip = overrides.tip !== undefined ? overrides.tip : activeType;
    const nextG = overrides.cinsiyet !== undefined ? overrides.cinsiyet : activeGender;
    if (nextTip && nextTip !== "tumu") sp.set("tip", nextTip);
    if (nextG && nextG !== "tumu") sp.set("cinsiyet", nextG);
    const qs = sp.toString();
    return `/magaza/${slug}${qs ? `?${qs}` : ""}`;
  }

  const typeFilters: { slug: ProductType | "tumu"; label: string }[] = [
    { slug: "tumu", label: "Tümü" },
    ...(Object.keys(TYPE_LABELS) as ProductType[]).map((t) => ({
      slug: t,
      label: TYPE_LABELS[t],
    })),
  ];

  const genderFilters: { slug: Gender | "tumu"; label: string }[] = [
    { slug: "tumu", label: "Hepsi" },
    { slug: "kadin", label: "Kadın" },
    { slug: "erkek", label: "Erkek" },
    { slug: "cocuk", label: "Çocuk" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto w-full">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-muted)] mb-4 sm:mb-6">
        <Link href="/" className="hover:text-[var(--color-fg)]">
          Anasayfa
        </Link>
        <span>/</span>
        <span>Mağazalar</span>
        <span>/</span>
        <span className="text-[var(--color-fg)]">{retailer.name}</span>
      </nav>

      <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="meta mb-2">MAĞAZA</p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-wide">
            {retailer.name}
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-2">
            {products.length} ürün
          </p>
        </div>
        <a
          href={`https://${retailer.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm border border-[var(--color-line)] hover:border-[var(--color-fg)] px-4 py-2 transition-colors"
        >
          Mağaza Sitesi →
        </a>
      </div>

      {/* Cinsiyet filtresi */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
        {genderFilters.map((f) => {
          const isActive = activeGender === f.slug;
          return (
            <Link
              key={f.slug}
              href={urlFor({ cinsiyet: f.slug === "tumu" ? null : f.slug })}
              className={`whitespace-nowrap px-4 py-2 text-sm border transition-colors ${
                isActive
                  ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-fg)]"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Tip filtresi */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-[var(--color-line)]">
        <span className="meta whitespace-nowrap mr-1">KATEGORİ</span>
        {typeFilters.map((f) => {
          const isActive = activeType === f.slug;
          return (
            <Link
              key={f.slug}
              href={urlFor({ tip: f.slug === "tumu" ? null : f.slug })}
              className={`whitespace-nowrap px-3 py-1.5 text-xs border transition-colors ${
                isActive
                  ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-fg)]"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-20 sm:py-24 text-center">
          <p className="text-[var(--color-muted)] mb-4">
            Bu filtrelerle {retailer.name} ürünü bulunamadı.
          </p>
          <Link
            href={`/magaza/${slug}`}
            className="inline-block border border-[var(--color-line)] hover:border-[var(--color-fg)] px-5 py-2.5 text-sm"
          >
            Filtreleri Temizle
          </Link>
        </div>
      )}

      <div className="h-24" />
    </div>
  );
}
