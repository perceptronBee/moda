"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

export function FloatingKombinButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/kombin")) return null;

  return (
    <Link
      href="/kombin"
      className="fixed bottom-6 right-6 z-40 group flex items-center gap-2 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors px-5 py-3 text-sm font-medium shadow-lg"
    >
      <Sparkles size={16} />
      <span>Kombin Öner</span>
    </Link>
  );
}
