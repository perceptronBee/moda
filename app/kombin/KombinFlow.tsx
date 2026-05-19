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
  Plus,
  Search,
  Send,
  Image as ImageIcon,
  ShoppingBag,
  Heart,
  ExternalLink,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import type { PickableProduct } from "./page";

type Stage =
  | "upload"
  | "pick"
  | "suggest-categories" // suggest modunda: hangi kategorileri istediğini sor
  | "loading-suggest"    // AI öneriler üretiliyor
  | "suggest-pick"       // AI önerilerinden seç
  | "chat"               // mode=chat: serbest sohbet UI
  | "loading-tryon"
  | "result";

type Suggestion = {
  id: string;
  title: string;
  reasoning: string;
  items: PickableProduct[];
};

type Props = {
  groupedProducts: Record<string, PickableProduct[]>;
  categoryLabels: Record<string, string>;
  /** URL'den gelen başlangıç parçaları — suggest modda anchor olarak kullanılır */
  anchors?: PickableProduct[];
  /**
   * "pick"    : klasik akış — fotoğraf yükle → ürün seç → giydir.
   * "tryon"   : preselected ürünle + manuel ekstra seçim → giydir.
   * "suggest" : AI 3 kombin önersin → kullanıcı seçsin → giydir.
   * "chat"    : serbest sohbet AI stilisti, inline ürün kartları.
   */
  mode?: "pick" | "tryon" | "suggest" | "chat";
  /** Aktif cinsiyet filtresi — kategori bazında ürünler bu cinsiyete göre filtrelendi */
  gender?: "kadin" | "erkek" | "cocuk";
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
  anchors: initialAnchors = [],
  mode = "pick",
  gender = "kadin",
}: Props) {
  const _isSuggest = mode === "suggest";
  const _isChat = mode === "chat";
  const router = useRouter();

  // Anchor'lar client state — kullanıcı + ile yenisini ekler, × ile çıkarır
  const [anchors, setAnchors] = useState<PickableProduct[]>(initialAnchors);

  const preselectId = anchors[0]?.id;
  const preselectCategory = anchors[0]?.type;

  // URL'yi anchor değişimine göre senkronla (paylaşılabilirlik için)
  useEffect(() => {
    if (!_isSuggest) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "suggest");
    params.delete("baseProduct");
    if (anchors.length > 0) {
      params.set("baseProducts", anchors.map((a) => a.id).join(","));
    } else {
      params.delete("baseProducts");
    }
    window.history.replaceState(null, "", `/kombin?${params.toString()}`);
  }, [anchors, _isSuggest]);

  // chat mode: upload aşaması yok, direkt sohbet ekranı
  const [stage, setStage] = useState<Stage>(_isChat ? "chat" : "upload");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Anchor'lar başlangıçta seçili gelir (tryon/pick için)
  const [selected, setSelected] = useState<Map<string, PickableProduct>>(() => {
    const m = new Map<string, PickableProduct>();
    for (const a of initialAnchors) m.set(a.id, a);
    return m;
  });

  const [activeCategory, setActiveCategory] = useState<string>(
    preselectCategory ?? Object.keys(groupedProducts)[0] ?? "ust-giyim",
  );

  function addAnchor(p: PickableProduct) {
    setAnchors((prev) => {
      if (prev.find((a) => a.id === p.id)) return prev;
      // Aynı kategoriden 2. parça engelle
      if (prev.find((a) => a.type === p.type)) {
        setError(
          `${categoryLabels[p.type] ?? p.type} kategorisinden zaten bir başlangıç parçan var. Önce onu çıkar.`,
        );
        setTimeout(() => setError(null), 3500);
        return prev;
      }
      if (prev.length >= 5) return prev;
      return [...prev, p];
    });
  }
  function removeAnchor(id: string) {
    setAnchors((prev) => prev.filter((a) => a.id !== id));
  }

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

  // ─── AI suggestion fetch ───────────────────────────────────────────
  async function fetchSuggestions(categories: string[]) {
    if (categories.length === 0) {
      setError("En az bir kategori seç");
      return;
    }
    setStage("loading-suggest");
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseProductIds: anchors.map((a) => a.id),
          gender,
          categories,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI öneri alınamadı");
        setStage("upload");
        return;
      }
      const list: Suggestion[] = Array.isArray(data.suggestions)
        ? data.suggestions
        : [];
      if (list.length === 0) {
        setError("Bu seçimlere uygun kombin bulunamadı");
        setStage("upload");
        return;
      }
      setSuggestions(list);
      setStage("suggest-pick");
    } catch (e) {
      setError(`Öneri hatası: ${(e as Error).message}`);
      setStage("upload");
    }
  }

  function chooseSuggestion(s: Suggestion) {
    const m = new Map<string, PickableProduct>();
    for (const it of s.items) m.set(it.id, it);
    setSelected(m); // ResultStage'in görmesi için
    tryOn(s.items); // Race condition önlemek için direkt items ile çağır
  }

  // ─── Ürün seçimi ───────────────────────────────────────────────────
  function toggleProduct(p: PickableProduct) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) {
        next.delete(p.id);
      } else {
        // Aynı kategoriden (type) başka bir ürün varsa onu kaldır
        for (const [existingId, existingItem] of next.entries()) {
          if (existingItem.type === p.type) {
            next.delete(existingId);
          }
        }
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
  async function tryOn(itemsOverride?: PickableProduct[]) {
    const items = Array.isArray(itemsOverride)
      ? itemsOverride
      : Array.from(selected.values());
    if (!photoFile || items.length === 0) return;
    setStage("loading-tryon");
    setError(null);

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
      const res = await fetch("/api/ai/try-on", { method: "POST", body: form });

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
              {mode === "chat"
                ? "AI Stilist"
                : mode === "suggest"
                  ? "AI Kombin Önerisi"
                  : mode === "tryon"
                    ? "Üstümde Dene"
                    : "Parça Parça Giydirme"}
            </h1>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              {mode === "chat"
                ? "Ne tür bir kombin istediğini yaz, stiliste sor — sana özel ürünler önersin."
                : mode === "suggest"
                  ? preselectId
                    ? "Seçtiğin ürüne AI birkaç kombin önersin, beğendiğini giydirelim."
                    : "AI sana sıfırdan birkaç kombin önersin, beğendiğini giydirelim."
                  : mode === "tryon"
                    ? "Seçili ürünü ve istediğin ek parçaları üstüne giydirelim."
                    : "Kategorilerden dilediğin parçaları seç, AI üzerine giydirsin."}
            </p>
          </div>
          {mode !== "chat" && <Stepper stage={stage} mode={mode} />}
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
          onContinue={() => {
            if (_isSuggest) {
              setStage("suggest-categories");
            } else {
              setStage("pick");
            }
          }}
          ctaLabel={_isSuggest ? "DEVAM ET" : "PARÇA SEÇ"}
        />
      )}

      {stage === "suggest-categories" && (
        <SuggestCategoriesStage
          photo={photo!}
          categoryLabels={categoryLabels}
          availableCategories={Object.keys(groupedProducts)}
          groupedProducts={groupedProducts}
          anchors={anchors}
          gender={gender}
          onAddAnchor={addAnchor}
          onRemoveAnchor={removeAnchor}
          onBack={() => setStage("upload")}
          onSubmit={(cats) => fetchSuggestions(cats)}
        />
      )}

      {stage === "loading-suggest" && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
          <Loader2 className="animate-spin text-[var(--color-accent)]" size={42} />
          <p className="text-sm font-medium text-center">
            Yapay zeka sana uygun kombinleri hazırlıyor…
          </p>
        </div>
      )}

      {stage === "suggest-pick" && (
        <SuggestPickStage
          photo={photo!}
          suggestions={suggestions}
          onChoose={chooseSuggestion}
          onBack={() => setStage("suggest-categories")}
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
          onTryOn={() => tryOn()}
          onBack={() => setStage("upload")}
          onClearSelected={() => setSelected(new Map())}
          gender={gender}
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
          onBack={() => setStage(_isSuggest ? "suggest-pick" : "pick")}
        />
      )}

      {stage === "chat" && (
        <ChatStage
          gender={gender}
          initialAnchor={anchors[0]}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Stepper({
  stage,
  mode = "pick",
}: {
  stage: Stage;
  mode?: "pick" | "tryon" | "suggest";
}) {
  const steps =
    mode === "suggest"
      ? ["Fotoğraf", "AI Önerisi", "Sonuç"]
      : ["Fotoğraf", "Parça Seç", "Sonuç"];

  let idx = 0;
  if (mode === "suggest") {
    if (
      stage === "suggest-categories" ||
      stage === "loading-suggest" ||
      stage === "suggest-pick"
    )
      idx = 1;
    else if (stage === "loading-tryon" || stage === "result") idx = 2;
  } else {
    if (stage === "pick") idx = 1;
    else if (stage === "loading-tryon" || stage === "result") idx = 2;
  }

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
  ctaLabel = "PARÇA SEÇ",
}: {
  photo: string | null;
  onFile: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onContinue: () => void;
  ctaLabel?: string;
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
          className={`block border-2 border-dashed border-[var(--color-line-strong)] hover:border-[var(--color-fg)] transition-colors relative cursor-pointer ${
            photo ? "" : "aspect-[3/4] max-h-[480px]"
          }`}
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
            <img
              src={photo}
              alt="yüklenen"
              className="block w-full h-auto max-h-[600px] object-contain"
            />
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
          {ctaLabel}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SuggestCategoriesStage({
  photo,
  categoryLabels,
  availableCategories,
  groupedProducts,
  anchors,
  gender,
  onAddAnchor,
  onRemoveAnchor,
  onBack,
  onSubmit,
}: {
  photo: string;
  categoryLabels: Record<string, string>;
  availableCategories: string[];
  groupedProducts: Record<string, PickableProduct[]>;
  anchors: PickableProduct[];
  gender: "kadin" | "erkek" | "cocuk";
  onAddAnchor: (p: PickableProduct) => void;
  onRemoveAnchor: (id: string) => void;
  onBack: () => void;
  onSubmit: (categories: string[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorCategorySet = new Set<string>(anchors.map((a) => a.type));
  const selectable = availableCategories;

  // Default: anchor kategorileri hariç tümü seçili
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectable.filter((c) => !anchorCategorySet.has(c))),
  );

  function toggle(cat: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const allSelected = selected.size === selectable.length && selectable.length > 0;
  function toggleAll() {
    setSelected((prev) =>
      prev.size === selectable.length ? new Set() : new Set(selectable),
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
      {/* Sol: fotoğraf */}
      <div className="lg:w-80 shrink-0 flex flex-col gap-3">
        <button
          onClick={onBack}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2 self-start py-2"
        >
          <ArrowLeft size={14} /> Fotoğrafı Değiştir
        </button>
        <div
          className="relative w-full aspect-[3/4] max-h-[60vh] lg:max-h-none overflow-hidden"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt="sen"
            className="absolute inset-0 w-full h-full object-contain"
          />
          <span className="absolute top-3 left-3 bg-[var(--color-fg)] text-[var(--color-bg)] text-[10px] font-medium tracking-wider px-2 py-1">
            SENİN FOTOĞRAFIN
          </span>
        </div>
      </div>

      {/* Sağ: kategori seçimi */}
      <div className="flex-1 min-w-0 flex flex-col gap-5 lg:gap-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl sm:text-2xl tracking-wide leading-tight mb-2">
              Hangi parçalar için öneri istiyorsun?
            </h2>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
              Seçtiğin kategorilere göre AI sana 3 farklı kombin önerecek.
            </p>
          </div>
          {selectable.length > 1 && (
            <button
              onClick={toggleAll}
              className="text-xs text-[var(--color-fg-soft)] hover:text-[var(--color-fg)] underline decoration-[var(--color-line)] underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {allSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
            </button>
          )}
        </div>

        {/* Anchor (başlangıç parçaları) chips + ekleme butonu */}
        <div
          className="border-l-2 px-4 py-3 flex flex-col gap-3"
          style={{
            backgroundColor:
              anchors.length > 0
                ? "var(--color-accent-soft)"
                : "var(--color-bg-elev)",
            borderColor:
              anchors.length > 0
                ? "var(--color-accent)"
                : "var(--color-line-strong)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs sm:text-sm">
              <Sparkles
                size={14}
                className="inline mr-1.5 -mt-0.5 text-[var(--color-accent)]"
              />
              <span className="font-semibold">
                {anchors.length === 0
                  ? "Elinde bir parça var mı?"
                  : anchors.length === 1
                    ? "Başlangıç parçan"
                    : `${anchors.length} başlangıç parçan`}
              </span>
              <span className="text-[var(--color-fg-soft)] ml-1.5">
                {anchors.length === 0
                  ? "— eklersen AI kombini etrafında kurar"
                  : "— her kombinde yer alacak"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={anchors.length >= 5}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-fg)] hover:text-[var(--color-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <Plus size={14} strokeWidth={2.5} />
              Parça Ekle
            </button>
          </div>

          {anchors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {anchors.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-2 bg-white border border-[var(--color-line)] pl-1 pr-2 py-1 text-xs"
                >
                  {a.photo && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.photo}
                      alt=""
                      className="w-7 h-9 object-cover"
                    />
                  )}
                  <span className="font-medium max-w-[140px] truncate">
                    {a.name}
                  </span>
                  <span className="text-[var(--color-muted)] text-[10px] uppercase tracking-wider hidden sm:inline">
                    {categoryLabels[a.type] ?? a.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveAnchor(a.id)}
                    aria-label={`${a.name} parçasını çıkar`}
                    className="ml-1 text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {pickerOpen && (
          <AnchorPickerModal
            groupedProducts={groupedProducts}
            categoryLabels={categoryLabels}
            gender={gender}
            existingIds={new Set(anchors.map((a) => a.id))}
            usedCategories={new Set(anchors.map((a) => a.type))}
            onPick={(p) => {
              onAddAnchor(p);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {/* Kategori grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {selectable.map((cat) => {
            const isSelected = selected.has(cat);
            const hasAnchor = anchorCategorySet.has(cat);
            const Icon = CATEGORY_ICONS[cat] ?? Shirt;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggle(cat)}
                className={`relative flex flex-col items-start gap-3 p-3 sm:p-4 border text-left transition-all min-h-[100px] sm:min-h-[120px] ${
                  isSelected
                    ? "border-[var(--color-fg)] bg-[var(--color-bg-elev)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-fg-soft)] active:border-[var(--color-fg)]"
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span
                    className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                        : "bg-[var(--color-bg-soft)] text-[var(--color-fg-soft)]"
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <span
                    className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white"
                        : "border-[var(--color-line-strong)]"
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm sm:text-base font-medium leading-tight">
                    {categoryLabels[cat] ?? cat}
                  </span>
                  {hasAnchor && (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                      Elinde var · alternatif öner
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-2 lg:mt-4">
          <button
            onClick={() => onSubmit(Array.from(selected))}
            disabled={selected.size === 0}
            className="w-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-all py-4 text-sm font-medium tracking-wide flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            {selected.size > 0
              ? `${selected.size} KATEGORİ İÇİN KOMBİN ÖNER`
              : "EN AZ 1 KATEGORİ SEÇ"}
          </button>
          <p className="text-[11px] text-[var(--color-muted)] text-center mt-2">
            AI önerilerini 5-10 saniye içinde göreceksin
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SuggestPickStage({
  photo,
  suggestions,
  onChoose,
  onBack,
}: {
  photo: string;
  suggestions: Suggestion[];
  onChoose: (s: Suggestion) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex items-end justify-between mb-2 flex-wrap gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2 mb-4"
          >
            <ArrowLeft size={14} /> Geri Dön
          </button>
          <h2 className="font-display text-2xl tracking-wide flex items-center gap-2">
            <Sparkles size={20} className="text-[var(--color-accent)]" />
            AI Kombin Önerileri
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Beğendiğin kombini seç, üzerinde deneyelim.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="border border-[var(--color-line)] p-5 flex flex-col h-full hover:border-[var(--color-fg)] transition-colors"
            style={{ backgroundColor: "var(--color-bg-elev)" }}
          >
            <h3 className="font-display text-xl mb-2">{s.title}</h3>
            <p className="text-xs text-[var(--color-muted)] mb-6 min-h-[3rem]">
              {s.reasoning}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {s.items.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-[3/4] border border-[var(--color-line)] bg-[var(--color-bg)]"
                >
                  {item.photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.photo}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-line)] text-xs text-[var(--color-muted)]">
                      Foto Yok
                    </div>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] truncate px-1.5 py-1 text-center">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => onChoose(s)}
              className="mt-auto w-full bg-[var(--color-fg)] text-[var(--color-bg)] py-3.5 text-sm font-medium tracking-wide hover:bg-[var(--color-accent)] transition-colors"
            >
              BU KOMBİNİ GİYDİR
            </button>
          </div>
        ))}
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
  onClearSelected,
  gender,
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
  onClearSelected: () => void;
  gender: "kadin" | "erkek" | "cocuk";
}) {
  const categories = Object.keys(groupedProducts);
  const [activeGender, setActiveGender] = useState<"kadin" | "erkek">(
    gender === "erkek" ? "erkek" : "kadin",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const currentProducts = (groupedProducts[activeCategory] ?? [])
    .filter((p) => p.gender === activeGender)
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
          <img
            src={photo}
            alt="sen"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute top-2 left-2 bg-[var(--color-fg)] text-[var(--color-bg)] text-[10px] font-medium px-1.5 py-0.5">
            SENİN FOTOĞRAFIN
          </span>
        </div>

        {selectedItems.length > 0 && (
          <div
            className="border border-[var(--color-line)] p-3"
            style={{ backgroundColor: "var(--color-bg-elev)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="meta mb-0">SEÇİLENLER ({selectedItems.length}/5)</p>
              <button
                onClick={onClearSelected}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors underline decoration-[var(--color-line)] underline-offset-2"
              >
                Temizle
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {selectedItems.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  {p.photo && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.photo}
                      alt=""
                      className="w-8 h-10 object-cover shrink-0"
                    />
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

      {/* Sağ */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-2xl tracking-wide mb-1">2. Parça Seç</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Kategorilerden istediğin kıyafetleri seç, AI hepsini üzerine giydirecek.
            </p>
          </div>

          <div
            className="flex items-stretch border border-[var(--color-line)] shrink-0"
            role="group"
            aria-label="Cinsiyet filtresi"
          >
            {(["kadin", "erkek"] as const).map((g) => {
              const isActive = g === activeGender;
              return (
                <button
                  key={g}
                  onClick={() => setActiveGender(g)}
                  className={`px-4 py-2 text-sm font-medium tracking-wide transition-colors ${
                    isActive
                      ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                      : "text-[var(--color-fg-soft)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {g === "kadin" ? "Kadın" : "Erkek"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-5 border-b border-[var(--color-line)]">
          {categories.map((cat) => {
            const count = (groupedProducts[cat] ?? []).filter(
              (p) => p.gender === activeGender,
            ).length;
            const selectedInCat = (groupedProducts[cat] ?? []).filter((p) =>
              selected.has(p.id),
            ).length;

            const Icon = CATEGORY_ICONS[cat] ?? Shirt;
            const isActive = cat === activeCategory;

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
                  <Check
                    size={14}
                    style={{ color: isActive ? "var(--color-accent)" : "var(--color-fg)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mb-5 relative">
          <input
            type="text"
            placeholder={`${categoryLabels[activeCategory] ?? activeCategory} içinde ara...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--color-bg-elev)] border border-[var(--color-line)] text-sm px-4 py-3 outline-none focus:border-[var(--color-fg)] transition-colors placeholder:text-[var(--color-muted)]"
          />
        </div>

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
          className="relative w-full"
          style={{ backgroundColor: "var(--color-bg-elev)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="sonuç" className="block w-full h-auto" />
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

// ─────────────────────────────────────────────────────────────────────────────
function AnchorPickerModal({
  groupedProducts,
  categoryLabels,
  gender,
  existingIds,
  usedCategories,
  onPick,
  onClose,
}: {
  groupedProducts: Record<string, PickableProduct[]>;
  categoryLabels: Record<string, string>;
  gender: "kadin" | "erkek" | "cocuk";
  existingIds: Set<string>;
  usedCategories: Set<string>;
  onPick: (p: PickableProduct) => void;
  onClose: () => void;
}) {
  // Sadece anchor'ı olmayan kategorileri göster
  const categories = Object.keys(groupedProducts).filter(
    (c) => !usedCategories.has(c),
  );
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0] ?? "ust-giyim",
  );
  const [activeGender, setActiveGender] = useState<"kadin" | "erkek">(
    gender === "erkek" ? "erkek" : "kadin",
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const list = (groupedProducts[activeCategory] ?? [])
    .filter((p) => p.gender === activeGender)
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .filter((p) => !existingIds.has(p.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg)] w-full sm:max-w-3xl sm:max-h-[85vh] sm:m-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Başlangıç parçası seç"
      >
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-[var(--color-line)]">
          <div className="min-w-0">
            <h3 className="font-display text-xl tracking-wide truncate">
              Başlangıç Parçası Ekle
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Seçtiğin parça her AI önerisinde yer alacak
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-9 h-9 flex items-center justify-center hover:bg-[var(--color-bg-elev)] transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-3 border-b border-[var(--color-line)] flex flex-col sm:flex-row gap-3">
          <div
            className="flex items-stretch border border-[var(--color-line)] self-start"
            role="group"
          >
            {(["kadin", "erkek"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setActiveGender(g)}
                className={`px-4 py-2 text-xs font-medium tracking-wide transition-colors ${
                  g === activeGender
                    ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "text-[var(--color-fg-soft)] hover:text-[var(--color-fg)]"
                }`}
              >
                {g === "kadin" ? "Kadın" : "Erkek"}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${categoryLabels[activeCategory] ?? activeCategory} içinde ara…`}
              className="w-full bg-[var(--color-bg-elev)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none pl-9 pr-3 py-2 text-sm transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-5 sm:px-6 py-3 border-b border-[var(--color-line)] scrollbar-hidden">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] ?? Shirt;
            const isActive = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "border border-[var(--color-line)] hover:border-[var(--color-fg)] text-[var(--color-fg-soft)]"
                }`}
              >
                <Icon size={14} />
                {categoryLabels[cat] ?? cat}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
          {categories.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-muted)]">
              Tüm kategorilerden başlangıç parçası eklemişsin.
              <br />
              Yenisini eklemek için önce mevcutlardan birini çıkar.
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-muted)]">
              Eşleşen ürün bulunamadı
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {list.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p)}
                  className="group text-left transition-all hover:ring-1 hover:ring-[var(--color-fg)]"
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
                    <div className="absolute inset-0 bg-[var(--color-fg)]/0 group-hover:bg-[var(--color-fg)]/10 transition-colors flex items-end justify-center pb-3">
                      <span className="bg-[var(--color-fg)] text-[var(--color-bg)] text-[10px] font-medium tracking-wider px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        + EKLE
                      </span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs truncate">{p.name}</p>
                    <p className="text-xs font-semibold mt-0.5">
                      {p.price.toLocaleString("tr-TR")} TL
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT STAGE — serbest sohbet ile AI stilist
// ─────────────────────────────────────────────────────────────────────────────

type ChatItem = {
  id: string;
  name: string;
  price: number | null;
  type: string | null;
  gender: string | null;
  photo: string | null;
  deeplink: string | null;
  similarity_score?: number;
  colors?: Array<{ hex: string; percentage: number }>;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedItems?: ChatItem[];
  imagePreview?: string;
  timestamp: number;
};

const QUICK_PROMPTS = [
  { label: "Yağmurlu hava", prompt: "Yağmurlu bir gün için kombin öner" },
  { label: "Düğüne uygun", prompt: "Bir akşam düğününe gideceğim, şık bir kombin öner" },
  { label: "Ofis", prompt: "Ofiste giyebileceğim akıllı casual bir kombin" },
  { label: "Spor", prompt: "Spor yapmak için rahat bir kombin" },
  { label: "Kampüs", prompt: "Üniversiteye gideceğim, rahat ama şık bir kombin" },
  { label: "Hafta sonu", prompt: "Hafta sonu dışarısı için günlük bir kombin" },
];

function ChatStage({
  gender,
  initialAnchor,
}: {
  gender: "kadin" | "erkek" | "cocuk";
  initialAnchor?: PickableProduct;
}) {
  const router = useRouter();
  const { addItem } = useCart();

  const greetingId = useRef(`greet-${Date.now()}`).current;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: greetingId,
      role: "assistant",
      content: initialAnchor
        ? `Merhaba! "${initialAnchor.name}" ile uyumlu bir kombin için ne tür bir tarz istersin? Yağmurlu hava, ofis, düğün — ne aklında varsa söyle.`
        : "Merhaba! Sana özel bir kombin hazırlayayım. Nereye gidiyorsun, nasıl bir tarz istersin? Yazıp gönder, istersen bir kıyafet fotoğrafı da ekle.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  async function handleImageFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setChatError("Görsel 8 MB'ı aşamaz");
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setChatError("Sadece JPG/PNG/WEBP");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPendingImage({ file, preview: reader.result as string });
    reader.readAsDataURL(file);
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text && !pendingImage) return;
    if (sending) return;

    setChatError(null);
    setSending(true);

    const userMsg: ChatMessage = {
      id: `m-${Date.now()}-u`,
      role: "user",
      content: text || "(görsel ile sordu)",
      imagePreview: pendingImage?.preview,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const imageToSend = pendingImage?.file ?? null;
    setPendingImage(null);

    // İlk turdaysak cinsiyet ipucunu history'ye gizlice ekle (backend extraction yakalar)
    const historyForBackend = [
      ...(messages.length === 1
        ? [{ role: "user", content: `Ben ${gender === "erkek" ? "erkeğim" : "kadınım"}.` }]
        : []),
      ...messages
        .filter((m) => m.id !== greetingId)
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const form = new FormData();
      form.append("user_text", text || "Bu kıyafete uygun bir kombin önerir misin?");
      form.append("chat_history", JSON.stringify(historyForBackend));
      if (imageToSend) form.append("image", imageToSend, "user_image.jpg");

      const res = await fetch("/api/ai/styling-chat", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Hata ${res.status}`);
      }

      const aiMsg: ChatMessage = {
        id: `m-${Date.now()}-a`,
        role: "assistant",
        content: typeof data.ai_response === "string" ? data.ai_response : "",
        suggestedItems: Array.isArray(data.suggested_items) ? data.suggested_items : [],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      setChatError(`Stilist yanıt veremedi: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px] max-h-[800px]">
      {chatError && (
        <div
          className="mb-3 p-3 text-sm border-l-2"
          style={{
            borderColor: "var(--color-accent)",
            backgroundColor: "var(--color-accent-soft)",
            color: "var(--color-accent)",
          }}
        >
          {chatError}
        </div>
      )}

      {/* Quick prompts — sadece henüz mesaj atılmadıysa */}
      {messages.length === 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => send(q.prompt)}
              disabled={sending}
              className="text-xs px-3 py-2 border border-[var(--color-line)] hover:border-[var(--color-fg)] hover:bg-[var(--color-bg-elev)] transition-colors disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Chat scroll area */}
      <div
        className="flex-1 overflow-y-auto pr-1 sm:pr-2 -mr-1 sm:-mr-2"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="flex flex-col gap-4 pb-4">
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              message={m}
              onAddToCart={(item) => {
                if (item.price !== null) {
                  addItem(item.id);
                }
              }}
              onRouteToProduct={(id) => router.push(`/urun/${id}`)}
              onTryOn={(id) =>
                router.push(`/kombin?baseProduct=${id}&mode=tryon`)
              }
            />
          ))}
          {sending && <TypingBubble />}
          <div ref={scrollAnchorRef} />
        </div>
      </div>

      {/* Input alanı */}
      <div className="mt-3 border-t border-[var(--color-line)] pt-3">
        {pendingImage && (
          <div className="mb-2 inline-flex items-center gap-2 bg-[var(--color-bg-elev)] border border-[var(--color-line)] pl-1 pr-2 py-1 text-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.preview}
              alt=""
              className="w-8 h-10 object-cover"
            />
            <span>Görsel hazır</span>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              aria-label="Görseli kaldır"
              className="text-[var(--color-muted)] hover:text-[var(--color-accent)]"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 border border-[var(--color-line)] focus-within:border-[var(--color-fg)] transition-colors bg-[var(--color-bg)] p-1.5">
          <label
            className="shrink-0 w-9 h-9 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg)] cursor-pointer transition-colors"
            title="Görsel ekle"
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageFile(f);
              }}
            />
            <ImageIcon size={18} />
          </label>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
            rows={1}
            placeholder="Bir mesaj yaz… örn. 'yağmurlu hava için kombin öner'"
            className="flex-1 bg-transparent outline-none text-sm py-2 resize-none leading-relaxed disabled:opacity-50 placeholder:text-[var(--color-muted)]"
            style={{ maxHeight: 140 }}
          />

          <button
            type="button"
            onClick={() => send()}
            disabled={sending || (!input.trim() && !pendingImage)}
            aria-label="Gönder"
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-muted)] mt-1.5 px-1">
          Shift+Enter ile satır atla · Enter ile gönder · Foto eklersen üzerindeki kıyafetleri analiz eder
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ChatBubble({
  message,
  onAddToCart,
  onRouteToProduct,
  onTryOn,
}: {
  message: ChatMessage;
  onAddToCart: (item: ChatItem) => void;
  onRouteToProduct: (id: string) => void;
  onTryOn: (id: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2`}>
      {!isUser && (
        <div
          className="w-8 h-8 shrink-0 flex items-center justify-center text-white"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          <Sparkles size={14} />
        </div>
      )}

      <div className="flex flex-col gap-2 max-w-[88%] sm:max-w-[80%]">
        <div
          className={`px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
              : "bg-[var(--color-bg-elev)] border border-[var(--color-line)] text-[var(--color-fg)]"
          }`}
        >
          {message.imagePreview && isUser && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={message.imagePreview}
              alt="yüklenen"
              className="block max-w-[200px] mb-2 border border-white/20"
            />
          )}
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {!isUser && message.suggestedItems && message.suggestedItems.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="meta flex items-center gap-1.5 text-[var(--color-muted)]">
              <Sparkles size={11} className="text-[var(--color-accent)]" />
              ÖNERILEN PARÇALAR
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {message.suggestedItems.slice(0, 6).map((item) => (
                <ProductRecommendCard
                  key={item.id}
                  item={item}
                  onAddToCart={() => onAddToCart(item)}
                  onView={() => onRouteToProduct(item.id)}
                  onTryOn={() => onTryOn(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ProductRecommendCard({
  item,
  onAddToCart,
  onView,
  onTryOn,
}: {
  item: ChatItem;
  onAddToCart: () => void;
  onView: () => void;
  onTryOn: () => void;
}) {
  const [added, setAdded] = useState(false);

  return (
    <div
      className="group flex gap-3 border border-[var(--color-line)] hover:border-[var(--color-fg)] transition-colors p-2"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <button
        type="button"
        onClick={onView}
        aria-label={item.name}
        className="relative w-16 h-20 shrink-0 overflow-hidden bg-[var(--color-bg-elev)]"
      >
        {item.photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.photo}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--color-muted)]">
            Foto yok
          </div>
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onView}
          className="text-xs font-medium leading-tight line-clamp-2 text-left hover:underline"
        >
          {item.name}
        </button>
        <div className="flex items-center gap-2">
          {item.price !== null && (
            <span className="text-xs font-semibold">
              {item.price.toLocaleString("tr-TR")} TL
            </span>
          )}
          {item.similarity_score !== undefined && (
            <span className="text-[10px] text-[var(--color-muted)]">
              {Math.round(item.similarity_score * 100)}% uyum
            </span>
          )}
        </div>

        {item.colors && item.colors.length > 0 && (
          <div className="flex items-center gap-1">
            {item.colors.slice(0, 3).map((c, i) => (
              <span
                key={i}
                className="w-3 h-3 border border-[var(--color-line)]"
                style={{ backgroundColor: c.hex }}
                title={`${c.hex} ${Math.round(c.percentage)}%`}
              />
            ))}
          </div>
        )}

        <div className="flex gap-1.5 mt-auto">
          <button
            type="button"
            onClick={() => {
              onAddToCart();
              setAdded(true);
              setTimeout(() => setAdded(false), 1500);
            }}
            disabled={item.price === null}
            className={`flex-1 text-[11px] font-medium px-2 py-1.5 transition-colors flex items-center justify-center gap-1 ${
              added
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)]"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {added ? (
              <>
                <Check size={11} /> Eklendi
              </>
            ) : (
              <>
                <ShoppingBag size={11} /> Sepete
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onTryOn}
            title="Üstümde dene"
            className="text-[11px] font-medium px-2 py-1.5 border border-[var(--color-line-strong)] hover:border-[var(--color-fg)] transition-colors flex items-center justify-center"
          >
            <Sparkles size={11} className="text-[var(--color-accent)]" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <div className="flex justify-start gap-2">
      <div
        className="w-8 h-8 shrink-0 flex items-center justify-center text-white"
        style={{ backgroundColor: "var(--color-accent)" }}
      >
        <Sparkles size={14} />
      </div>
      <div className="bg-[var(--color-bg-elev)] border border-[var(--color-line)] px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[var(--color-fg-soft)] rounded-full animate-pulse" />
          <span className="w-1.5 h-1.5 bg-[var(--color-fg-soft)] rounded-full animate-pulse [animation-delay:200ms]" />
          <span className="w-1.5 h-1.5 bg-[var(--color-fg-soft)] rounded-full animate-pulse [animation-delay:400ms]" />
        </div>
      </div>
    </div>
  );
}
