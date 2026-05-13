"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Heart, ArrowLeft } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { getProductById } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export default function FavoritesPage() {
  const { items: storeItems, mounted, toggleItem } = useFavorites();
  const [displayItems, setDisplayItems] = useState<string[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  // Sadece eklemeleri (yeni favorileri) anında ekranda gösteririz
  useEffect(() => {
    setDisplayItems(prev => {
      const prevSet = new Set(prev);
      const storeSet = new Set(storeItems);
      const merged = [...prev];
      for (const id of storeItems) {
        if (!prevSet.has(id)) merged.push(id);
      }
      return merged.filter(id => storeSet.has(id) || removing.has(id));
    });
  }, [storeItems, removing]);

  const handleRemove = useCallback((productId: string) => {
    // 1. Animasyonu başlat (isRemoving = true olacak)
    setRemoving(prev => new Set(prev).add(productId));
    
    // 2. Animasyon bittikten sonra gerçekten sil
    setTimeout(() => {
      toggleItem(productId);
      setRemoving(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setDisplayItems(prev => prev.filter(id => id !== productId));
    }, 400); // 400ms transition süresi
  }, [toggleItem]);

  const actualCount = displayItems.filter(id => !removing.has(id)).length;

  if (!mounted) return null;

  return (
    <div className="px-6 lg:px-10 py-10 max-w-7xl mx-auto w-full">
      <Link
        href="/"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2 mb-6"
      >
        <ArrowLeft size={14} /> Alışverişe Devam Et
      </Link>

      <h1 className="font-display text-4xl tracking-wide mb-2">Favorilerim</h1>
      <p className="text-sm text-[var(--color-muted)] mb-10">{actualCount} ürün</p>

      {displayItems.length === 0 ? (
        <div className="bg-[var(--color-bg-elev)] border border-[var(--color-line)] flex flex-col items-center justify-center py-24 gap-5 max-w-5xl mx-auto">
          <Heart size={48} className="text-[var(--color-muted)]" />
          <p className="text-base">Henüz favorilere ürün eklemediniz.</p>
          <Link
            href="/"
            className="bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors px-8 py-3 text-sm font-medium tracking-wide"
          >
            ALIŞVERİŞE BAŞLA
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {displayItems.map(id => {
            const product = getProductById(id);
            if (!product) return null;
            const isRemoving = removing.has(id);
            return (
              <div
                key={id}
                className={`transition-all duration-400 ease-in transform origin-center ${
                  isRemoving ? "opacity-0 scale-75 blur-md pointer-events-none" : "opacity-100 scale-100 blur-none"
                }`}
              >
                <ProductCard 
                  product={product} 
                  onFavoriteClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isRemoving) handleRemove(id);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
