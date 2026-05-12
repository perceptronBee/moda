"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import type { Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const hasDiscount =
    product.oldPrice !== undefined && product.oldPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.oldPrice!) * 100)
    : 0;

  return (
    <Link href={`/urun/${product.id}`} className="group block">
      {/* Image */}
      <div
        className="relative aspect-[3/4] overflow-hidden mb-3"
        style={{ background: product.tone }}
      >
        {product.tag && (
          <span
            className={`absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 ${
              product.tag === "İndirim"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-white text-[var(--color-fg)]"
            }`}
          >
            {product.tag}
          </span>
        )}

        <button
          type="button"
          className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white transition-all"
          aria-label="Favorilere ekle"
          onClick={(e) => e.preventDefault()}
        >
          <Heart size={16} />
        </button>

        <div className="absolute inset-0 flex items-center justify-center font-display text-7xl text-white/15 pointer-events-none">
          {product.id}
        </div>
      </div>

      {/* Info */}
      <div className="px-1">
        <p className="text-sm text-[var(--color-fg)] mb-1 leading-snug line-clamp-2">
          {product.name}
        </p>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-sm font-semibold ${hasDiscount ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]"}`}
          >
            {product.price.toLocaleString("tr-TR")} TL
          </span>
          {hasDiscount && (
            <>
              <span className="text-xs text-[var(--color-muted)] line-through">
                {product.oldPrice!.toLocaleString("tr-TR")} TL
              </span>
              <span className="text-xs text-[var(--color-accent)] font-medium">
                %{discountPct}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
