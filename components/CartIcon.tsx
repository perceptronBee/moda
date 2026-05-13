"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

export function CartIcon() {
  const { items, mounted } = useCart();
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link
      href="/sepet"
      className="flex items-center gap-2 text-sm hover:text-[var(--color-accent)] transition-colors"
    >
      <ShoppingBag size={18} />
      <span className="hidden sm:inline">Sepet</span>
      <span className="text-[var(--color-muted)]">({mounted ? totalCount : 0})</span>
    </Link>
  );
}
