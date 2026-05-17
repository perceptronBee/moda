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
  Shirt,
  Wand2,
  ShoppingBag,
} from "lucide-react";
import {
  fetchKombinSuggestions,
  type KombinSuggestion,
} from "@/lib/mockApi";

type Mode = "full" | "top" | "bottom" | "for-product";
type Stage =
  | "mode-select"
  | "upload"
  | "loading-suggestions"
  | "suggestions"
  | "loading-tryon"
  | "result";

type Props = {
  baseProductId?: string;
  baseProductName?: string;
  baseProductImage?: string;
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

const MODES: { id: Mode; label: string; desc: string; icon: typeof Sparkles }[] = [
  {
    id: "full",
    label: "Tam Kombin",
    desc: "Sıfırdan kafadan tırnağa AI önersin",
    icon: Wand2,
  },
  {
    id: "top",
    label: "Üst Giyim Öner",
    desc: "Pantolon/etek üzerine uygun üst",
    icon: Shirt,
  },
  {
    id: "bottom",
    label: "Alt Giyim Öner",
    desc: "Üst giyimine uygun pantolon/etek",
    icon: Shirt,
  },
  {
    id: "for-product",
    label: "Bu Ürüne Kombin",
    desc: "Seçtiğin ürüne tamamlayıcı parçalar",
    icon: ShoppingBag,
  },
];

export function KombinFlow({
  baseProductId,
  baseProductName,
  baseProductImage,
}: Props) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(
    baseProductId ? "for-product" : "full",
  );
  const [stage, setStage] = useState<Stage>(
    baseProductId ? "upload" : "mode-select",
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<KombinSuggestion[]>([]);
  const [chosen, setChosen] = useState<KombinSuggestion | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function validateFile(file: File): Promise<string | null> {
    if (file.size > MAX_FILE_BYTES) return "Dosya 10 MB'ı aşamaz";
    if (!ALLOWED_TYPES.has(file.type)) return "Sadece JPG/PNG/WEBP";
    if (!(await isRealImage(file))) return "Geçerli bir görsel değil";
    return null;
  }

  async function handlePhotoFile(file: File) {
    const err = await validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleReferenceFile(file: File) {
    const err = await validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setReferenceFile(file);
    const reader = new FileReader();
    reader.onload = () => setReferencePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  const onDrop = useCallback(
    (handler: (f: File) => void) => (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f) handler(f);
    },
    [],
  );

  async function startSuggestions() {
    if (!photo) return;
    setStage("loading-suggestions");
    setError(null);
    try {
      const data = await fetchKombinSuggestions({
        baseProductId: mode === "for-product" ? baseProductId : undefined,
        userPhotoDataUrl: photo,
        // İleride mockApi gerçek API'ye bağlanırken:
        // mode, referencePreview kullanılır
      });
      setSuggestions(data);
      setStage("suggestions");
    } catch {
      setError("Kombin önerisi alınamadı");
      setStage("upload");
    }
  }

  async function chooseOutfitAndTryOn(s: KombinSuggestion) {
    if (!photo || !photoFile) return;
    setChosen(s);
    setStage("loading-tryon");
    setError(null);

    // Önerilen ürünlerin foto'larını blob olarak topla
    const itemBlobs: Blob[] = [];
    for (const item of s.items.slice(0, 5)) {
      const imgUrl =
        item.photos?.front ?? item.photos?.garmentFront ?? null;
      if (!imgUrl) continue;
      try {
        const r = await fetch(imgUrl);
        if (r.ok) itemBlobs.push(await r.blob());
      } catch {
        /* atla */
      }
    }
    if (itemBlobs.length === 0) {
      setError("Önerilen ürünlerin fotoğrafı yüklenemedi");
      setStage("suggestions");
      return;
    }

    // FormData ile try-on endpoint
    const form = new FormData();
    form.append("base_image", photoFile);
    itemBlobs.forEach((b, i) => form.append(`item_${i + 1}`, b, `item_${i + 1}.jpg`));

    try {
      const res = await fetch("/api/ai/try-on", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.resultImage) {
        setError(data.error ?? "Try-on başarısız");
        setStage("suggestions");
        return;
      }
      setResultUrl(data.resultImage);
      setStage("result");
    } catch (e) {
      setError(`Try-on hatası: ${(e as Error).message}`);
      setStage("suggestions");
    }
  }

  function restart() {
    setStage(baseProductId ? "upload" : "mode-select");
    setPhoto(null);
    setPhotoFile(null);
    setReferenceFile(null);
    setReferencePreview(null);
    setSuggestions([]);
    setChosen(null);
    setResultUrl(null);
    setError(null);
  }

  const needsReference = mode === "top" || mode === "bottom";

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-6xl mx-auto w-full">
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
              Kombin Öner
            </h1>
            {baseProductName && (
              <p className="text-sm text-[var(--color-muted)] mt-2">
                Baz ürün:{" "}
                <span className="text-[var(--color-fg)]">{baseProductName}</span>
              </p>
            )}
          </div>
          <Stepper stage={stage} hasMode={!baseProductId} />
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

      {stage === "mode-select" && (
        <ModeSelectStage
          onSelect={(m) => {
            setMode(m);
            setStage("upload");
          }}
        />
      )}

      {stage === "upload" && (
        <UploadStage
          photo={photo}
          onFile={handlePhotoFile}
          onDrop={onDrop(handlePhotoFile)}
          onContinue={startSuggestions}
          needsReference={needsReference}
          referencePreview={referencePreview}
          onReferenceFile={handleReferenceFile}
          onReferenceDrop={onDrop(handleReferenceFile)}
          mode={mode}
          baseProductImage={baseProductImage}
        />
      )}

      {stage === "loading-suggestions" && (
        <LoadingStage label="Sana özel kombinler hazırlanıyor…" />
      )}

      {stage === "suggestions" && (
        <SuggestionsStage
          suggestions={suggestions}
          onChoose={chooseOutfitAndTryOn}
          onBack={() => setStage("upload")}
        />
      )}

      {stage === "loading-tryon" && (
        <LoadingStage label="Fotoğrafına giydiriliyor… (30-60 sn sürebilir)" />
      )}

      {stage === "result" && chosen && resultUrl && (
        <ResultStage
          outfit={chosen}
          resultUrl={resultUrl}
          onRestart={restart}
          onBack={() => setStage("suggestions")}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Stepper({ stage, hasMode }: { stage: Stage; hasMode: boolean }) {
  const steps = hasMode
    ? ["Mod", "Fotoğraf", "Kombin", "Sonuç"]
    : ["Fotoğraf", "Kombin", "Sonuç"];
  const offset = hasMode ? 1 : 0;
  const idx = (() => {
    if (stage === "mode-select") return 0;
    if (stage === "upload") return offset;
    if (stage === "loading-suggestions" || stage === "suggestions") return offset + 1;
    return offset + 2;
  })();

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
          {i < steps.length - 1 && (
            <span className="w-6 h-px bg-[var(--color-line)]" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ModeSelectStage({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div>
      <h2 className="font-display text-2xl tracking-wide mb-2">
        Ne yapmak istiyorsun?
      </h2>
      <p className="text-sm text-[var(--color-muted)] mb-6">
        Yapay zeka önerini buna göre özelleştirir.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODES.filter((m) => m.id !== "for-product").map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className="text-left p-5 border border-[var(--color-line)] hover:border-[var(--color-fg)] transition-all group"
              style={{ backgroundColor: "var(--color-bg-elev)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="w-10 h-10 flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
                >
                  <Icon size={18} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">{m.label}</p>
                  <p className="text-xs text-[var(--color-fg-soft)]">{m.desc}</p>
                </div>
                <ArrowRight
                  size={16}
                  className="text-[var(--color-muted)] group-hover:translate-x-1 transition-transform shrink-0"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function UploadStage({
  photo,
  onFile,
  onDrop,
  onContinue,
  needsReference,
  referencePreview,
  onReferenceFile,
  onReferenceDrop,
  mode,
  baseProductImage,
}: {
  photo: string | null;
  onFile: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onContinue: () => void;
  needsReference: boolean;
  referencePreview: string | null;
  onReferenceFile: (f: File) => void;
  onReferenceDrop: (e: React.DragEvent) => void;
  mode: Mode;
  baseProductImage?: string;
}) {
  const refLabel =
    mode === "top"
      ? "Üzerine üst öneririz"
      : mode === "bottom"
        ? "Üzerine alt öneririz"
        : "Referans";
  const refHint =
    mode === "top"
      ? "Pantolon, etek veya şort fotoğrafı"
      : mode === "bottom"
        ? "Tişört, gömlek veya kazak fotoğrafı"
        : "";

  const canContinue = photo && (!needsReference || referencePreview);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      {/* Sol: bilgi */}
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-2xl tracking-wide">
          Fotoğrafını Yükle
        </h2>
        <p className="text-sm text-[var(--color-fg-soft)] leading-relaxed">
          Önden çekilmiş net bir fotoğrafını yükle. Yapay zeka stiline uygun
          kombini üzerine giydirecek.
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

        {baseProductImage && (
          <div className="mt-3 p-3 border border-[var(--color-line)]">
            <p className="meta mb-2">SEÇİLEN BAZ ÜRÜN</p>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={baseProductImage}
                alt="baz ürün"
                className="w-16 h-20 object-cover"
              />
              <p className="text-xs text-[var(--color-fg-soft)]">
                Bu ürünle tamamlayıcı parçalar önerilecek.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sağ: dosya alanları */}
      <div className="flex flex-col gap-4">
        {/* Kullanıcı fotoğrafı */}
        <FileSlot
          label="SENİN FOTOĞRAFIN"
          preview={photo}
          onFile={onFile}
          onDrop={onDrop}
          aspect="aspect-[3/4]"
        />

        {/* Referans (sadece üst/alt mod) */}
        {needsReference && (
          <FileSlot
            label={refLabel.toUpperCase()}
            hint={refHint}
            preview={referencePreview}
            onFile={onReferenceFile}
            onDrop={onReferenceDrop}
            aspect="aspect-[3/4] max-h-[280px]"
          />
        )}

        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors py-4 text-sm font-medium tracking-wide flex items-center justify-center gap-2"
        >
          <Sparkles size={16} />
          KOMBİN ÖNERİSİ AL
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function FileSlot({
  label,
  hint,
  preview,
  onFile,
  onDrop,
  aspect,
}: {
  label: string;
  hint?: string;
  preview: string | null;
  onFile: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  aspect: string;
}) {
  return (
    <div>
      <p className="meta mb-2">{label}</p>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`block border-2 border-dashed border-[var(--color-line-strong)] hover:border-[var(--color-fg)] transition-colors ${aspect} relative cursor-pointer`}
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
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--color-muted)]">
            <Upload size={28} />
            <p className="text-sm">Fotoğraf seç veya sürükle</p>
            {hint && <p className="text-xs">{hint}</p>}
          </div>
        )}
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function LoadingStage({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
      <Loader2 className="animate-spin text-[var(--color-accent)]" size={42} />
      <p className="text-sm font-medium text-center px-6">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SuggestionsStage({
  suggestions,
  onChoose,
  onBack,
}: {
  suggestions: KombinSuggestion[];
  onChoose: (s: KombinSuggestion) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-wide">
            Sana Önerilen Kombinler
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Beğendiğin kombini seç, üzerine giydirelim (AI ile).
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Fotoğrafı Değiştir
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {suggestions.map((s) => {
          const total = s.items.reduce((acc, p) => acc + p.price, 0);
          return (
            <div
              key={s.id}
              className="border border-[var(--color-line)] p-5 flex flex-col gap-4"
              style={{ backgroundColor: "var(--color-bg-elev)" }}
            >
              <div>
                <h3 className="font-display text-xl tracking-wide">
                  {s.title}
                </h3>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  {s.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {s.items.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="aspect-square overflow-hidden relative"
                    style={{ background: p.tone ?? "#e5e5e5" }}
                  >
                    {p.photos?.front && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.photos.front}
                        alt={p.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>

              <ul className="flex flex-col gap-2 text-xs">
                {s.items.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between items-center pb-2 border-b border-[var(--color-line)] last:border-0"
                  >
                    <span className="truncate pr-2">{p.name}</span>
                    <span className="text-[var(--color-muted)] shrink-0">
                      {p.price.toLocaleString("tr-TR")} TL
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-[var(--color-muted)]">Toplam</span>
                <span className="font-semibold">
                  {total.toLocaleString("tr-TR")} TL
                </span>
              </div>

              <button
                onClick={() => onChoose(s)}
                className="bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors py-3 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Sparkles size={14} />
                ÜZERİME GİYDİR
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ResultStage({
  outfit,
  resultUrl,
  onRestart,
  onBack,
}: {
  outfit: KombinSuggestion;
  resultUrl: string;
  onRestart: () => void;
  onBack: () => void;
}) {
  const total = outfit.items.reduce((acc, p) => acc + p.price, 0);
  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="font-display text-2xl tracking-wide flex items-center gap-2">
            <Check size={20} className="text-[var(--color-accent)]" />
            İşte Senin Üzerinde
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Beğendiysen tüm parçaları sepete ekleyebilirsin.
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Diğer Kombinler
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
            <p className="meta mb-2">Seçilen Kombin</p>
            <h3 className="font-display text-2xl tracking-wide">
              {outfit.title}
            </h3>
            <p className="text-sm text-[var(--color-fg-soft)] mt-2">
              {outfit.description}
            </p>
          </div>

          <ul className="flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {outfit.items.map((p) => (
              <li
                key={p.id}
                className="flex justify-between items-center py-3 text-sm"
              >
                <span>{p.name}</span>
                <span className="text-[var(--color-fg-soft)]">
                  {p.price.toLocaleString("tr-TR")} TL
                </span>
              </li>
            ))}
            <li className="flex justify-between items-center py-3 font-semibold">
              <span>Toplam</span>
              <span>{total.toLocaleString("tr-TR")} TL</span>
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
