import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// E-posta doğrulama / password reset linkinden gelen callback.
// Supabase ?code=... query parametresi gönderir; bunu session'a çevirmemiz gerek.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/hesap";

  if (!code) {
    return NextResponse.redirect(`${origin}/giris?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/giris?error=verify_failed`);
  }

  // E-mail confirm sonrası ilk girişte profil yoksa oluştur.
  // (signUp anlık session vermediğinde profil burada yazılır.)
  const userMeta = data.user.user_metadata as { full_name?: string };
  const fullName = userMeta.full_name ?? "Kullanıcı";

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existing) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;
    await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      kvkk_accepted_at: new Date().toISOString(),
      kvkk_ip: ip,
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
