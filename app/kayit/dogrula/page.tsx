import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";

export default function VerifyPage() {
  return (
    <AuthShell
      title="E-Postanı Kontrol Et"
      subtitle="Hesabını aktive etmek için sana bir doğrulama linki gönderdik."
      footer={
        <>
          E-postanı alamadın mı?{" "}
          <Link href="/giris" className="underline font-medium">
            Tekrar Dene
          </Link>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-16 h-16 flex items-center justify-center border border-[var(--color-line)]">
          <Mail size={28} />
        </div>
        <p className="text-sm text-[var(--color-fg-soft)] text-center leading-relaxed">
          Birkaç dakika içinde e-postan gelmezse spam klasörünü kontrol et.
          <br />
          Doğrulama linkine tıkladıktan sonra otomatik olarak giriş yapacaksın.
        </p>
      </div>
    </AuthShell>
  );
}
