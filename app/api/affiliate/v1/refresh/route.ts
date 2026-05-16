import { NextResponse } from "next/server";
import { refresh } from "@/lib/affiliate/feedCache";

/**
 * POST /api/affiliate/v1/refresh
 *
 * Tüm aktif perakendeci feed'lerini yeniden çeker (simülasyon).
 * In-memory cache'i günceller, activity log'a satır ekler.
 *
 * Gerçek hayatta: scheduled cron job veya admin paneli çağırır.
 * Demo: /affiliate sayfasındaki "Şimdi Yenile" butonu + UI timer.
 */
export async function POST() {
  const status = refresh();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
