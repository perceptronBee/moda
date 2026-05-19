import Link from "next/link";
import { Search, User, LogOut } from "lucide-react";
import { MAIN_NAV } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { CartIcon } from "@/components/CartIcon";
import { FavoriteIcon } from "@/components/FavoriteIcon";
import { MobileMenu } from "@/components/MobileMenu";

export async function Navbar() {
  let user: { id: string; email?: string } | null = null;
  let displayName: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      displayName =
        profile?.full_name ?? user.email?.split("@")[0] ?? "Hesabım";
    }
  } catch {
    // Supabase env yok — anonim moda devam et
  }

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "var(--color-bg-elev)",
        borderColor: "var(--color-line)",
      }}
    >
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-10 gap-4 md:gap-8">
        {/* Logo */}
        <Link
          href="/"
          className="font-display text-2xl md:text-3xl tracking-[0.15em] shrink-0 hover:opacity-70 transition-opacity"
        >
          MODA
        </Link>

        {/* Category nav */}
        <nav className="hidden md:flex items-center gap-7">
          {MAIN_NAV.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
            >
              {c.label}
            </Link>
          ))}
          <Link
            href="/yeni"
            className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
          >
            Yeni
          </Link>
          <Link
            href="/indirim"
            className="text-sm font-medium text-[var(--color-accent)] hover:opacity-70 transition-opacity"
          >
            İndirim
          </Link>
        </nav>

        {/* Search */}
        <form action="/arama" method="get" role="search" className="hidden lg:flex flex-1 max-w-md">
          <div className="relative w-full">
            <button
              type="submit"
              aria-label="Ara"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              <Search size={16} />
            </button>
            <input
              type="search"
              name="q"
              placeholder="Ürün, marka veya kategori ara"
              autoComplete="off"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none py-2.5 pl-10 pr-3 text-sm transition-colors"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-4 md:gap-5 shrink-0">
          {user ? (
            <>
              <Link
                href="/hesap"
                className="hidden md:flex items-center gap-2 text-sm hover:text-[var(--color-accent)] transition-colors max-w-[160px]"
                title={displayName ?? "Hesabım"}
              >
                <User size={18} />
                <span className="truncate">{displayName}</span>
              </Link>
              <form action={logout} className="hidden md:flex">
                <button
                  type="submit"
                  className="flex items-center hover:text-[var(--color-accent)] transition-colors"
                  aria-label="Çıkış yap"
                >
                  <LogOut size={18} />
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/giris"
              className="hidden md:flex items-center gap-2 text-sm hover:text-[var(--color-accent)] transition-colors"
            >
              <User size={18} />
              <span>Giriş</span>
            </Link>
          )}

          <span className="hidden md:flex"><FavoriteIcon /></span>
          <CartIcon />

          {/* Mobile hamburger */}
          <MobileMenu
            isLoggedIn={!!user}
            displayName={displayName}
            onLogout={logout}
          />
        </div>
      </div>
    </header>
  );
}
