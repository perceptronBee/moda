import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="px-6 lg:px-10 py-16 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Settings size={28} />
        <h1 className="font-display text-3xl">Hesap Ayarları</h1>
      </div>
      <SettingsForm 
        user={{ 
          email: user.email ?? "", 
          name: profile?.full_name ?? "", 
          phone: profile?.phone ?? "" 
        }} 
      />
    </div>
  );
}
