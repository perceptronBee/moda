"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, ArrowLeft, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { getProductById } from "@/lib/products";
import { safeProductPhoto, safeExternalUrl } from "@/lib/security/siteUrl";
import { RETAILERS } from "@/lib/affiliate/retailers";

// Affiliate UTM params: LCW tarafında trafiğin nereden geldiğini görebilsin
function withAffiliateParams(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "moda");
    u.searchParams.set("utm_medium", "affiliate");
    u.searchParams.set("utm_campaign", "cart_handoff");
    return u.toString();
  } catch {
    return url;
  }
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, mounted } = useCart();
  const [handoffStage, setHandoffStage] = useState<"idle" | "redirecting">("idle");

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const cartProducts = items
    .map((item) => {
      const p = getProductById(item.productId);
      return { ...item, product: p };
    })
    .filter((item) => item.product);

  const totalPrice = cartProducts.reduce((sum, item) => {
    return sum + item.product!.price * item.quantity;
  }, 0);

  // ─── Affiliate handoff ─────────────────────────────────────────────────
  // "Sipariş Tamamla" → her ürünün perakendecisinin sayfasını yeni sekmede aç
  // (auto-cart API yok, kullanıcı her birini retailer'da onaylar).
  async function handoffToRetailers() {
    setHandoffStage("redirecting");

    // 1. Click event'lerini track et (komisyon takibi)
    cartProducts.forEach((item) => {
      const deeplink = item.product!.deeplink;
      if (!deeplink) return;
      fetch("/api/affiliate/v1/track/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: item.productId,
          retailer: item.product!.retailer,
          source: "cart_handoff",
        }),
      }).catch(() => {
        /* track best-effort, fail silently */
      });
    });

    // 2. Kısa UX gecikmesi (kullanıcı "yönlendiriliyor" mesajını görsün)
    await new Promise((r) => setTimeout(r, 800));

    // 3. Her ürünün deeplink'ini yeni sekmede aç (popup blocker'a takılmasın diye
    //    user gesture içinde, sequential)
    for (const item of cartProducts) {
      const safe = safeExternalUrl(item.product!.deeplink);
      if (!safe) continue;
      window.open(withAffiliateParams(safe), "_blank", "noopener,noreferrer");
    }

    // 4. State sıfırla — kullanıcı geri dönmek isterse
    setTimeout(() => setHandoffStage("idle"), 1500);
  }

  if (!mounted) {
    return null;
  }

  return (
    <div className="px-6 lg:px-10 py-10 max-w-5xl mx-auto w-full">
      <Link
        href="/"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2 mb-6"
      >
        <ArrowLeft size={14} /> Alışverişe Devam Et
      </Link>

      <h1 className="font-display text-4xl tracking-wide mb-2">Sepetim</h1>
      <p className="text-sm text-[var(--color-muted)] mb-10">{totalCount} ürün</p>

      {cartProducts.length === 0 ? (
        <div className="bg-[var(--color-bg-elev)] border border-[var(--color-line)] flex flex-col items-center justify-center py-24 gap-5">
          <ShoppingBag size={48} className="text-[var(--color-muted)]" />
          <p className="text-base">Sepetiniz şu anda boş.</p>
          <Link
            href="/"
            className="bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors px-8 py-3 text-sm font-medium tracking-wide"
          >
            ALIŞVERİŞE BAŞLA
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-10">
          <div className="space-y-6">
            {cartProducts.map((item) => (
              <div
                key={`${item.productId}-${item.size || "nosize"}`}
                className="flex gap-4 border-b border-[var(--color-line)] pb-6"
              >
                <Link
                  href={`/urun/${item.productId}`}
                  className="w-24 aspect-[3/4] relative shrink-0 overflow-hidden"
                  style={{ backgroundColor: "var(--color-bg-elev)" }}
                >
                  {(() => {
                    const photo = safeProductPhoto(item.product!.photos?.front);
                    return photo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={photo}
                        alt={item.product!.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--color-muted)]">
                        Foto yok
                      </div>
                    );
                  })()}
                </Link>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <Link
                        href={`/urun/${item.productId}`}
                        className="font-medium hover:underline text-lg line-clamp-2"
                      >
                        {item.product!.name}
                      </Link>
                      {item.size && (
                        <p className="text-sm text-[var(--color-muted)] mt-1">
                          Beden:{" "}
                          <span className="font-medium text-[var(--color-fg)]">
                            {item.size}
                          </span>
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-sm text-[var(--color-muted)]">Adet:</span>
                        <div className="flex items-center border border-[var(--color-line)]">
                          <button
                            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-line)] transition-colors"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.size,
                                item.quantity - 1,
                              )
                            }
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-line)] transition-colors"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.size,
                                item.quantity + 1,
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="font-semibold whitespace-nowrap">
                      {item.product!.price.toLocaleString("tr-TR")} TL
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId, item.size)}
                    className="flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-red-600 mt-4 transition-colors w-fit"
                  >
                    <Trash2 size={14} /> Sil
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[var(--color-bg-elev)] border border-[var(--color-line)] p-5 lg:p-6 h-fit lg:sticky lg:top-20">
            <h2 className="font-display text-2xl mb-6">Sipariş Özeti</h2>
            <div className="flex justify-between mb-4">
              <span className="text-[var(--color-muted)]">Ara Toplam</span>
              <span>{totalPrice.toLocaleString("tr-TR")} TL</span>
            </div>
            <div className="flex justify-between mb-6 pb-6 border-b border-[var(--color-line)]">
              <span className="text-[var(--color-muted)]">Kargo</span>
              <span>{totalPrice > 500 ? "Ücretsiz" : "49.99 TL"}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold mb-8">
              <span>Toplam</span>
              <span>
                {(totalPrice > 500 ? totalPrice : totalPrice + 49.99).toLocaleString(
                  "tr-TR",
                )}{" "}
                TL
              </span>
            </div>

            {/* Hangi perakendecilere yönlenecek özeti */}
            {(() => {
              const grouped = cartProducts.reduce<Record<string, number>>(
                (acc, item) => {
                  const r = item.product!.retailer || "diger";
                  acc[r] = (acc[r] ?? 0) + 1;
                  return acc;
                },
                {},
              );
              const retailerList = Object.entries(grouped);
              if (retailerList.length === 0) return null;
              return (
                <div className="text-xs text-[var(--color-fg-soft)] mb-4 leading-relaxed">
                  Satın alma adımı her bir perakendecide tamamlanacak:
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {retailerList.map(([slug, count]) => {
                      const name =
                        RETAILERS[slug as keyof typeof RETAILERS]?.name ?? slug;
                      return (
                        <span
                          key={slug}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-line)]"
                        >
                          <ExternalLink size={11} />
                          {name} · {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <button
              onClick={handoffToRetailers}
              disabled={handoffStage === "redirecting" || cartProducts.length === 0}
              className="w-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium py-4 text-sm tracking-wide flex items-center justify-center gap-2"
            >
              {handoffStage === "redirecting" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  PERAKENDECILERE YÖNLENDİRİLİYOR...
                </>
              ) : (
                <>
                  SİPARİŞİ TAMAMLA
                  <ExternalLink size={14} />
                </>
              )}
            </button>

            <p className="text-[10px] text-[var(--color-muted)] mt-3 text-center leading-relaxed">
              Sepetindeki her ürün için ilgili perakendecinin (örn. LC Waikiki)
              sayfası yeni sekmede açılır.
              <br />
              Ödeme adımı perakendecide tamamlanır.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
