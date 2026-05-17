"use server";

import { createClient } from "@/lib/supabase/server";
import { refresh, getCacheStatus, type FeedStatus } from "@/lib/affiliate/feedCache";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";

/**
 * Manual feed refresh — sadece giriş yapmış kullanıcılar tetikleyebilir.
 * Demo amaçlı; production'da ek role check (admin) gerekir.
 */
export async function triggerFeedRefresh(): Promise<
  { ok: true; status: FeedStatus } | { ok: false; error: string }
> {
  // Auth check
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Sistem yapılandırması eksik" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Önce giriş yapmalısın" };
  }

  // Rate limit — kullanıcı başına
  const rl = rateLimit(`refresh-user:${user.id}`, RATE_LIMITS.refresh);
  if (!rl.ok) {
    return {
      ok: false,
      error: `Çok hızlı, ${rl.retryAfter} sn sonra dene`,
    };
  }

  return { ok: true, status: refresh() };
}

export async function getFeedStatus(): Promise<FeedStatus> {
  return getCacheStatus();
}
