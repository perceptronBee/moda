"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

export function FloatingKombinButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/kombin")) return null;

  // Ürün detay mobilde sticky "Sepete Ekle" bar var — çakışmasın diye gizle.
  // Desktop'ta gözüksün.
  const onProductDetail = pathname?.startsWith("/urun/");

  return (
    <Link
      href="/kombin"
      aria-label="Kombin Öner"
      className={`${
        onProductDetail ? "hidden lg:flex" : "flex"
      } fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 items-center gap-2 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors px-4 md:px-5 py-3 text-sm font-medium shadow-lg`}
    >
      <Sparkles size={16} />
      <span>Kombin Öner</span>
    </Link>
  );
}
