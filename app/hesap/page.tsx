import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, LogOut, Settings, ShoppingBag, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { getSignedPhotoUrl } from "@/app/actions/profile";

export default async function AccountPage() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect("/giris");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const frontUrl = profile?.front_photo_path
    ? await getSignedPhotoUrl(profile.front_photo_path)
    : null;
  const backUrl = profile?.back_photo_path
    ? await getSignedPhotoUrl(profile.back_photo_path)
    : null;

  const hasPhotos = Boolean(frontUrl);

  return (
    <div className="px-6 lg:px-10 py-10 max-w-5xl mx-auto w-full">
      <header className="flex items-end justify-between flex-wrap gap-4 mb-10 pb-6 border-b border-[var(--color-line)]">
        <div>
          <p className="meta mb-2">HOŞ GELDİN</p>
          <h1 className="font-display text-4xl tracking-wide">
            {profile?.full_name ?? "Kullanıcı"}
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">{user.email}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 text-sm border border-[var(--color-line)] hover:border-[var(--color-fg)] px-4 py-2.5 transition-colors"
          >
            <LogOut size={14} /> Çıkış Yap
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8">
        {/* Photos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl tracking-wide">
              Fotoğraflarım
            </h2>
            <Link
              href="/hesap/foto-yukle"
              className="text-xs underline hover:text-[var(--color-accent)]"
            >
              {hasPhotos ? "Değiştir" : "Yükle"}
            </Link>
          </div>

          {!hasPhotos ? (
            <Link
              href="/hesap/foto-yukle"
              className="block border-2 border-dashed border-[var(--color-line-strong)] hover:border-[var(--color-fg)] aspect-[3/4] flex flex-col items-center justify-center gap-3 transition-colors"
              style={{ backgroundColor: "var(--color-bg-soft)" }}
            >
              <Camera size={36} className="text-[var(--color-muted)]" />
              <p className="text-sm">Try-on için fotoğraf yükle</p>
              <span className="text-xs text-[var(--color-muted)]">
                ön + arka (opsiyonel)
              </span>
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <PhotoTile label="ÖN" url={frontUrl} />
              <PhotoTile
                label="ARKA"
                url={backUrl}
                aiGenerated={profile?.back_is_ai_generated}
              />
            </div>
          )}
        </section>

        {/* Quick links */}
        <section>
          <h2 className="font-display text-xl tracking-wide mb-4">
            Hesap Yönetimi
          </h2>
          <div className="grid grid-cols-1 gap-3">
            <AccountLink
              href="/kombin"
              icon={<Sparkles size={18} />}
              title="Kombin Öner"
              desc="Yapay zekadan kombin önerisi al"
            />
            <AccountLink
              href="/sepet"
              icon={<ShoppingBag size={18} />}
              title="Sepetim"
              desc="Kayıtlı ürünlerini gör"
            />
            <AccountLink
              href="/hesap/ayarlar"
              icon={<Settings size={18} />}
              title="Hesap Ayarları"
              desc="Bilgilerini güncelle"
            />
          </div>
        </section>
      </div>

      <div className="h-24" />
    </div>
  );
}

function PhotoTile({
  label,
  url,
  aiGenerated,
}: {
  label: string;
  url: string | null;
  aiGenerated?: boolean;
}) {
  return (
    <div
      className="relative aspect-[3/4] overflow-hidden"
      style={{ backgroundColor: "var(--color-bg-soft)" }}
    >
      <span className="absolute top-2 left-2 meta z-10 bg-[var(--color-bg-elev)] px-2 py-1">
        {label}
      </span>
      {aiGenerated && (
        <span className="absolute top-2 right-2 meta z-10 bg-[var(--color-fg)] text-[var(--color-bg)] px-2 py-1">
          AI
        </span>
      )}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--color-muted)]">
          <Camera size={28} />
        </div>
      )}
    </div>
  );
}

function AccountLink({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 border border-[var(--color-line)] hover:border-[var(--color-fg)] px-5 py-4 transition-colors"
      style={{ backgroundColor: "var(--color-bg-elev)" }}
    >
      <span className="text-[var(--color-fg)]">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--color-muted)]">{desc}</p>
      </div>
    </Link>
  );
}
