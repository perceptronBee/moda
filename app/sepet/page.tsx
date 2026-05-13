"use client";

import Link from "next/link";
import { ShoppingBag, ArrowLeft, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { getProductById } from "@/lib/products";

export default function CartPage() {
  const { items, removeItem, updateQuantity, mounted } = useCart();
  
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const cartProducts = items.map(item => {
    const p = getProductById(item.productId);
    return { ...item, product: p };
  }).filter(item => item.product);

  const totalPrice = cartProducts.reduce((sum, item) => {
    return sum + (item.product!.price * item.quantity);
  }, 0);

  if (!mounted) {
    return null; // or a loading spinner
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
              <div key={`${item.productId}-${item.size || 'nosize'}`} className="flex gap-4 border-b border-[var(--color-line)] pb-6">
                <div className="w-24 aspect-[3/4] relative shrink-0" style={{ background: item.product!.tone }}>
                   <div className="absolute inset-0 flex items-center justify-center font-display text-3xl text-white/15 pointer-events-none select-none">
                     {item.product!.id}
                   </div>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <Link href={`/urun/${item.productId}`} className="font-medium hover:underline text-lg line-clamp-2">
                        {item.product!.name}
                      </Link>
                      {item.size && (
                        <p className="text-sm text-[var(--color-muted)] mt-1">Beden: <span className="font-medium text-[var(--color-fg)]">{item.size}</span></p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-sm text-[var(--color-muted)]">Adet:</span>
                        <div className="flex items-center border border-[var(--color-line)]">
                          <button 
                            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-line)] transition-colors"
                            onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <button 
                            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-line)] transition-colors"
                            onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="font-semibold whitespace-nowrap">{item.product!.price.toLocaleString("tr-TR")} TL</p>
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
              <span>{(totalPrice > 500 ? totalPrice : totalPrice + 49.99).toLocaleString("tr-TR")} TL</span>
            </div>
            <button className="w-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors font-medium py-4 text-sm tracking-wide">
              SİPARİŞİ TAMAMLA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
