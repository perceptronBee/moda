"use client";

import { useActionState } from "react";
import { updateName, updateEmail, updatePhone } from "@/app/actions/profile";

export function SettingsForm({ user }: { user: { name: string, email: string, phone: string } }) {
  const [nameState, nameAction, namePending] = useActionState(updateName, null);
  const [emailState, emailAction, emailPending] = useActionState(updateEmail, null);
  const [phoneState, phoneAction, phonePending] = useActionState(updatePhone, null);

  return (
    <div className="space-y-12">
      {/* Update Name Form */}
      <form action={nameAction} className="space-y-4">
        <h2 className="font-display text-xl tracking-wide border-b border-[var(--color-line)] pb-2 mb-4">Kişisel Bilgiler</h2>
        {nameState?.error && (
          <div className="p-3 bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-sm border border-[var(--color-accent)]">
            {nameState.error}
          </div>
        )}
        {nameState?.ok && (
          <div className="p-3 bg-green-50 text-green-700 text-sm border border-green-200">
            {nameState.message}
          </div>
        )}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Ad Soyad</label>
            <input name="name" type="text" defaultValue={user.name} required className="w-full border border-[var(--color-line)] p-3 outline-none focus:border-[var(--color-fg)]" placeholder="Adınız Soyadınız" />
          </div>
          <button 
            type="submit" 
            disabled={namePending}
            className="h-[50px] bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors px-6 font-medium tracking-wide disabled:opacity-50" 
          >
            {namePending ? "..." : "GÜNCELLE"}
          </button>
        </div>
      </form>

      {/* Update Email Form */}
      <form action={emailAction} className="space-y-4">
        <h2 className="font-display text-xl tracking-wide border-b border-[var(--color-line)] pb-2 mb-4">Giriş Bilgileri</h2>
        {emailState?.error && (
          <div className="p-3 bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-sm border border-[var(--color-accent)]">
            {emailState.error}
          </div>
        )}
        {emailState?.ok && (
          <div className="p-3 bg-green-50 text-green-700 text-sm border border-green-200">
            {emailState.message}
          </div>
        )}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">E-posta</label>
            <input name="email" type="email" defaultValue={user.email} required className="w-full border border-[var(--color-line)] p-3 outline-none focus:border-[var(--color-fg)]" placeholder="E-posta adresiniz" />
          </div>
          <button 
            type="submit" 
            disabled={emailPending}
            className="h-[50px] bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors px-6 font-medium tracking-wide disabled:opacity-50" 
          >
            {emailPending ? "..." : "GÜNCELLE"}
          </button>
        </div>
      </form>

      {/* Update Phone Form */}
      <form action={phoneAction} className="space-y-4">
        <h2 className="font-display text-xl tracking-wide border-b border-[var(--color-line)] pb-2 mb-4">İletişim Bilgileri</h2>
        {phoneState?.error && (
          <div className="p-3 bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-sm border border-[var(--color-accent)]">
            {phoneState.error}
          </div>
        )}
        {phoneState?.ok && (
          <div className="p-3 bg-green-50 text-green-700 text-sm border border-green-200">
            {phoneState.message}
          </div>
        )}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Telefon</label>
            <input name="phone" type="tel" defaultValue={user.phone} className="w-full border border-[var(--color-line)] p-3 outline-none focus:border-[var(--color-fg)]" placeholder="Telefon numaranız" />
          </div>
          <button 
            type="submit" 
            disabled={phonePending}
            className="h-[50px] bg-[var(--color-fg)] text-[var(--color-bg)] hover:bg-[var(--color-accent)] transition-colors px-6 font-medium tracking-wide disabled:opacity-50" 
          >
            {phonePending ? "..." : "GÜNCELLE"}
          </button>
        </div>
      </form>
    </div>
  );
}
