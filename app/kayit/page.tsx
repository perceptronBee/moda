"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type ActionResult } from "@/app/actions/auth";
import { AuthShell, FieldError, FormError } from "@/components/AuthShell";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    signup,
    null,
  );
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <AuthShell
      title="Üye Ol"
      subtitle="Birkaç bilgiyle hesabını oluştur."
      footer={
        <>
          Zaten hesabın var mı?{" "}
          <Link href="/giris" className="underline font-medium">
            Giriş Yap
          </Link>
        </>
      }
    >
      <FormError error={state && !state.ok ? state.error : undefined} />

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Ad Soyad</span>
          <input
            name="fullName"
            type="text"
            required
            autoComplete="name"
            className="bg-[var(--color-bg)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none px-4 py-3 text-sm transition-colors"
          />
          <FieldError messages={fe?.fullName} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">E-Posta</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="ornek@email.com"
            className="bg-[var(--color-bg)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none px-4 py-3 text-sm transition-colors"
          />
          <FieldError messages={fe?.email} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Şifre</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="bg-[var(--color-bg)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none px-4 py-3 text-sm transition-colors"
          />
          <span className="text-xs text-[var(--color-muted)]">
            En az 8 karakter, 1 büyük harf, 1 rakam.
          </span>
          <FieldError messages={fe?.password} />
        </label>

        <label className="flex items-start gap-2 text-xs text-[var(--color-fg-soft)] mt-2">
          <input type="checkbox" name="kvkk" required className="mt-0.5" />
          <span>
            <Link href="/kvkk" className="underline">
              KVKK Aydınlatma Metni
            </Link>
            'ni okudum, kişisel verilerimin işlenmesini kabul ediyorum.
          </span>
        </label>
        <FieldError messages={fe?.kvkk} />

        <button
          type="submit"
          disabled={pending}
          className="mt-2 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-50 transition-colors py-3.5 text-sm font-medium tracking-wide"
        >
          {pending ? "OLUŞTURULUYOR…" : "ÜYE OL"}
        </button>
      </form>
    </AuthShell>
  );
}
