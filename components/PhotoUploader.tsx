"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Check, X } from "lucide-react";
import { uploadUserPhoto } from "@/app/actions/profile";

type Props = {
  side: "front" | "back";
  label: string;
  description: string;
  required?: boolean;
  initialUrl?: string | null;
};

export function PhotoUploader({
  side,
  label,
  description,
  required,
  initialUrl,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(Boolean(initialUrl));
  const [pending, startTransition] = useTransition();

  const handle = (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("Dosya 10MB'ı aşamaz");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("JPG, PNG veya WEBP yüklemelisin");
      return;
    }
    setPreview(URL.createObjectURL(file));
    setDone(false);

    const fd = new FormData();
    fd.append("photo", file);

    startTransition(async () => {
      const res = await uploadUserPhoto(side, fd);
      if (res.ok) {
        setDone(true);
      } else {
        setError(res.error);
        setDone(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg tracking-wide">
          {label} {required && <span className="text-[var(--color-accent)]">*</span>}
        </h3>
        {done && (
          <span className="meta flex items-center gap-1 text-[var(--color-fg)]">
            <Check size={12} /> YÜKLENDİ
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--color-muted)]">{description}</p>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handle(f);
        }}
        className="relative aspect-[3/4] border-2 border-dashed cursor-pointer overflow-hidden transition-colors flex flex-col items-center justify-center gap-3"
        style={{
          backgroundColor: "var(--color-bg-soft)",
          borderColor: done
            ? "var(--color-fg)"
            : "var(--color-line-strong)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
          }}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[var(--color-muted)]">
            <Camera size={32} />
            <p className="text-sm">Fotoğraf seç veya sürükle</p>
            <p className="text-xs">JPG, PNG, WEBP · Max 10MB</p>
          </div>
        )}
        {pending && (
          <div
            className="absolute inset-0 flex items-center justify-center gap-2"
            style={{ backgroundColor: "rgba(0,0,0,0.4)", color: "#fff" }}
          >
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Yükleniyor…</span>
          </div>
        )}
      </label>

      {error && (
        <p className="text-xs text-[var(--color-accent)] flex items-center gap-1">
          <X size={12} /> {error}
        </p>
      )}
    </div>
  );
}
