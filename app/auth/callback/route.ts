import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, safeNextPath } from "@/lib/security/siteUrl";
import { getClientIp } from "@/lib/security/ip";

// E-posta doğrulama / password reset callback'i.
// `code` parametresini session'a çevirir.
// `next` parametresi SADECE internal path olabilir (open redirect koruması).
export async function GET(request: NextRequest) {
  const siteUrl = getSiteUrl();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // Open redirect koruması — sadece "/" ile başlayan internal path
  const next = safeNextPath(searchParams.get("next"), "/hesap");

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/giris?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${siteUrl}/giris?error=verify_failed`);
  }

  const userMeta = data.user.user_metadata as { full_name?: string };
  const fullName = userMeta.full_name ?? "Kullanıcı";

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existing) {
    const ip = getClientIp(request.headers);
    await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      kvkk_accepted_at: new Date().toISOString(),
      kvkk_ip: ip,
    });
  }

  return NextResponse.redirect(`${siteUrl}${next}`);
}
