import { NextResponse } from "next/server";
import { getCacheStatus } from "@/lib/affiliate/feedCache";

/**
 * GET /api/affiliate/v1/status
 *
 * Feed ingestion durumu — son refresh, sonraki tahmini refresh,
 * aktif perakendeciler, son aktivite log'u.
 */
export async function GET() {
  return NextResponse.json(getCacheStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
