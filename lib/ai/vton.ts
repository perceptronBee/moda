/**
 * Virtual Try-On client — Gemini 2.5 Flash Image (Nano Banana)
 *
 * Aktif model: Google AI Studio üzerinden Gemini 2.5 Flash Image
 *   - Multi-garment tek istekte
 *   - Prompt-based talimat kabul eder
 *   - 5-10sn tipik
 *
 * Önceki denemeler (yorum satırında bırakıldı, geri dönüş için):
 *   - fal-ai/cat-vton (tek garment, hızlı, orta kalite)
 *   - fal-ai/idm-vton (yavaş, yüksek kalite)
 *   - fal-ai/fashn/tryon (hatalı endpoint)
 *   - fal-ai/flux-pro/kontext/max/multi (try-on için uygun değil, image editor)
 */
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

export type TryOnInput = {
  baseImage: Blob | File;
  itemImages: Array<Blob | File>;
};

export type TryOnResult =
  | { ok: true; resultDataUrl: string }
  | { ok: false; error: string };

const GEMINI_MODEL = "gemini-2.5-flash-image";

// ──────────────────────────────────────────────────────────────────────────
// Resize → JPEG → base64 (Gemini inlineData için)
// Person foto: 3:4 portre kanvasa pad et (Gemini kırpma yapmasın diye).
// Garment fotoları: resize yeter, ratio dokunulmaz.
// ──────────────────────────────────────────────────────────────────────────
async function blobToParts(
  blob: Blob,
  opts: { padToPortrait?: boolean; maxDim?: number } = {},
): Promise<{
  part: { mimeType: string; data: string };
  width: number;
  height: number;
}> {
  const { padToPortrait = false, maxDim = 1024 } = opts;
  const inputBuf = Buffer.from(await blob.arrayBuffer());
  let pipeline = sharp(inputBuf).rotate();

  if (padToPortrait) {
    const targetW = 768;
    const targetH = 1024;
    pipeline = pipeline.resize(targetW, targetH, {
      fit: "contain",
      background: { r: 240, g: 240, b: 240 },
      withoutEnlargement: false,
    });
  } else {
    pipeline = pipeline.resize(maxDim, maxDim, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const out = await pipeline.jpeg({ quality: 88 }).toBuffer();
  const meta = await sharp(out).metadata();
  return {
    part: { mimeType: "image/jpeg", data: out.toString("base64") },
    width: meta.width ?? maxDim,
    height: meta.height ?? maxDim,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Garment image sınıflandırması (Sharp heuristik)
// flat lay vs on-model — prompt'a iletilir, model'in nasıl yorumlayacağını bilir
// ──────────────────────────────────────────────────────────────────────────
async function classifyGarmentImage(blob: Blob): Promise<"flatlay" | "on-model"> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const { dominant } = await sharp(buf).stats();
  const brightness = (dominant.r + dominant.g + dominant.b) / 3;
  const saturation =
    Math.max(dominant.r, dominant.g, dominant.b) -
    Math.min(dominant.r, dominant.g, dominant.b);
  if (brightness > 200 && saturation < 30) return "flatlay";
  return "on-model";
}

// ──────────────────────────────────────────────────────────────────────────
// Prompt engineering — Gemini'nin instruction-following gücünden yararlan
// (Bu blok FLUX Kontext denemesinde de aynıydı; Gemini için de geçerli.)
// ──────────────────────────────────────────────────────────────────────────
function buildPrompt(itemCount: number, garmentTypes: string[]): string {
  const garmentList =
    garmentTypes.length > 0
      ? garmentTypes.join(", ")
      : `${""}${itemCount} fashion garment${itemCount > 1 ? "s" : ""}`;

  return [
    `Task: Photorealistic virtual try-on. Edit Image 1 so the person wears the garments from Images 2-${1 + itemCount}.`,
    ``,
    `INPUTS (in order):`,
    `• Image 1 — TARGET PERSON. The face, body, pose, framing, background and lighting are the immutable reference.`,
    `• Images 2..${1 + itemCount} — GARMENT references (${garmentList}). Each may be a flat-lay, hanger shot, packshot, or worn by a different model. Use only the garment's visual properties (color, pattern, fabric, cut, length).`,
    ``,
    `IDENTITY & BODY (highest priority):`,
    `1. Keep the face IDENTICAL — eyes, nose, mouth, jawline, eyebrows, hairline, skin tone, beard/facial hair, age, ethnicity, expression. Do not retouch or smooth the face.`,
    `2. Keep the body proportions EXACTLY as in Image 1 — height, weight, build, shoulder width, waist, limb length. Do not slim, idealize, muscle-up, or stylize.`,
    `3. Keep the pose, gesture, hand position and head tilt unchanged.`,
    `4. Keep the original background, floor, props, camera angle, focal length and depth-of-field. Do not crop, zoom, or recompose.`,
    `5. Match the original lighting direction, color temperature, and shadow softness on the new garments.`,
    ``,
    `GARMENT PLACEMENT:`,
    `6. Map each garment to its anatomical region — tops/jackets/shirts → torso & arms; pants/shorts/skirts → hips & legs; dresses/jumpsuits → torso & legs; shoes → feet; hats → head; bags → hand/shoulder. Do not place garments outside their natural region.`,
    `7. Replace ONLY the regions the new garments cover. Skin, hair, untouched clothing parts and accessories that were already on the person stay pixel-faithful to Image 1.`,
    `8. If a garment reference shows ONE SHOE/SOCK/GLOVE only, render a mirrored matching pair.`,
    `9. If a garment reference is worn by another model, ignore that model's face, body and pose. Extract garment design only and re-fit it to the target person's body.`,
    `10. If a garment reference is a flat-lay/packshot, render it with natural draping, wrinkles, fabric weight and shadows that match the target person's pose.`,
    `11. Render garments with realistic fit for the person's body (no glued-on look). Sleeves end at wrists, pant legs at ankles unless garment is explicitly cropped style.`,
    ``,
    `VIEW & FRAMING:`,
    `12. Preserve the camera view of Image 1 (front, three-quarter, side, or back). If Image 1 is a back view, infer the back design of the garment naturally and render the garment from behind.`,
    `13. Preserve the crop of Image 1 — if Image 1 is a half-body shot, keep it half-body; do not invent legs or feet outside the original frame.`,
    ``,
    `GRAPHICS, LOGOS & TEXT (zero-tolerance for changes):`,
    `14. Reproduce ALL printed text, logos, brand marks, monograms, embroidery, patches, badges, slogans and graphic prints on the garment EXACTLY as they appear in the reference — identical letters, spelling, font, kerning, color, size proportion, and placement on the garment.`,
    `15. Do not paraphrase, redraw, blur, invent, or stylize any text. Treat every glyph as a fixed asset that must be transplanted verbatim.`,
    `16. If a logo or text is only partially visible in the reference, render exactly the visible portion. Do not complete or fabricate the hidden part.`,
    `17. Preserve garment patterns 1:1 — stripes count and width, plaid grids, polka-dot density, jacquard motifs, distressed/print-defect locations. Stripe direction (horizontal/vertical/diagonal) must match the reference.`,
    `18. Preserve button rows, zipper paths, pocket placement, stitching color, trim color and hardware finish (silver/gold/matte) faithfully.`,
    ``,
    `QUALITY:`,
    `19. Output must be photorealistic, sharp, high-detail. Realistic fabric textures (denim weave, knit ribbing, leather grain, jersey drape, satin sheen). Visible weave and stitch where appropriate.`,
    `20. No painterly, illustrated, anime, watercolor, oil-paint, or stylized rendering. No oversaturation. No skin-smoothing filter. No beauty retouch.`,
    ``,
    `DO NOT:`,
    `21. Do not add garments that are not in the references.`,
    `22. Do not duplicate or omit any provided garment.`,
    `23. Do not add overlay text, watermarks, captions, borders, collage panels, product cards, or generated brand names. Only the garment's OWN existing logos/text from the reference should appear.`,
    `24. Do not produce multiple images, side-by-side comparisons, or before/after layouts.`,
    ``,
    `OUTPUT: Exactly one photorealistic image of the same target person from Image 1 wearing the complete outfit.`,
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────────────────
// Main call — Gemini 2.5 Flash Image
// ──────────────────────────────────────────────────────────────────────────
export async function callVtonTryOn(input: TryOnInput): Promise<TryOnResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "GEMINI_API_KEY environment variable eksik. .env.local'e ekle.",
    };
  }
  if (!input.baseImage || input.itemImages.length === 0) {
    return { ok: false, error: "Base image ve en az 1 item gerekli" };
  }

  const ctrl = new AbortController();
  const TIMEOUT_MS = process.env.VERCEL ? 55_000 : 180_000;
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    // 1. Tüm görselleri Gemini parts formatına çevir
    //    Person fotoğrafı 3:4 portre kanvasa pad — Gemini başı kırpmasın
    const personResult = await blobToParts(input.baseImage, {
      padToPortrait: true,
    });
    const personPart = personResult.part;
    const garmentResults = await Promise.all(
      input.itemImages.map((b) => blobToParts(b)),
    );
    const garmentParts = garmentResults.map((g) => g.part);

    // 2. Garment tiplerini sınıflandır
    const garmentTypes = await Promise.all(
      input.itemImages.map(async (b, i) => {
        const kind = await classifyGarmentImage(b);
        return `garment ${i + 1} (${kind})`;
      }),
    );

    // 3. Prompt'u inşa et
    const prompt = buildPrompt(input.itemImages.length, garmentTypes);
    console.log("[VTON] prompt:", prompt.slice(0, 200), "...");

    // 4. Gemini çağrısı
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: personPart },
            ...garmentParts.map((g) => ({ inlineData: g })),
          ],
        },
      ],
    });

    // 5. Üretilen image parts'ı çıkar
    const parts = result.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      const textParts = parts
        .map((p: any) => p.text)
        .filter(Boolean)
        .join(" ");
      console.log("[VTON] Gemini text response:", textParts.slice(0, 300));
      return {
        ok: false,
        error: `Gemini gorsel uretmedi. Donen text: ${textParts.slice(0, 200) || "(bos)"}`,
      };
    }

    const mime = imagePart.inlineData.mimeType || "image/png";
    const finalDataUrl = `data:${""}${mime};base64,${""}${imagePart.inlineData.data}`;

    return { ok: true, resultDataUrl: finalDataUrl };
  } catch (e) {
    const msg = (e as Error)?.message ?? "Bilinmeyen hata";
    return {
      ok: false,
      error: msg.includes("aborted")
        ? "Model suresi asildi."
        : `Gemini API hatasi: ${""}${msg}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

