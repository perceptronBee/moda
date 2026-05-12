import Link from "next/link";
import { ShoppingBag, ArrowLeft } from "lucide-react";

export default function CartPage() {
  return (
    <div className="px-6 lg:px-10 py-10 max-w-5xl mx-auto w-full">
      <Link
        href="/"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2 mb-6"
      >
        <ArrowLeft size={14} /> Alışverişe Devam Et
      </Link>

      <h1 className="font-display text-4xl tracking-wide mb-2">Sepetim</h1>
      <p className="text-sm text-[var(--color-muted)] mb-10">0 ürün</p>

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
    </div>
  );
}
