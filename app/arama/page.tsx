import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS } from "@/lib/products";

export const metadata = { title: "Arama — MODA" };

function sanitizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\r\n\0]/g, "")
    .slice(0, 100)
    .trim();
}

export default async function AramaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sanitizeQuery(sp.q);
  const qLower = q.toLowerCase();

  const results = q
    ? PRODUCTS.filter((p) => {
        const t = `${p.name ?? ""} ${p.color ?? ""} ${p.baseName ?? ""}`.toLowerCase();
        return t.includes(qLower);
      }).slice(0, 60)
    : [];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto w-full">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-muted)] mb-4">
        <Link href="/" className="hover:text-[var(--color-fg)]">
          Anasayfa
        </Link>
        <span>/</span>
        <span className="text-[var(--color-fg)]">Arama</span>
      </nav>

      <h1 className="font-display text-3xl sm:text-4xl tracking-wide mb-2">
        Arama Sonuçları
      </h1>

      {/* React auto-escape — {q} doğrudan text olarak basılır, HTML değil */}
      {q ? (
        <p className="text-sm text-[var(--color-muted)] mb-8">
          &ldquo;{q}&rdquo; için {results.length} ürün
        </p>
      ) : (
        <p className="text-sm text-[var(--color-muted)] mb-8">
          Arama yapmak için yukarıdaki kutuya yaz.
        </p>
      )}

      {q && results.length === 0 && (
        <p className="py-24 text-center text-[var(--color-muted)]">
          Sonuç bulunamadı. Farklı bir kelime dene.
        </p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <div className="h-24" />
    </div>
  );
}
