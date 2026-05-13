"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/favorites";

export function FavoriteIcon() {
  const { items, mounted } = useFavorites();
  const count = items.length;

  return (
    <Link
      href="/favoriler"
      className="hidden md:flex items-center gap-2 text-sm hover:text-[var(--color-accent)] transition-colors"
      aria-label="Favoriler"
    >
      <Heart size={18} />
      <span className="text-[var(--color-muted)]">({mounted ? count : 0})</span>
    </Link>
  );
}
