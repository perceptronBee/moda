"use client";

import { useActionState } from "react";
import { updatePassword, type ActionResult } from "@/app/actions/auth";
import { AuthShell, FieldError, FormError } from "@/components/AuthShell";

export default function NewPasswordPage() {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(updatePassword, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <AuthShell
      title="Yeni Şifre Belirle"
      subtitle="Aşağıya yeni şifreni gir."
    >
      <FormError error={state && !state.ok ? state.error : undefined} />

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Yeni Şifre</span>
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

        <button
          type="submit"
          disabled={pending}
          className="mt-2 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-50 transition-colors py-3.5 text-sm font-medium tracking-wide"
        >
          {pending ? "GÜNCELLENİYOR…" : "ŞİFREYİ GÜNCELLE"}
        </button>
      </form>
    </AuthShell>
  );
}
