"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw, Clock, Check, Activity } from "lucide-react";
import type { FeedStatus } from "@/lib/affiliate/feedCache";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "az önce";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} dakika önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function RefreshPanel({ initial }: { initial: FeedStatus }) {
  const [status, setStatus] = useState<FeedStatus>(initial);
  const [now, setNow] = useState(Date.now());
  const [pending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  // Her saniye tik — countdown için
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const nextRefreshMs = new Date(status.nextRefresh).getTime();
  const diffMs = nextRefreshMs - now;

  const doRefresh = () => {
    startTransition(async () => {
      const res = await fetch("/api/affiliate/v1/refresh", { method: "POST" });
      const data: FeedStatus = await res.json();
      setStatus(data);
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
    });
  };

  // Otomatik refresh — countdown 0'a vurunca
  useEffect(() => {
    if (diffMs <= 0 && !pending) {
      doRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffMs <= 0]);

  return (
    <section className="mb-12">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="meta mb-1 flex items-center gap-2">
            <Activity size={12} className="text-[var(--color-accent)]" />
            CANLI INGESTION
          </p>
          <h2 className="font-display text-2xl tracking-wide">Feed Durumu</h2>
        </div>
        <button
          type="button"
          onClick={doRefresh}
          disabled={pending}
          className="flex items-center gap-2 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-50 transition-colors px-5 py-2.5 text-sm font-medium tracking-wide"
        >
          {pending ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Yenileniyor…
            </>
          ) : justRefreshed ? (
            <>
              <Check size={14} />
              Yenilendi
            </>
          ) : (
            <>
              <RefreshCw size={14} />
              Şimdi Yenile
            </>
          )}
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--color-line)]">
        <div
          className="p-5"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          <p className="meta mb-2">SON GÜNCELLEME</p>
          <p className="font-display text-2xl tracking-wide">
            {timeAgo(status.lastRefresh)}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {new Date(status.lastRefresh).toLocaleString("tr-TR")}
          </p>
        </div>
        <div
          className="p-5"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          <p className="meta mb-2 flex items-center gap-2">
            <Clock size={11} />
            SONRAKİ YENİLEME
          </p>
          <p className="font-display text-2xl tracking-wide font-mono">
            {formatCountdown(diffMs)}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Her 30 dakikada bir otomatik
          </p>
        </div>
        <div
          className="p-5"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          <p className="meta mb-2">EŞLENMİŞ ÜRÜN</p>
          <p className="font-display text-2xl tracking-wide">
            {status.totalProducts.toLocaleString("tr-TR")}
          </p>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {status.activeRetailers} aktif mağaza
          </p>
        </div>
      </div>

      {/* Activity log */}
      {status.recentActivity.length > 0 && (
        <div className="mt-6">
          <p className="meta mb-3">SON AKTİVİTE</p>
          <div
            className="border border-[var(--color-line)] divide-y divide-[var(--color-line)]"
            style={{ backgroundColor: "var(--color-bg-elev)" }}
          >
            {status.recentActivity.slice(0, 6).map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2 h-2 shrink-0"
                    style={{
                      backgroundColor:
                        i === 0
                          ? "var(--color-accent)"
                          : "var(--color-muted)",
                    }}
                  />
                  <span className="font-medium truncate">{a.retailerName}</span>
                  <span className="text-[var(--color-muted)] text-xs">
                    {a.productsCount} ürün
                    {a.pricesChanged > 0 && (
                      <>
                        {" · "}
                        <span className="text-[var(--color-accent)]">
                          {a.pricesChanged} fiyat güncellendi
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-muted)] shrink-0 ml-3">
                  {timeAgo(a.at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
