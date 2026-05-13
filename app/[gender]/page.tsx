import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import {
  MAIN_NAV,
  TYPE_LABELS,
  getProductsByGenderAndType,
  type Gender,
  type ProductType,
} from "@/lib/products";
import { RETAILERS, type RetailerSlug } from "@/lib/affiliate/retailers";

const VALID: Gender[] = ["kadin", "erkek", "cocuk"];

export function generateStaticParams() {
  return VALID.map((g) => ({ gender: g }));
}

export default async function GenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ gender: string }>;
  searchParams: Promise<{ tip?: string; magaza?: string }>;
}) {
  const { gender } = await params;
  const { tip, magaza } = await searchParams;

  if (!VALID.includes(gender as Gender)) notFound();
  const g = gender as Gender;
  const activeType = (tip as ProductType | "tumu") ?? "tumu";
  const activeRetailer = magaza as RetailerSlug | undefined;

  let products = getProductsByGenderAndType(g, activeType);
  if (activeRetailer && RETAILERS[activeRetailer]) {
    products = products.filter((p) => p.retailer === activeRetailer);
  }

  const label = MAIN_NAV.find((n) => n.slug === g)!.label;

  const typeFilters: { slug: ProductType | "tumu"; label: string }[] = [
    { slug: "tumu", label: "Tümü" },
    ...(Object.keys(TYPE_LABELS) as ProductType[]).map((t) => ({
      slug: t,
      label: TYPE_LABELS[t],
    })),
  ];

  // URL helper: mevcut filtreleri korur, sadece istenen parametreyi günceller
  function urlFor(overrides: { tip?: string | null; magaza?: string | null }) {
    const params = new URLSearchParams();
    const nextTip = overrides.tip !== undefined ? overrides.tip : activeType;
    const nextMagaza =
      overrides.magaza !== undefined ? overrides.magaza : activeRetailer;
    if (nextTip && nextTip !== "tumu") params.set("tip", nextTip);
    if (nextMagaza) params.set("magaza", nextMagaza);
    const qs = params.toString();
    return `/${g}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto w-full">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[var(--color-muted)] mb-4 sm:mb-6">
        <Link href="/" className="hover:text-[var(--color-fg)]">
          Anasayfa
        </Link>
        <span>/</span>
        <span className="text-[var(--color-fg)]">{label}</span>
        {activeRetailer && (
          <>
            <span>/</span>
            <span className="text-[var(--color-fg)]">
              {RETAILERS[activeRetailer].name}
            </span>
          </>
        )}
      </nav>

      <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-wide mb-2">
        {label}
      </h1>
      <p className="text-sm text-[var(--color-muted)] mb-6 sm:mb-8">
        {products.length} ürün listeleniyor
        {activeRetailer && ` · ${RETAILERS[activeRetailer].name}`}
      </p>

      {/* Filters */}
      <div className="mb-6 sm:mb-8 space-y-3">
        {/* Tip filtreleri */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {typeFilters.map((f) => {
            const isActive = activeType === f.slug;
            return (
              <Link
                key={f.slug}
                href={urlFor({ tip: f.slug === "tumu" ? null : f.slug })}
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

        {/* Mağaza filtreleri */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 border-t pt-3 border-[var(--color-line)]">
          <span className="meta whitespace-nowrap mr-1">MAĞAZA</span>
          <Link
            href={urlFor({ magaza: null })}
            className={`whitespace-nowrap px-3 py-1.5 text-xs border transition-colors ${
              !activeRetailer
                ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                : "border-[var(--color-line)] hover:border-[var(--color-fg)]"
            }`}
          >
            Tümü
          </Link>
          {Object.values(RETAILERS).map((r) => {
            const isActive = activeRetailer === r.slug;
            return (
              <Link
                key={r.slug}
                href={urlFor({ magaza: r.slug })}
                className={`whitespace-nowrap px-3 py-1.5 text-xs border transition-colors ${
                  isActive
                    ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-fg)]"
                }`}
              >
                {r.name}
              </Link>
            );
          })}
        </div>
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
            Bu filtrelerle ürün bulunamadı.
          </p>
          <Link
            href={`/${g}`}
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
