"use client";

import { CATEGORIES, type ProductCategory } from "@/lib/products";

type Props = {
  active: ProductCategory | "tumu";
  onChange: (slug: ProductCategory | "tumu") => void;
};

export function CategorySidebar({ active, onChange }: Props) {
  return (
    <aside className="hidden lg:flex relative w-56 shrink-0 border-r border-[var(--color-line)] py-10">
      {/* Vertical accent */}
      <div className="absolute left-0 top-10 bottom-10 flex items-start pl-3">
        <span className="v-text meta text-[var(--color-accent)]/35">MODA · AW 26 · COLLECTION</span>
      </div>

      <div className="flex flex-col pl-12 pr-6 w-full">
        <p className="meta mb-8">KATEGORİLER</p>

        <ul className="flex flex-col gap-1">
          {CATEGORIES.map((c) => {
            const isActive = active === c.slug;
            return (
              <li key={c.slug} className="relative">
                {isActive && (
                  <span className="absolute inset-y-0 -left-12 w-px bg-[var(--color-accent)]" />
                )}
                <button
                  onClick={() => onChange(c.slug)}
                  className={`group relative text-left text-xs tracking-[0.3em] transition-all w-full py-2.5 ${
                    isActive
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-fg)]/45 hover:text-[var(--color-fg)]"
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute inset-0 -z-10"
                      style={{
                        background:
                          "radial-gradient(ellipse 80% 100% at 0% 50%, rgba(201,168,124,0.10) 0%, transparent 60%)",
                      }}
                    />
                  )}
                  <span className="relative">{c.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-16 pt-8 border-t border-[var(--color-line)]">
          <p className="meta mb-3 text-white/40">SEZON</p>
          <p className="font-display text-3xl leading-none">AW · 26</p>
          <p className="text-white/30 text-[10px] tracking-[0.3em] mt-3">
            EKİM — ŞUBAT
          </p>
        </div>
      </div>
    </aside>
  );
}
