"use client";

import { Heart, Check, ShoppingBag } from "lucide-react";
import { cartStore } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useState, useEffect, useRef } from "react";

type Props = {
  productId: string;
  sizes?: string[];
  price?: number;
  oldPrice?: number;
  productName?: string;
};

export function ProductActions({ productId, sizes, price, oldPrice, productName }: Props) {
  const { hasItem, toggleItem, mounted } = useFavorites();
  const isFavorite = mounted ? hasItem(productId) : false;
  const [selectedSize, setSelectedSize] = useState<string | undefined>(
    sizes && sizes.length > 0 ? sizes[0] : undefined,
  );
  const [showSheet, setShowSheet] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // setTimeout ref'i — unmount'ta cleanup için (memory leak önle)
  const justAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (justAddedTimer.current) clearTimeout(justAddedTimer.current);
    };
  }, []);

  const addToCart = () => {
    if (sizes && sizes.length > 0 && !selectedSize) {
      setShowSheet(true);
      return;
    }
    cartStore.addItem(productId, selectedSize);
    setJustAdded(true);
    setShowSheet(false);
    if (justAddedTimer.current) clearTimeout(justAddedTimer.current);
    justAddedTimer.current = setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <>
      {/* Desktop / mobil inline — beden + butonlar */}
      <div className="flex flex-col gap-6">
        {sizes && sizes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Beden Seçin</p>
              <button className="text-xs underline text-[var(--color-muted)]">
                Beden Tablosu
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={`min-w-[52px] min-h-[44px] border px-4 py-2.5 text-sm transition-colors ${
                    selectedSize === s
                      ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                      : "border-[var(--color-line)] hover:border-[var(--color-fg)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobilde gizli (sticky bar var), desktop'ta gösterilir */}
        <div className="hidden lg:flex gap-3">
          <button
            type="button"
            onClick={addToCart}
            className="flex-1 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors font-medium py-4 text-sm tracking-wide flex items-center justify-center gap-2"
          >
            {justAdded ? (
              <>
                <Check size={16} /> EKLENDİ
              </>
            ) : (
              "SEPETE EKLE"
            )}
          </button>
          <button
            type="button"
            onClick={() => toggleItem(productId)}
            className={`w-14 border flex items-center justify-center transition-colors ${
              isFavorite
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-line)] hover:border-[var(--color-fg)]"
            }`}
            aria-label="Favorilere ekle"
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {/* Mobile: sticky alt bar */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t"
        style={{
          backgroundColor: "var(--color-bg-elev)",
          borderColor: "var(--color-line)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-stretch gap-2 p-3">
          <button
            type="button"
            onClick={() => toggleItem(productId)}
            aria-label="Favorilere ekle"
            className={`w-12 shrink-0 border flex items-center justify-center transition-colors ${
              isFavorite
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-line)]"
            }`}
          >
            <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          {price !== undefined && (
            <div className="flex flex-col justify-center px-2 min-w-0">
              <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider leading-none">
                Fiyat
              </p>
              <p
                className={`text-base font-semibold leading-tight ${oldPrice ? "text-[var(--color-accent)]" : ""}`}
              >
                {price.toLocaleString("tr-TR")} TL
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={addToCart}
            className="flex-1 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors font-medium text-sm tracking-wide flex items-center justify-center gap-2"
          >
            {justAdded ? (
              <>
                <Check size={16} /> EKLENDİ
              </>
            ) : (
              <>
                <ShoppingBag size={16} /> SEPETE EKLE
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile beden seçme bottom sheet */}
      {showSheet && sizes && (
        <div
          className="lg:hidden fixed inset-0 z-[80] flex items-end"
          onClick={() => setShowSheet(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full"
            style={{
              backgroundColor: "var(--color-bg-elev)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-line)" }}>
              <p className="text-sm font-medium">
                {productName ? `${productName} için beden seç` : "Beden Seç"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 p-5">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSelectedSize(s);
                    cartStore.addItem(productId, s);
                    setJustAdded(true);
                    setShowSheet(false);
                    if (justAddedTimer.current)
                      clearTimeout(justAddedTimer.current);
                    justAddedTimer.current = setTimeout(
                      () => setJustAdded(false),
                      2000,
                    );
                  }}
                  className="min-h-[52px] border border-[var(--color-line)] hover:border-[var(--color-fg)] text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowSheet(false)}
              className="w-full text-center py-3 text-sm text-[var(--color-muted)] border-t"
              style={{ borderColor: "var(--color-line)" }}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </>
  );
}
