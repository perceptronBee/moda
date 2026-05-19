"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Photo = {
  src?: string;
  /** Internal — alt text + data attribute. Kullanıcıya badge olarak gösterilmez. */
  label?: string;
};

export function ProductGallery({
  photos,
  productId,
  productName,
  tone,
}: {
  photos: Photo[];
  productId: string;
  productName: string;
  tone?: string;
}) {
  const visible = photos.filter((p) => p.src);
  const count = Math.max(visible.length, 1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActiveIdx(idx);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (i: number) => {
    const clamped = Math.max(0, Math.min(visible.length - 1, i));
    setActiveIdx(clamped);
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  };

  const altOf = (p: Photo, i: number) =>
    `${productName} — görsel ${i + 1}${p.label ? ` (${p.label})` : ""}`;

  return (
    <>
      {/* ─── Mobile: kaydırmalı carousel ─── */}
      <div className="lg:hidden -mx-4 sm:-mx-6">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {visible.length === 0 ? (
            <div
              className="snap-center shrink-0 w-full relative"
              style={{ background: tone ?? "#e5e5e5", height: "min(60vh, 520px)" }}
            >
              <div className="absolute inset-0 flex items-center justify-center font-display text-[120px] text-white/15 pointer-events-none select-none">
                {productId}
              </div>
            </div>
          ) : (
            visible.map((p, i) => (
              <div
                key={i}
                className="snap-center shrink-0 w-full relative"
                style={{ background: tone ?? "#f5f5f5", height: "min(60vh, 520px)" }}
                data-photo-label={p.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={altOf(p, i)}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            ))
          )}
        </div>

        {visible.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3 px-4">
            {visible.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`${i + 1}. görsel`}
                className={`h-1 transition-all ${
                  activeIdx === i
                    ? "w-6 bg-[var(--color-fg)]"
                    : "w-3 bg-[var(--color-line-strong)]"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Desktop: thumbnail kolonu + büyük ana görsel ─── */}
      <div className="hidden lg:flex gap-4">
        {visible.length > 1 && (
          <div className="flex flex-col gap-2 w-20 shrink-0">
            {visible.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={`${i + 1}. görseli göster`}
                data-photo-label={p.label}
                className={`relative aspect-[3/4] overflow-hidden border-2 transition-all ${
                  activeIdx === i
                    ? "border-[var(--color-fg)]"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
                style={{ background: tone ?? "#f5f5f5" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div
          className="relative flex-1 aspect-[3/4] overflow-hidden group"
          style={{ background: tone ?? "#f5f5f5" }}
          data-photo-label={visible[activeIdx]?.label}
        >
          {visible[activeIdx]?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={visible[activeIdx].src}
              alt={altOf(visible[activeIdx], activeIdx)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-display text-[120px] text-white/15 pointer-events-none select-none">
              {productId}
            </div>
          )}

          {visible.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActiveIdx((i) => (i - 1 + visible.length) % visible.length)}
                aria-label="Önceki görsel"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              >
                <ChevronLeft size={18} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setActiveIdx((i) => (i + 1) % visible.length)}
                aria-label="Sonraki görsel"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              >
                <ChevronRight size={18} strokeWidth={2.25} />
              </button>

              <span className="absolute bottom-4 right-4 text-[11px] font-medium tracking-wide bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded-full">
                {activeIdx + 1} / {count}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
