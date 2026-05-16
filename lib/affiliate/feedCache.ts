// Affiliate feed ingestion simülasyonu — in-memory cache + activity log.
// Module-level singleton, server restart'ta sıfırlanır.

import { PRODUCTS } from "@/lib/products";
import { RETAILERS } from "./retailers";

export const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 dakika

export type FeedActivity = {
  at: string;
  retailer: string;
  retailerName: string;
  productsCount: number;
  pricesChanged: number;
  newProducts: number;
};

export type RetailerStatus = {
  slug: string;
  name: string;
  productCount: number;
  active: boolean;
  lastSync: string;
};

export type FeedStatus = {
  lastRefresh: string;
  nextRefresh: string;
  refreshIntervalMs: number;
  totalProducts: number;
  totalRetailers: number;
  activeRetailers: number;
  retailers: RetailerStatus[];
  recentActivity: FeedActivity[];
};

let lastRefresh: Date | null = null;
const activity: FeedActivity[] = [];

function deterministicRandom(seed: string, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % Math.max(1, max);
}

// İlk çağrıda init et — server start zamanını lastRefresh olarak ata
function init() {
  if (lastRefresh) return;
  lastRefresh = new Date();
  const activeRetailers = Object.values(RETAILERS).filter((r) =>
    PRODUCTS.some((p) => p.retailer === r.slug),
  );
  // Açılış için bir başlangıç activity entry'si oluştur
  for (const r of activeRetailers) {
    activity.push({
      at: lastRefresh.toISOString(),
      retailer: r.slug,
      retailerName: r.name,
      productsCount: PRODUCTS.filter((p) => p.retailer === r.slug).length,
      pricesChanged: 0,
      newProducts: 0,
    });
  }
}

export function getCacheStatus(): FeedStatus {
  init();
  const byRetailer: Record<string, number> = {};
  for (const p of PRODUCTS) {
    if (p.retailer) byRetailer[p.retailer] = (byRetailer[p.retailer] || 0) + 1;
  }

  const retailerStatuses: RetailerStatus[] = Object.values(RETAILERS).map(
    (r) => ({
      slug: r.slug,
      name: r.name,
      productCount: byRetailer[r.slug] || 0,
      active: (byRetailer[r.slug] || 0) > 0,
      lastSync: lastRefresh!.toISOString(),
    }),
  );

  const activeCount = retailerStatuses.filter((r) => r.active).length;

  return {
    lastRefresh: lastRefresh!.toISOString(),
    nextRefresh: new Date(
      lastRefresh!.getTime() + REFRESH_INTERVAL_MS,
    ).toISOString(),
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    totalProducts: PRODUCTS.length,
    totalRetailers: Object.keys(RETAILERS).length,
    activeRetailers: activeCount,
    retailers: retailerStatuses,
    recentActivity: [...activity].reverse().slice(0, 10),
  };
}

export function refresh(): FeedStatus {
  init();
  const now = new Date();
  const seed = String(now.getTime());

  const activeRetailers = Object.values(RETAILERS).filter((r) =>
    PRODUCTS.some((p) => p.retailer === r.slug),
  );

  for (const r of activeRetailers) {
    const productsCount = PRODUCTS.filter((p) => p.retailer === r.slug).length;
    activity.push({
      at: now.toISOString(),
      retailer: r.slug,
      retailerName: r.name,
      productsCount,
      pricesChanged: deterministicRandom(seed + r.slug, 8),
      newProducts: deterministicRandom(seed + "n" + r.slug, 3),
    });
  }

  lastRefresh = now;

  // Activity log'u 30'la sınırla
  if (activity.length > 30) {
    activity.splice(0, activity.length - 30);
  }

  return getCacheStatus();
}
