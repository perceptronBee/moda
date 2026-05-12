"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login, type ActionResult } from "@/app/actions/auth";
import { AuthShell, FormError } from "@/components/AuthShell";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(login, null);

  return (
    <AuthShell
      title="Giriş Yap"
      subtitle="Hesabına giriş yaparak alışverişe başla."
      footer={
        <>
          Hesabın yok mu?{" "}
          <Link href="/kayit" className="underline font-medium">
            Üye Ol
          </Link>
        </>
      }
    >
      <FormError error={state && !state.ok ? state.error : undefined} />

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

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
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Şifre</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="bg-[var(--color-bg)] border border-[var(--color-line)] focus:border-[var(--color-fg)] outline-none px-4 py-3 text-sm transition-colors"
          />
        </label>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="remember" defaultChecked />
            <span>Beni hatırla</span>
          </label>
          <Link
            href="/sifre-sifirla"
            className="underline text-[var(--color-muted)]"
          >
            Şifremi unuttum
          </Link>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] disabled:opacity-50 transition-colors py-3.5 text-sm font-medium tracking-wide"
        >
          {pending ? "GİRİŞ YAPILIYOR…" : "GİRİŞ YAP"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
