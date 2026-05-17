"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  Sparkles,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCw,
} from "lucide-react";
import {
  fetchKombinSuggestions,
  generateTryOnImage,
  type KombinSuggestion,
} from "@/lib/mockApi";
import { getProductById, type Product } from "@/lib/products";

type Stage =
  | "upload"
  | "loading-suggestions"
  | "suggestions"
  | "loading-tryon"
  | "result";

function KombinFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baseProductId = searchParams.get("baseProduct") ?? undefined;
  const baseProduct: Product | undefined = baseProductId
    ? getProductById(baseProductId)
    : undefined;

  const [stage, setStage] = useState<Stage>("upload");
  const [photo, setPhoto] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<KombinSuggestion[]>([]);
  const [chosen, setChosen] = useState<KombinSuggestion | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  // Magic byte sniff — content-type'a güvenmek yerine ilk byte'lara bak
  async function isRealImage(file: File): Promise<boolean> {
    const blob = await file.slice(0, 12).arrayBuffer();
    const b = new Uint8Array(blob);
    // JPEG: FF D8 FF
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
      return true;
    // WebP: RIFF....WEBP
    if (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    )
      return true;
    return false;
  }

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      alert("Dosya 10 MB'ı aşamaz");
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      alert("Sadece JPG, PNG veya WebP yükleyebilirsin");
      return;
    }
    if (!(await isRealImage(file))) {
      alert("Geçerli bir görsel dosyası değil");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.onerror = () => alert("Görsel okunamadı");
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSuggestions = async () => {
    if (!photo) return;
    setStage("loading-suggestions");
    const data = await fetchKombinSuggestions({
      baseProductId,
      userPhotoDataUrl: photo,
    });
    setSuggestions(data);
    setStage("suggestions");
  };

  const chooseOutfit = async (s: KombinSuggestion) => {
    if (!photo) return;
    setChosen(s);
    setStage("loading-tryon");
    const { resultUrl } = await generateTryOnImage({
      userPhotoDataUrl: photo,
      outfitId: s.id,
    });
    setResultUrl(resultUrl);
    setStage("result");
  };

  const restart = () => {
    setStage("upload");
    setPhoto(null);
    setSuggestions([]);
    setChosen(null);
    setResultUrl(null);
  };

  return (
    <div className="px-6 lg:px-10 py-8 max-w-6xl mx-auto w-full">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] mb-6"
      >
        <ArrowLeft size={14} /> Geri
      </button>

      <header className="mb-10 pb-6 border-b border-[var(--color-line)]">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="meta mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-[var(--color-accent)]" />
              YAPAY ZEKA ASİSTAN
            </p>
            <h1 className="font-display text-4xl lg:text-5xl tracking-wide">
              Kombin Öner
            </h1>
            {baseProduct && (
              <p className="text-sm text-[var(--color-muted)] mt-3">
                Baz ürün:{" "}
                <span className="text-[var(--color-fg)]">{baseProduct.name}</span>
              </p>
            )}
          </div>
          <Stepper stage={stage} />
        </div>
      </header>

      {stage === "upload" && (
        <UploadStage
          photo={photo}
          onFile={handleFile}
          onDrop={onDrop}
          onContinue={startSuggestions}
        />
      )}
      {stage === "loading-suggestions" && (
        <LoadingStage label="Sana özel kombinler hazırlanıyor…" />
      )}
      {stage === "suggestions" && (
        <SuggestionsStage
          suggestions={suggestions}
          onChoose={chooseOutfit}
          onBack={() => setStage("upload")}
        />
      )}
      {stage === "loading-tryon" && (
        <LoadingStage label="Fotoğrafına giydiriliyor…" />
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

function Stepper({ stage }: { stage: Stage }) {
  const steps = ["Fotoğraf", "Kombin", "Sonuç"];
  const idx =
    stage.startsWith("upload") || stage === "loading-suggestions"
      ? 0
      : stage === "suggestions" || stage === "loading-tryon"
        ? 1
        : 2;

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
            <span className="w-8 h-px bg-[var(--color-line)]" />
          )}
        </div>
      ))}
    </div>
  );
}

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-2xl tracking-wide">
          1. Fotoğrafını Yükle
        </h2>
        <p className="text-sm text-[var(--color-fg-soft)] leading-relaxed">
          Net, tam veya yarım boy bir fotoğrafını yükle. Yapay zeka senin
          tarzına göre 3 farklı kombin önerecek.
        </p>
        <ul className="flex flex-col gap-2 text-sm text-[var(--color-fg-soft)]">
          <li className="flex gap-2">
            <Check size={16} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            Tek kişilik fotoğraf
          </li>
          <li className="flex gap-2">
            <Check size={16} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            Önden çekilmiş, net görsel
          </li>
          <li className="flex gap-2">
            <Check size={16} className="text-[var(--color-accent)] shrink-0 mt-0.5" />
            Düz veya sade arka plan tercih edilir
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="block bg-[var(--color-bg-elev)] border-2 border-dashed border-[var(--color-line-strong)] hover:border-[var(--color-fg)] transition-colors aspect-[3/4] max-h-[480px] relative cursor-pointer"
        >
          <input
            type="file"
            accept="image/*"
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
              className="absolute inset-0 w-full h-full object-cover"
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
          className="w-full bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-fg)] transition-colors py-4 text-sm font-medium tracking-wide flex items-center justify-center gap-2"
        >
          <Sparkles size={16} />
          KOMBİN ÖNERİSİ AL
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function LoadingStage({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
      <Loader2 className="animate-spin text-[var(--color-accent)]" size={42} />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-[var(--color-muted)]">
        Bu birkaç saniye sürebilir.
      </p>
    </div>
  );
}

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
            2. Sana Önerilen Kombinler
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Beğendiğin kombini seç, üzerine giydirelim.
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
              className="bg-[var(--color-bg-elev)] border border-[var(--color-line)] p-5 flex flex-col gap-4"
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
                    className="aspect-square flex items-center justify-center"
                    style={{ background: p.tone }}
                  >
                    <span className="font-display text-2xl text-white/30">
                      {p.id}
                    </span>
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
            3. İşte Senin Üzerinde
          </h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Beğendiysen tüm parçaları sepete ekleyebilirsin.
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Kombinlere Dön
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="relative aspect-[3/4] bg-[var(--color-bg-elev)]">
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

export default function Page() {
  return (
    <Suspense fallback={<LoadingStage label="Yükleniyor…" />}>
      <KombinFlow />
    </Suspense>
  );
}
