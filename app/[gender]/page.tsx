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

const VALID: Gender[] = ["kadin", "erkek", "cocuk"];

export function generateStaticParams() {
  return VALID.map((g) => ({ gender: g }));
}

export default async function GenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ gender: string }>;
  searchParams: Promise<{ tip?: string }>;
}) {
  const { gender } = await params;
  const { tip } = await searchParams;

  if (!VALID.includes(gender as Gender)) notFound();
  const g = gender as Gender;
  const activeType = (tip as ProductType | "tumu") ?? "tumu";

  const products = getProductsByGenderAndType(g, activeType);
  const label = MAIN_NAV.find((n) => n.slug === g)!.label;

  const typeFilters: { slug: ProductType | "tumu"; label: string }[] = [
    { slug: "tumu", label: "Tümü" },
    ...(Object.keys(TYPE_LABELS) as ProductType[]).map((t) => ({
      slug: t,
      label: TYPE_LABELS[t],
    })),
  ];

  return (
    <div className="px-6 lg:px-10 py-8 max-w-7xl mx-auto w-full">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[var(--color-muted)] mb-6">
        <Link href="/" className="hover:text-[var(--color-fg)]">
          Anasayfa
        </Link>
        <span>/</span>
        <span className="text-[var(--color-fg)]">{label}</span>
      </nav>

      <h1 className="font-display text-4xl lg:text-5xl tracking-wide mb-2">
        {label}
      </h1>
      <p className="text-sm text-[var(--color-muted)] mb-8">
        {products.length} ürün listeleniyor
      </p>

      {/* Type filters */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 border-b border-[var(--color-line)]">
        {typeFilters.map((f) => {
          const isActive = activeType === f.slug;
          const href = f.slug === "tumu" ? `/${g}` : `/${g}?tip=${f.slug}`;
          return (
            <Link
              key={f.slug}
              href={href}
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

      {/* Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="text-[var(--color-muted)]">Bu kategoride ürün bulunamadı.</p>
        </div>
      )}

      <div className="h-24" />
    </div>
  );
}
