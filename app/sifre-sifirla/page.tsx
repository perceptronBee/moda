"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type ActionResult,
} from "@/app/actions/auth";
import { AuthShell, FormError } from "@/components/AuthShell";

export default function ResetRequestPage() {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(requestPasswordReset, null);

  return (
    <AuthShell
      title="Şifre Sıfırla"
      subtitle="E-postanı gir, sana yeni şifre belirleme linki gönderelim."
      footer={
        <>
          Vazgeçtin mi?{" "}
          <Link href="/giris" className="underline font-medium">
            Giriş Yap
          </Link>
        </>
      }
    >
      <FormError error={state && !state.ok ? state.error : undefined} />
      {state?.ok && (
        <div
          className="text-sm border-l-2 px-3 py-2 mb-4"
          style={{
            borderColor: "var(--color-fg)",
            backgroundColor: "var(--color-bg-soft)",
          }}
        >
          E-posta gönderildi. Lütfen kutunu kontrol et.
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">E-Posta</span>
          <input
            name="email"
            type="email"
            required
            placeholder="ornek@email.com"
            className="bg-[var(--color-bg)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none px-4 py-3 text-sm transition-colors"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-50 transition-colors py-3.5 text-sm font-medium tracking-wide"
        >
          {pending ? "GÖNDERİLİYOR…" : "LİNK GÖNDER"}
        </button>
      </form>
    </AuthShell>
  );
}
