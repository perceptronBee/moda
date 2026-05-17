/**
 * Virtual Try-On client — Python FastAPI servisine HTTP istekleri.
 *
 * Servis URL'i SADECE server-side env'de tutulur. Browser bunu görmez,
 * Next route handler proxy'liyor.
 *
 * Env:
 *   VTON_API_URL    — Python servisin base URL'i (örn. https://vton-xxx.run.app)
 *   VTON_API_TOKEN  — Python servisin shared secret header değeri
 */

export type TryOnInput = {
  baseImage: Blob | File;
  itemImages: Array<Blob | File>;
};

export type TryOnResult =
  | { ok: true; resultDataUrl: string }
  | { ok: false; error: string };

export async function callVtonTryOn(input: TryOnInput): Promise<TryOnResult> {
  const baseUrl = process.env.VTON_API_URL;
  if (!baseUrl) {
    return { ok: false, error: "VTON servis konfigüre değil" };
  }
  const token = process.env.VTON_API_TOKEN;

  // En az 1 base + 1 item
  if (!input.baseImage || input.itemImages.length === 0) {
    return { ok: false, error: "Base image ve en az 1 item gerekli" };
  }
  // Pratik üst sınır
  if (input.itemImages.length > 5) {
    return { ok: false, error: "En fazla 5 item kabul ediliyor" };
  }

  const form = new FormData();
  form.append("base_image", input.baseImage, "base.png");
  input.itemImages.forEach((item, i) => {
    form.append(`item_${i + 1}`, item, `item_${i + 1}.png`);
  });

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60_000); // 60 sn

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/try-on`, {
      method: "POST",
      body: form,
      signal: ctrl.signal,
      headers: token ? { "X-API-Token": token } : undefined,
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j.detail ?? detail;
      } catch {}
      return { ok: false, error: detail };
    }

    const data = (await res.json()) as { result_image?: string };
    if (!data.result_image?.startsWith("data:image/")) {
      return { ok: false, error: "Geçersiz cevap formatı" };
    }
    return { ok: true, resultDataUrl: data.result_image };
  } catch (e) {
    const msg = (e as Error)?.message ?? "Bilinmeyen hata";
    return { ok: false, error: msg.includes("aborted") ? "Zaman aşımı" : msg };
  } finally {
    clearTimeout(timeout);
  }
}
