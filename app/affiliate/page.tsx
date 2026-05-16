import Link from "next/link";
import { RETAILERS } from "@/lib/affiliate/retailers";
import { PRODUCTS } from "@/lib/products";
import { getCacheStatus } from "@/lib/affiliate/feedCache";
import { RefreshPanel } from "@/components/affiliate/RefreshPanel";

export const metadata = { title: "MODA Affiliate Network API" };

export const dynamic = "force-dynamic"; // refresh state her zaman güncel olsun

export default function AffiliateApiPage() {
  const products = PRODUCTS;
  const stats = Object.values(RETAILERS).map((r) => ({
    ...r,
    productCount: products.filter((p) => p.retailer === r.slug).length,
  }));

  const totalProducts = products.length;
  const activeRetailers = stats.filter((s) => s.productCount > 0).length;
  const feedStatus = getCacheStatus();

  return (
    <div className="px-6 lg:px-10 py-10 max-w-5xl mx-auto w-full">
      <header className="mb-10 pb-6 border-b border-[var(--color-line)]">
        <p className="meta mb-2 text-[var(--color-muted)]">
          AFFILIATE NETWORK API · V1
        </p>
        <h1 className="font-display text-5xl tracking-wide mb-3">
          MODA Network
        </h1>
        <p className="text-[var(--color-fg-soft)] max-w-2xl">
          Perakendecileri tek katalogda birleştiren affiliate network API'si.
          Publisher'lar bu API'ye bağlanır, kullanıcılar ürünü görür,
          tıkladığında perakendeciye yönlendirilir, publisher komisyon
          kazanır.
        </p>
      </header>

      {/* Canlı feed ingestion paneli — son refresh, countdown, manuel buton */}
      <RefreshPanel initial={feedStatus} />

      <section className="grid grid-cols-3 gap-4 mb-12">
        <Stat label="AKTİF PERAKENDECİ" value={activeRetailers} />
        <Stat label="TOPLAM ÜRÜN" value={totalProducts} />
        <Stat label="API VERSİYON" value="v1.0" />
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl tracking-wide mb-4">
          Perakendeciler
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stats.map((r) => (
            <div
              key={r.slug}
              className="border border-[var(--color-line)] p-5"
              style={{ backgroundColor: "var(--color-bg-elev)" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-base">{r.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {r.domain}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-line)]">
                  %{(r.commission * 100).toFixed(0)} komisyon
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">
                  {r.productCount} ürün
                </span>
                <Link
                  href={`/api/affiliate/v1/feeds/${r.slug}`}
                  className="underline text-xs hover:text-[var(--color-accent)]"
                  target="_blank"
                >
                  XML feed →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl tracking-wide mb-4">
          API Endpoint'leri
        </h2>
        <div className="flex flex-col gap-2 font-mono text-sm">
          <Endpoint method="GET" path="/api/affiliate/v1/status" />
          <Endpoint method="POST" path="/api/affiliate/v1/refresh" />
          <Endpoint method="GET" path="/api/affiliate/v1/feeds" />
          <Endpoint method="GET" path="/api/affiliate/v1/feeds/{retailer}" />
          <Endpoint method="GET" path="/api/affiliate/v1/products" />
          <Endpoint method="GET" path="/api/affiliate/v1/products/{id}" />
          <Endpoint method="POST" path="/api/affiliate/v1/track/click" />
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-4">
          Tüm istekler{" "}
          <code className="bg-[var(--color-bg-elev)] px-1.5 py-0.5">
            X-Publisher-Key
          </code>{" "}
          header'ı ister. Demo'da herhangi bir değer geçerli.
        </p>
      </section>

      <section>
        <h2 className="font-display text-2xl tracking-wide mb-4">
          Örnek Kullanım
        </h2>
        <pre
          className="text-xs p-5 overflow-x-auto border border-[var(--color-line)]"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          {`# Tüm ürünleri çek
curl -H "X-Publisher-Key: demo" \\
  http://localhost:3000/api/affiliate/v1/products

# Sadece LCW erkek üst giyim
curl -H "X-Publisher-Key: demo" \\
  "http://localhost:3000/api/affiliate/v1/products?retailer=lcwaikiki&gender=erkek&category=ust-giyim"

# Click tracking (yönlendirme + komisyon hesaplama)
curl -X POST http://localhost:3000/api/affiliate/v1/track/click \\
  -H "Content-Type: application/json" \\
  -d '{"productId":"LCW-300123456","publisherKey":"demo","userId":"u_42"}'`}
        </pre>
      </section>

      <div className="h-24" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="p-5 border border-[var(--color-line)]"
      style={{ backgroundColor: "var(--color-bg-elev)" }}
    >
      <p className="meta mb-2">{label}</p>
      <p className="font-display text-4xl tracking-wide">{value}</p>
    </div>
  );
}

function Endpoint({ method, path }: { method: string; path: string }) {
  const color =
    method === "GET"
      ? "var(--color-fg)"
      : method === "POST"
        ? "var(--color-accent)"
        : "var(--color-muted)";
  return (
    <div className="flex items-center gap-3 border border-[var(--color-line)] px-3 py-2">
      <span
        className="text-xs font-semibold px-2 py-1 text-white"
        style={{ backgroundColor: color }}
      >
        {method}
      </span>
      <span>{path}</span>
    </div>
  );
}
