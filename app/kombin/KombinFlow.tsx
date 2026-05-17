"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  Sparkles,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCw,
  X,
  Shirt,
  Footprints,
} from "lucide-react";
import type { PickableProduct } from "./page";

type Stage = "upload" | "pick" | "loading-tryon" | "result";

type Props = {
  groupedProducts: Record<string, PickableProduct[]>;
  categoryLabels: Record<string, string>;
  preselectId?: string;
  preselectCategory?: string;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function isRealImage(file: File): Promise<boolean> {
  const blob = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(blob);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return true;
  return false;
}

const CATEGORY_ICONS: Record<string, typeof Shirt> = {
  "ust-giyim": Shirt,
  "alt-giyim": Shirt,
  "dis-giyim": Shirt,
  ayakkabi: Footprints,
  aksesuar: Sparkles,
};

export function KombinFlow({
  groupedProducts,
  categoryLabels,
  preselectId,
  preselectCategory,
}: Props) {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("upload");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // preselectId varsa, o ürün başlangıçta seçili gelir
  const [selected, setSelected] = useState<Map<string, PickableProduct>>(() => {
    if (!preselectId) return new Map();
    const m = new Map<string, PickableProduct>();
    for (const list of Object.values(groupedProducts)) {
      const found = list.find((p) => p.id === preselectId);
      if (found) {
        m.set(found.id, found);
        break;
      }
    }
    return m;
  });

  const [activeCategory, setActiveCategory] = useState<string>(
    preselectCategory ?? Object.keys(groupedProducts)[0] ?? "ust-giyim",
  );
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // ─── Dosya işleme ──────────────────────────────────────────────────
  async function handlePhotoFile(file: File) {
    if (file.size > MAX_FILE_BYTES) { setError("Dosya 10 MB'ı aşamaz"); return; }
    if (!ALLOWED_TYPES.has(file.type)) { setError("Sadece JPG/PNG/WEBP"); return; }
    if (!(await isRealImage(file))) { setError("Geçerli bir görsel değil"); return; }
    setError(null);
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handlePhotoFile(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Ürün seçimi ───────────────────────────────────────────────────
  function toggleProduct(p: PickableProduct) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) {
        next.delete(p.id);
      } else {
        if (next.size >= 5) {
          setError("En fazla 5 parça seçebilirsin");
          return prev;
        }
        next.set(p.id, p);
      }
      setError(null);
      return next;
    });
  }

  // ─── Try-on ────────────────────────────────────────────────────────
  async function tryOn() {
    if (!photoFile || selected.size === 0) return;
    setStage("loading-tryon");
    setError(null);

    // Seçilen ürünlerin fotolarını blob olarak indir
    const items = Array.from(selected.values());
    const itemBlobs: Blob[] = [];
    for (const item of items) {
      if (!item.photo) continue;
      try {
        const r = await fetch(item.photo);
        if (r.ok) itemBlobs.push(await r.blob());
      } catch { /* atla */ }
    }
    if (itemBlobs.length === 0) {
      setError("Seçilen ürünlerin fotoğrafları yüklenemedi");
      setStage("pick");
      return;
    }

    const form = new FormData();
    form.append("base_image", photoFile);
    itemBlobs.forEach((b, i) =>
      form.append(`item_${i + 1}`, b, `item_${i + 1}.jpg`),
    );

    try {
      // 1. Vercel timeout'u baypas etmek için Python sunucu URL'ini al
      const urlRes = await fetch("/api/ai/vton-url").catch(() => null);
      const urlConfig = urlRes ? await urlRes.json().catch(() => ({})) : {};
      const directEndpoint = urlConfig.url 
        ? `${urlConfig.url.replace(/\/$/, "")}/api/try-on` 
        : "/api/ai/try-on";

      // 2. Direkt Python backend'ine at
      const res = await fetch(directEndpoint, { method: "POST", body: form });
      
      let data;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned ${res.status}: ${text.slice(0, 100)}...`);
      }

      const resultImage = data.resultImage || data.result_image;
      if (!res.ok || !resultImage) {
        setError(data.error ?? data.detail ?? "Try-on başarısız.");
        setStage("pick");
        return;
      }
      setResultUrl(resultImage);
      setStage("result");
    } catch (e) {
      setError(`Try-on hatası: ${(e as Error).message}`);
      setStage("pick");
    }
  }

  function restart() {
    setStage("upload");
    setPhoto(null);
    setPhotoFile(null);
    setSelected(new Map());
    setResultUrl(null);
    setError(null);
  }

  // ─── Seçili ürünlerin toplamı ──────────────────────────────────────
  const selectedItems = Array.from(selected.values());
  const totalPrice = selectedItems.reduce((acc, p) => acc + p.price, 0);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-7xl mx-auto w-full">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] mb-6"
      >
        <ArrowLeft size={14} /> Geri
      </button>

      <header className="mb-8 pb-6 border-b border-[var(--color-line)]">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="meta mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-[var(--color-accent)]" />
              YAPAY ZEKA ASİSTAN
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-wide">
              Parça Parça Giydirme
            </h1>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              Kategorilerden dilediğin parçaları seç, AI üzerine giydirsin.
            </p>
          </div>
          <Stepper stage={stage} />
        </div>
      </header>

      {error && (
        <div
          className="mb-6 p-3 text-sm border-l-2"
          style={{
            borderColor: "var(--color-accent)",
            backgroundColor: "var(--color-accent-soft)",
            color: "var(--color-accent)",
          }}
        >
          {error}
        </div>
      )}

      {stage === "upload" && (
        <UploadStage
          photo={photo}
          onFile={handlePhotoFile}
          onDrop={onDrop}
          onContinue={() => setStage("pick")}
        />
      )}

      {stage === "pick" && (
        <PickStage
          photo={photo!}
          groupedProducts={groupedProducts}
          categoryLabels={categoryLabels}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          selected={selected}
          toggleProduct={toggleProduct}
          selectedItems={selectedItems}
          totalPrice={totalPrice}
          onTryOn={tryOn}
          onBack={() => setStage("upload")}
        />
      )}

      {stage === "loading-tryon" && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
          <Loader2 className="animate-spin text-[var(--color-accent)]" size={42} />
          <p className="text-sm font-medium text-center">
            {selectedItems.length} parça üzerine giydiriliyor…
          </p>
          <p className="text-xs text-[var(--color-muted)]">30-60 saniye sürebilir</p>
        </div>
      )}

      {stage === "result" && resultUrl && (
        <ResultStage
          selectedItems={selectedItems}
          totalPrice={totalPrice}
          resultUrl={resultUrl}
          onRestart={restart}
          onBack={() => setStage("pick")}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Stepper({ stage }: { stage: Stage }) {
  const steps = ["Fotoğraf", "Parça Seç", "Sonuç"];
  const idx = stage === "upload" ? 0 : stage === "pick" ? 1 : 2;

  return (
    <div className="hidden md:flex items-center gap-3">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 flex items-center justify-center text-xs font-medium ${
                i < idx
                  ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                  : i === idx
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-line)] text-[var(--color-muted)]"
              }`}
            >
              {i < idx ? <Check size={12} /> : i + 1}
            </span>
            <span
              className={`text-sm ${i === idx ? "text-[var(--color-fg)] font-medium" : "text-[var(--color-muted)]"}`}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && <span className="w-6 h-px bg-[var(--color-line)]" />}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function UploadStage({
  photo,
  onFile,
  onDrop,
  onContinue,
}: {
  photo: string | null;
  onFile: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onContinue: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-2xl tracking-wide">
          1. Fotoğrafını Yükle
        </h2>
        <p className="text-sm text-[var(--color-fg-soft)] leading-relaxed">
          Önden çekilmiş net bir fotoğrafını yükle. Sonraki adımda istediğin
          kıyafetleri tek tek seçeceksin.
        </p>
        <ul className="flex flex-col gap-2 text-sm text-[var(--color-fg-soft)]">
          <li className="flex gap-2">
            <Check size={16} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            Tek kişilik, önden çekilmiş
          </li>
          <li className="flex gap-2">
            <Check size={16} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            Net, sade arka plan
          </li>
          <li className="flex gap-2">
            <Check size={16} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            JPG/PNG/WEBP · Max 10MB
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="block border-2 border-dashed border-[var(--color-line-strong)] hover:border-[var(--color-fg)] transition-colors aspect-[3/4] max-h-[480px] relative cursor-pointer"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo} alt="yüklenen" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--color-muted)]">
              <Upload size={32} />
              <p className="text-sm">Fotoğraf seç veya sürükle</p>
              <p className="text-xs">JPG, PNG · Max 10MB</p>
            </div>
          )}
        </label>

        <button
          onClick={onContinue}
          disabled={!photo}
          className="w-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors py-4 text-sm font-medium tracking-wide flex items-center justify-center gap-2"
        >
          PARÇA SEÇ
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function PickStage({
  photo,
  groupedProducts,
  categoryLabels,
  activeCategory,
  setActiveCategory,
  selected,
  toggleProduct,
  selectedItems,
  totalPrice,
  onTryOn,
  onBack,
}: {
  photo: string;
  groupedProducts: Record<string, PickableProduct[]>;
  categoryLabels: Record<string, string>;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  selected: Map<string, PickableProduct>;
  toggleProduct: (p: PickableProduct) => void;
  selectedItems: PickableProduct[];
  totalPrice: number;
  onTryOn: () => void;
  onBack: () => void;
}) {
  const categories = Object.keys(groupedProducts);
  const currentProducts = groupedProducts[activeCategory] ?? [];

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Sol: fotoğraf + seçilenler */}
      <div className="lg:w-72 shrink-0 flex flex-col gap-4">
        <button
          onClick={onBack}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2 self-start"
        >
          <ArrowLeft size={14} /> Fotoğrafı Değiştir
        </button>

        <div
          className="relative aspect-[3/4] max-h-[320px]"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="sen" className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute top-2 left-2 bg-[var(--color-fg)] text-[var(--color-bg)] text-[10px] font-medium px-1.5 py-0.5">
            SENİN FOTOĞRAFIN
          </span>
        </div>

        {/* Seçilen parçalar listesi */}
        {selectedItems.length > 0 && (
          <div
            className="border border-[var(--color-line)] p-3"
            style={{ backgroundColor: "var(--color-bg-elev)" }}
          >
            <p className="meta mb-2">SEÇİLEN PARÇALAR ({selectedItems.length}/5)</p>
            <ul className="flex flex-col gap-2">
              {selectedItems.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  {p.photo && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.photo} alt="" className="w-8 h-10 object-cover shrink-0" />
                  )}
                  <span className="flex-1 truncate">{p.name}</span>
                  <button
                    onClick={() => toggleProduct(p)}
                    className="text-[var(--color-muted)] hover:text-[var(--color-accent)] shrink-0"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-[var(--color-line)] text-sm font-semibold">
              <span>Toplam</span>
              <span>{totalPrice.toLocaleString("tr-TR")} TL</span>
            </div>
          </div>
        )}

        {/* GİYDİR butonu */}
        <button
          onClick={onTryOn}
          disabled={selectedItems.length === 0}
          className="w-full bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all py-4 text-sm font-medium tracking-wide flex items-center justify-center gap-2"
        >
          <Sparkles size={16} />
          {selectedItems.length > 0
            ? `${selectedItems.length} PARÇAYI GİYDİR`
            : "PARÇA SEÇ"}
        </button>
      </div>

      {/* Sağ: kategori tab + ürün grid */}
      <div className="flex-1 min-w-0">
        <h2 className="font-display text-2xl tracking-wide mb-1">
          2. Parça Seç
        </h2>
        <p className="text-sm text-[var(--color-muted)] mb-5">
          Kategorilerden istediğin kıyafetleri seç, AI hepsini üzerine giydirecek.
        </p>

        {/* Kategori tabları */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-5 border-b border-[var(--color-line)]">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] ?? Shirt;
            const isActive = cat === activeCategory;
            const count = groupedProducts[cat]?.length ?? 0;
            const selectedInCat = (groupedProducts[cat] ?? []).filter((p) =>
              selected.has(p.id),
            ).length;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "border border-[var(--color-line)] hover:border-[var(--color-fg)] text-[var(--color-fg-soft)]"
                }`}
              >
                <Icon size={16} />
                {categoryLabels[cat] ?? cat}
                <span className="text-xs opacity-60">({count})</span>
                {selectedInCat > 0 && (
                  <span
                    className="w-5 h-5 text-[10px] font-bold flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isActive ? "var(--color-accent)" : "var(--color-fg)",
                      color: "var(--color-bg)",
                    }}
                  >
                    {selectedInCat}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Ürün grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {currentProducts.map((p) => {
            const isSelected = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProduct(p)}
                className={`relative text-left transition-all group ${
                  isSelected
                    ? "ring-2 ring-[var(--color-accent)] ring-offset-1"
                    : "hover:ring-1 hover:ring-[var(--color-fg)]"
                }`}
                style={{ backgroundColor: "var(--color-bg-elev)" }}
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  {p.photo && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.photo}
                      alt={p.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--color-accent)] text-white flex items-center justify-center">
                      <Check size={14} />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs truncate">{p.name}</p>
                  <p className="text-xs font-semibold mt-0.5">
                    {p.price.toLocaleString("tr-TR")} TL
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ResultStage({
  selectedItems,
  totalPrice,
  resultUrl,
  onRestart,
  onBack,
}: {
  selectedItems: PickableProduct[];
  totalPrice: number;
  resultUrl: string;
  onRestart: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-wide flex items-center gap-2">
            <Check size={20} className="text-[var(--color-accent)]" />
            İşte Senin Üzerinde
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Beğendiysen parçaları sepete ekleyebilirsin.
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Parçaları Değiştir
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div
          className="relative aspect-[3/4]"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl}
            alt="sonuç"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute top-3 left-3 bg-[var(--color-fg)] text-[var(--color-bg)] text-xs font-medium px-2 py-1">
            AI Try-On
          </span>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="meta mb-2">SEÇTİĞİN PARÇALAR</p>
            <h3 className="font-display text-2xl tracking-wide">
              {selectedItems.length} Parça Kombin
            </h3>
          </div>

          <ul className="flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {selectedItems.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                {p.photo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.photo} alt="" className="w-10 h-13 object-cover shrink-0" />
                )}
                <span className="flex-1 text-sm truncate">{p.name}</span>
                <span className="text-sm text-[var(--color-fg-soft)] shrink-0">
                  {p.price.toLocaleString("tr-TR")} TL
                </span>
              </li>
            ))}
            <li className="flex justify-between items-center py-3 font-semibold">
              <span>Toplam</span>
              <span>{totalPrice.toLocaleString("tr-TR")} TL</span>
            </li>
          </ul>

          <button className="bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors py-4 text-sm font-medium tracking-wide">
            TÜMÜNÜ SEPETE EKLE
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onRestart}
              className="border border-[var(--color-line)] hover:border-[var(--color-fg)] py-3 text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RotateCw size={14} /> Yeniden Dene
            </button>
            <Link
              href="/"
              className="border border-[var(--color-line)] hover:border-[var(--color-fg)] py-3 text-sm transition-colors text-center"
            >
              Alışverişe Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
