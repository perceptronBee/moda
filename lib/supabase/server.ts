import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Components ve Server Actions içinde kullanılan Supabase client.
 * Next.js 16'da cookies() async olduğu için createClient de async.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env değişkenleri eksik. .env.local içine NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY ekle.",
    );
  }
  const cookieStore = await cookies();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component'lerde cookie set çağrılamaz — proxy.ts session'ı tazeleyecek.
          }
        },
      },
    },
  );
}
