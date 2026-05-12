import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSignedPhotoUrl, requestAiBackGeneration } from "@/app/actions/profile";
import { PhotoUploader } from "@/components/PhotoUploader";

export default async function UploadPhotosPage() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect("/giris?next=/hesap/foto-yukle");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris?next=/hesap/foto-yukle");

  const { data: profile } = await supabase
    .from("profiles")
    .select("front_photo_path, back_photo_path, back_is_ai_generated")
    .eq("id", user.id)
    .maybeSingle();

  const frontUrl = profile?.front_photo_path
    ? await getSignedPhotoUrl(profile.front_photo_path)
    : null;
  const backUrl = profile?.back_photo_path
    ? await getSignedPhotoUrl(profile.back_photo_path)
    : null;

  return (
    <div className="px-6 lg:px-10 py-10 max-w-4xl mx-auto w-full">
      <Link
        href="/hesap"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2 mb-6"
      >
        <ArrowLeft size={14} /> Hesabıma Dön
      </Link>

      <header className="mb-10 pb-6 border-b border-[var(--color-line)]">
        <p className="meta mb-2">PROFİL</p>
        <h1 className="font-display text-4xl tracking-wide">Fotoğraflarım</h1>
        <p className="text-sm text-[var(--color-muted)] mt-2 max-w-2xl">
          Try-on için ön fotoğrafın zorunlu, arka fotoğrafı yüklemezsen yapay
          zeka ön fotoğrafından arkayı üretebilir. Fotoğrafların kimseyle
          paylaşılmaz, sadece sen erişebilirsin.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <PhotoUploader
          side="front"
          label="ÖN FOTOĞRAF"
          description="Önden çekilmiş, tam veya yarım boy net görsel."
          required
          initialUrl={frontUrl}
        />
        <div className="flex flex-col gap-3">
          <PhotoUploader
            side="back"
            label="ARKA FOTOĞRAF"
            description="Arkadan çekilmiş net görsel. Yüklemezsen AI üretir."
            initialUrl={backUrl}
          />
          {!backUrl && (
            <form action={requestAiBackGeneration}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 border border-[var(--color-line)] hover:border-[var(--color-fg)] py-3 text-sm transition-colors"
              >
                <Sparkles size={14} /> Arka Fotoğrafı AI Üretsin
              </button>
            </form>
          )}
          {profile?.back_is_ai_generated && (
            <p className="text-xs text-[var(--color-muted)]">
              Arka fotoğraf yapay zeka tarafından üretilecek.
            </p>
          )}
        </div>
      </div>

      <div className="mt-10 flex justify-end">
        <Link
          href="/hesap"
          className="bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors px-8 py-3 text-sm font-medium tracking-wide"
        >
          KAYDET VE DEVAM ET
        </Link>
      </div>

      <div className="h-24" />
    </div>
  );
}
