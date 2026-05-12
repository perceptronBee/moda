import Link from "next/link";
import { Search, User, ShoppingBag, Heart, LogOut } from "lucide-react";
import { MAIN_NAV } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";

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
      <div className="flex items-center justify-between h-16 px-6 lg:px-10 gap-8">
        {/* Logo */}
        <Link
          href="/"
          className="font-display text-3xl tracking-[0.15em] shrink-0 hover:opacity-70 transition-opacity"
        >
          MODA
        </Link>

        {/* Category nav */}
        <nav className="hidden md:flex items-center gap-8">
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
            href="/?tag=indirim"
            className="text-sm font-medium text-[var(--color-accent)] hover:opacity-70 transition-opacity"
          >
            İndirim
          </Link>
        </nav>

        {/* Search */}
        <div className="hidden lg:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              size={16}
            />
            <input
              type="text"
              placeholder="Ürün, marka veya kategori ara"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none py-2.5 pl-10 pr-3 text-sm transition-colors"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 shrink-0">
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

          <button
            type="button"
            className="hidden md:flex items-center hover:text-[var(--color-accent)] transition-colors"
            aria-label="Favoriler"
          >
            <Heart size={18} />
          </button>
          <Link
            href="/sepet"
            className="flex items-center gap-2 text-sm hover:text-[var(--color-accent)] transition-colors"
          >
            <ShoppingBag size={18} />
            <span className="hidden sm:inline">Sepet</span>
            <span className="text-[var(--color-muted)]">(0)</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
