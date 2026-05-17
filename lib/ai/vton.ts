/**
 * Virtual Try-On client — Serverless API Call directly to fal.ai (by-passing Python backend)
 */

export type TryOnInput = {
  baseImage: Blob | File;
  itemImages: Array<Blob | File>;
};

export type TryOnResult =
  | { ok: true; resultDataUrl: string }
  | { ok: false; error: string };

// Helper to convert Blob to Base64 Data URL natively in Node.js / Edge
async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mimeType = blob.type || "image/jpeg";
  return `data:${""}${mimeType};base64,${""}${buffer.toString("base64")}`;
}

// Function to poll the fal.ai queue status
async function pollFalRequest(reqId: string, falKey: string, ctrlSignal: AbortSignal): Promise<string> {
  while (true) {
    if (ctrlSignal.aborted) throw new Error("Timeout: Polling aborted");
    const statusRes = await fetch(`https://queue.fal.run/fal-ai/cat-vton/requests/${""}${reqId}/status`, {
      headers: { "Authorization": `Key ${""}${falKey}` },
      signal: ctrlSignal
    });
    const statusData = await statusRes.json();
    if (statusData.status === "COMPLETED") {
      const finalRes = await fetch(`https://queue.fal.run/fal-ai/cat-vton/requests/${""}${reqId}`, {
        headers: { "Authorization": `Key ${""}${falKey}` },
        signal: ctrlSignal
      });
      const finalData = await finalRes.json();
      return finalData.image.url;
    } else if (statusData.status === "FAILED") {
      throw new Error(`Fal generation failed: ${""}${JSON.stringify(statusData)}`);
    }
    // Wait 2 seconds before polling again
    await new Promise(r => setTimeout(r, 2000));
  }
}

export async function callVtonTryOn(input: TryOnInput): Promise<TryOnResult> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return { ok: false, error: "FAL_KEY environment variable eksik. Vercel ayarlarina ekleyin." };
  }

  // En az 1 base + 1 item
  if (!input.baseImage || input.itemImages.length === 0) {
    return { ok: false, error: "Base image ve en az 1 item gerekli" };
  }
  
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 55_000); // Vercel limitine guvenli yaklasim 55 sn

  try {
    // 1. Dosyalari Base64 formatina cevir (Hizlica Vercel kendi belleginde)
    const humanImageUrl = await blobToDataUrl(input.baseImage);
    const garmentImageUrl = await blobToDataUrl(input.itemImages[0]);

    // 2. Fal.ai CatVTON modeline istegi gonder
    const res = await fetch("https://queue.fal.run/fal-ai/cat-vton", {
      method: "POST",
      headers: {
        "Authorization": `Key ${""}${falKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        human_image_url: humanImageUrl,
        garment_image_url: garmentImageUrl,
        cloth_type: "upper"
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      let detail = `HTTP ${""}${res.status}`;
      try {
        const j = await res.json();
        // Extract string from detail if its array or string
        detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail || j);
      } catch {}
      return { ok: false, error: detail };
    }

    const data = await res.json();
    
    // 3. Eger siraya alindiysa (Queue URL donduyse)
    let imageUrl = "";
    if (data.request_id) {
       imageUrl = await pollFalRequest(data.request_id, falKey, ctrl.signal);
    } else if (data.image && data.image.url) {
       imageUrl = data.image.url;
    } else {
       return { ok: false, error: "Sonuc gorseli fal.ai donmedi" };
    }

    // Gelen resmi tekrar base64 formatinda Next.js frontende aktarmak icin
    const imgFetch = await fetch(imageUrl, { signal: ctrl.signal });
    const imgBlob = await imgFetch.blob();
    const finalDataUrl = await blobToDataUrl(imgBlob);

    return { ok: true, resultDataUrl: finalDataUrl };
  } catch (e) {
    const msg = (e as Error)?.message ?? "Bilinmeyen hata";
    return { ok: false, error: msg.includes("aborted") ? "Model suresi 55 saniyeyi asti. Lutfen daha sonra tekrar dene." : msg };
  } finally {
    clearTimeout(timeout);
  }
}

