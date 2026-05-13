"use client";

import { useEffect, useRef, useState } from "react";

type Photo = {
  src?: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const visible = photos.filter((p) => p.src);
  const count = Math.max(visible.length, 1);

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
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <>
      {/* Mobile: kaydırmalı carousel — sınırlı yükseklik */}
      <div className="lg:hidden -mx-4 sm:-mx-6">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {visible.length === 0 ? (
            <div
              className="snap-center shrink-0 w-full relative"
              style={{
                background: tone ?? "#e5e5e5",
                height: "min(48vh, 420px)",
              }}
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
                style={{
                  background: tone ?? "#f5f5f5",
                  height: "min(48vh, 420px)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={`${productName} — ${p.label ?? i + 1}`}
                  className="absolute inset-0 w-full h-full object-contain"
                />
                {p.label && (
                  <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider bg-white/90 px-2 py-1">
                    {p.label}
                  </span>
                )}
                <span className="absolute bottom-3 right-3 text-[11px] bg-black/60 text-white px-2 py-1">
                  {i + 1} / {count}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Dots indicator */}
        {visible.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3 px-4">
            {visible.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`${i + 1}. fotoğraf`}
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

      {/* Desktop: 2x grid + garment altta */}
      <div className="hidden lg:flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {visible.slice(0, 2).map((p, i) => (
            <div
              key={i}
              className="relative aspect-[3/4] overflow-hidden"
              style={{ background: tone ?? "#f5f5f5" }}
            >
              {p.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.src}
                  alt={`${productName} — ${p.label ?? i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center font-display text-[120px] text-white/15 pointer-events-none select-none">
                  {productId}
                </div>
              )}
              {p.label && (
                <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider bg-white px-2 py-1">
                  {p.label}
                </span>
              )}
            </div>
          ))}
        </div>
        {visible.length > 2 && (
          <div className="grid grid-cols-2 gap-3">
            {visible.slice(2).map((p, i) => (
              <div
                key={i}
                className="relative aspect-[3/4] overflow-hidden"
                style={{ background: "#f5f5f5" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={`${productName} — ${p.label ?? i + 3}`}
                  className="absolute inset-0 w-full h-full object-contain"
                />
                {p.label && (
                  <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider bg-white px-2 py-1">
                    {p.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
