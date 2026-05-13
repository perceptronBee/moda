"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import type { Product } from "@/lib/products";
import { RETAILERS } from "@/lib/affiliate/retailers";
import { useFavorites } from "@/lib/favorites";

export function ProductCard({
  product,
  onFavoriteClick,
}: {
  product: Product;
  onFavoriteClick?: (e: React.MouseEvent) => void;
}) {
  const hasDiscount =
    product.oldPrice !== undefined && product.oldPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.oldPrice!) * 100)
    : 0;

  const { hasItem, toggleItem, mounted } = useFavorites();
  const isFavorite = mounted ? hasItem(product.id) : false;

  // Ön model > Ön giyilmemiş > arka > arka giyilmemiş
  const heroPhoto =
    product.photos?.front ||
    product.photos?.garmentFront ||
    product.photos?.back ||
    product.photos?.garmentBack;

  return (
    <Link href={`/urun/${product.id}`} className="group block">
      {/* Image */}
      <div
        className="relative aspect-[3/4] overflow-hidden mb-3"
        style={{ background: heroPhoto ? "#f5f5f5" : product.tone }}
      >
        {heroPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        )}

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
          className={`absolute top-2 right-2 sm:top-3 sm:right-3 w-9 h-9 sm:w-10 sm:h-10 bg-white/90 backdrop-blur-sm flex items-center justify-center transition-all ${
            isFavorite
              ? "opacity-100 text-[var(--color-accent)]"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-white text-[var(--color-fg)]"
          }`}
          aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
          onClick={(e) => {
            e.preventDefault();
            if (onFavoriteClick) {
              onFavoriteClick(e);
            } else {
              toggleItem(product.id);
            }
          }}
        >
          <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
        </button>

        {!heroPhoto && (
          <div className="absolute inset-0 flex items-center justify-center font-display text-7xl text-white/15 pointer-events-none">
            {product.id}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-1">
        {product.retailer && (
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-1">
            {RETAILERS[product.retailer]?.name ?? product.retailer}
          </p>
        )}
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
