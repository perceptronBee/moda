import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center px-6 py-16 min-h-[80vh]">
      <div
        className="w-full max-w-md border p-8 lg:p-10"
        style={{
          backgroundColor: "var(--color-bg-elev)",
          borderColor: "var(--color-line)",
        }}
      >
        <Link
          href="/"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] flex items-center gap-2 mb-6"
        >
          <ArrowLeft size={14} /> Geri
        </Link>

        <h1 className="font-display text-3xl tracking-wide mb-2">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[var(--color-muted)] mb-8">{subtitle}</p>
        )}

        {children}

        {footer && (
          <p className="text-sm text-center mt-6 text-[var(--color-fg-soft)]">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="text-xs text-[var(--color-accent)] mt-1">{messages[0]}</p>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div
      className="text-sm border-l-2 px-3 py-2 mb-4"
      style={{
        borderColor: "var(--color-accent)",
        backgroundColor: "var(--color-accent-soft)",
        color: "var(--color-accent)",
      }}
    >
      {error}
    </div>
  );
}
