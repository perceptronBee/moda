import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/hesap"];
const AUTH_ONLY_PATHS = ["/giris", "/kayit"];

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Cookie güvenlik flag'lerini her durumda zorla — Supabase varsayılanlarına
 * güvenme. HttpOnly XSS önler, Secure HTTPS zorlar, SameSite=Lax CSRF önler.
 */
function hardenCookieOptions(options: Record<string, unknown> | undefined) {
  return {
    ...options,
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * Session refresh + route guard.
 *
 * GÜVENLİK: Supabase env yoksa public route'lar açık kalır AMA korumalı
 * route'lar (`/hesap/*` vb.) /giris'e yönlendirilir — fail-closed.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  // Env yoksa: korumalı path'leri kilitli tut, public'lere ses çıkarma
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/giris";
      url.searchParams.set("error", "config");
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, hardenCookieOptions(options));
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthOnly = AUTH_ONLY_PATHS.includes(path);

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/hesap";
    return NextResponse.redirect(url);
  }

  return response;
}
