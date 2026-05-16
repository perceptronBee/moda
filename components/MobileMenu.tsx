"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Search,
  User,
  Heart,
  Sparkles,
  LogOut,
  ShoppingBag,
  ChevronRight,
  Tag,
  Store,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { MAIN_NAV, PRODUCTS } from "@/lib/products";
import { RETAILERS } from "@/lib/affiliate/retailers";

const ACTIVE_RETAILERS = Object.values(RETAILERS).filter((r) =>
  PRODUCTS.some((p) => p.retailer === r.slug),
);

type Props = {
  isLoggedIn: boolean;
  displayName: string | null;
  onLogout: () => Promise<void>;
};

export function MobileMenu({ isLoggedIn, displayName, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex items-center justify-center w-9 h-9 hover:text-[var(--color-accent)]"
        aria-label="Menüyü aç"
      >
        <Menu size={22} />
      </button>

      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      <aside
        className={`fixed top-0 right-0 z-[70] h-full w-[88%] max-w-[400px] transform transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ backgroundColor: "var(--color-bg-elev)" }}
        aria-hidden={!open}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 h-16 border-b shrink-0"
          style={{ borderColor: "var(--color-line)" }}
        >
          <span className="font-display text-2xl tracking-[0.15em]">MODA</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="-mr-2 w-10 h-10 flex items-center justify-center hover:text-[var(--color-accent)]"
            aria-label="Kapat"
          >
            <X size={22} />
          </button>
        </div>

        {/* Hoş geldin / Giriş davet */}
        {isLoggedIn ? (
          <Link
            href="/hesap"
            className="flex items-center gap-3 px-6 py-5 border-b active:opacity-70"
            style={{ borderColor: "var(--color-line)" }}
          >
            <span
              className="w-10 h-10 flex items-center justify-center"
              style={{ backgroundColor: "var(--color-bg-soft)" }}
            >
              <User size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                HOŞ GELDİN
              </p>
              <p className="text-sm font-medium truncate">
                {displayName ?? "Hesabım"}
              </p>
            </div>
            <ChevronRight size={18} className="text-[var(--color-muted)]" />
          </Link>
        ) : (
          <div
            className="flex gap-2 px-6 py-5 border-b"
            style={{ borderColor: "var(--color-line)" }}
          >
            <Link
              href="/giris"
              className="flex-1 bg-[var(--color-fg)] text-[var(--color-bg)] text-center py-3 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
            >
              Giriş Yap
            </Link>
            <Link
              href="/kayit"
              className="flex-1 border border-[var(--color-line)] text-center py-3 text-sm font-medium hover:border-[var(--color-fg)] transition-colors"
            >
              Üye Ol
            </Link>
          </div>
        )}

        {/* Arama */}
        <form
          action="/arama"
          className="px-6 py-5 border-b"
          style={{ borderColor: "var(--color-line)" }}
        >
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <input
              type="search"
              name="q"
              placeholder="Ürün, marka, kategori"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none py-3 pl-10 pr-3 text-sm transition-colors"
            />
          </div>
        </form>

        {/* Scrollable orta alan */}
        <div className="flex-1 overflow-y-auto">
          {/* AI Asistan vurgusu */}
          <Link
            href="/kombin"
            className="flex items-center gap-3 px-6 py-4 active:opacity-70"
            style={{ backgroundColor: "var(--color-bg-soft)" }}
          >
            <span
              className="w-10 h-10 flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
            >
              <Sparkles size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Kombin Öner</p>
              <p className="text-xs text-[var(--color-fg-soft)]">
                Fotoğrafına AI giydirsin
              </p>
            </div>
            <ChevronRight size={18} className="text-[var(--color-muted)]" />
          </Link>

          {/* Kategoriler */}
          <section className="py-4">
            <p className="meta px-6 mb-2">KATEGORİLER</p>
            {MAIN_NAV.map((c) => (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className="flex items-center justify-between px-6 py-3.5 text-[15px] hover:bg-[var(--color-bg-soft)] active:bg-[var(--color-bg-soft)]"
              >
                <span>{c.label}</span>
                <ChevronRight size={16} className="text-[var(--color-muted)]" />
              </Link>
            ))}
            <Link
              href="/yeni"
              className="flex items-center justify-between px-6 py-3.5 text-[15px] hover:bg-[var(--color-bg-soft)]"
            >
              <span>Yeni Gelenler</span>
              <ChevronRight size={16} className="text-[var(--color-muted)]" />
            </Link>
            <Link
              href="/indirim"
              className="flex items-center justify-between px-6 py-3.5 text-[15px] text-[var(--color-accent)] hover:bg-[var(--color-bg-soft)]"
            >
              <span className="flex items-center gap-2">
                <Tag size={14} />
                İndirim
              </span>
              <ChevronRight size={16} />
            </Link>
          </section>

          {/* Mağazalar — birden fazla aktif mağaza varsa */}
          {ACTIVE_RETAILERS.length > 1 && (
            <section
              className="py-4 border-t"
              style={{ borderColor: "var(--color-line)" }}
            >
              <p className="meta px-6 mb-3">MAĞAZALAR</p>
              <div className="grid grid-cols-2 gap-2 px-6">
                {ACTIVE_RETAILERS.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/magaza/${r.slug}`}
                    className="flex items-center gap-2 text-xs border border-[var(--color-line)] px-3 py-2.5 hover:border-[var(--color-fg)] transition-colors"
                  >
                    <Store size={12} className="text-[var(--color-muted)]" />
                    <span className="truncate">{r.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Kişisel link'ler */}
          {isLoggedIn && (
            <section
              className="py-4 border-t"
              style={{ borderColor: "var(--color-line)" }}
            >
              <p className="meta px-6 mb-2">HESABIM</p>
              <Link
                href="/favoriler"
                className="flex items-center justify-between px-6 py-3.5 text-[15px] hover:bg-[var(--color-bg-soft)]"
              >
                <span className="flex items-center gap-3">
                  <Heart size={16} className="text-[var(--color-muted)]" />
                  Favorilerim
                </span>
                <ChevronRight size={16} className="text-[var(--color-muted)]" />
              </Link>
              <Link
                href="/sepet"
                className="flex items-center justify-between px-6 py-3.5 text-[15px] hover:bg-[var(--color-bg-soft)]"
              >
                <span className="flex items-center gap-3">
                  <ShoppingBag size={16} className="text-[var(--color-muted)]" />
                  Sepetim
                </span>
                <ChevronRight size={16} className="text-[var(--color-muted)]" />
              </Link>
            </section>
          )}
        </div>

        {/* Footer — çıkış */}
        {isLoggedIn && (
          <div
            className="border-t shrink-0"
            style={{ borderColor: "var(--color-line)" }}
          >
            <form action={onLogout}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-4 text-sm text-[var(--color-accent)] hover:bg-[var(--color-bg-soft)]"
              >
                <LogOut size={16} />
                Çıkış Yap
              </button>
            </form>
          </div>
        )}
      </aside>
    </>
  );
}
