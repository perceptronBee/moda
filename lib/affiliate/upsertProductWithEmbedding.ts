import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

const ProductInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  brand: z.string().optional().default(""),
  category: z.string().optional().default(""),
  description: z.string().optional().default(""),
  price: z.number().finite().nonnegative().optional(),
  image_url: z.string().url().optional(),
  product_url: z.string().url().optional(),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

type UpsertOptions = {
  table?: string;
  embeddingColumn?: string;
  onConflict?: string;
  /**
   * Varsayilan "pipeline":
   *   Pipeline/inference.py -> get_text_embedding() (Marqo fashionCLIP uzayi, 512 dim)
   * "gemini" secenegi sadece fallback/debug icin.
   */
  provider?: "pipeline" | "gemini";
  model?: string;
};

const DEFAULT_TABLE = "affiliate_products";
const DEFAULT_EMBEDDING_COLUMN = "embedding";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-004";
const execFileAsync = promisify(execFile);

function parseEmbeddingFromPythonStdout(stdout: string): number[] {
  // inference.py model yuklerken bir suru log basiyor; son satirdaki JSON'u al.
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((n: unknown) => typeof n === "number")
      ) {
        return parsed as number[];
      }
    } catch {
      // next line
    }
  }
  throw new Error("Pipeline embedding stdout icinden parse edilemedi.");
}

function buildEmbeddingText(input: ProductInput): string {
  return [
    `urun: ${input.title}`,
    `marka: ${input.brand}`,
    `kategori: ${input.category}`,
    `aciklama: ${input.description}`,
  ]
    .map((v) => v.trim())
    .filter(Boolean)
    .join("\n");
}

async function createGeminiEmbedding(text: string, model = DEFAULT_EMBEDDING_MODEL): Promise<number[]> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY eksik. .env.local icine gecerli anahtar ekle.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: {
        role: "user",
        parts: [{ text }],
      },
      outputDimensionality: 768,
    }),
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok) {
    const msg =
      typeof json?.error?.message === "string"
        ? json.error.message
        : `Embedding API hatasi (${res.status})`;
    throw new Error(msg);
  }

  const values = json?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Embedding degeri bos dondu.");
  }
  if (!values.every((n: unknown) => typeof n === "number")) {
    throw new Error("Embedding degeri sayisal degil.");
  }
  return values as number[];
}

async function createPipelineEmbedding(text: string): Promise<number[]> {
  const pipelineDir = process.env.EMBEDDING_PIPELINE_DIR ?? `${process.cwd()}/Pipeline`;
  const oneLiner = [
    "import json, sys",
    "from inference import get_text_embedding",
    "print(json.dumps(get_text_embedding(sys.argv[1])))",
  ].join("; ");

  const { stdout, stderr } = await execFileAsync(
    process.env.PYTHON_BIN ?? "python3",
    ["-c", oneLiner, text],
    { cwd: pipelineDir, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
  );

  if (stderr?.trim()) {
    // inference.py cok log basabiliyor; fatal degilse ignore ediyoruz.
  }

  return parseEmbeddingFromPythonStdout(stdout);
}

async function createPipelineImageEmbedding(imageUrl: string): Promise<number[]> {
  const response = await fetch(imageUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Urun gorseli indirilemedi: ${response.status}`);
  }
  const mime = response.headers.get("content-type") ?? "";
  if (!mime.startsWith("image/")) {
    throw new Error("image_url bir gorsel degil.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const tempPath = join(
    tmpdir(),
    `moda-embed-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
  );
  await writeFile(tempPath, bytes);

  try {
    const pipelineDir = process.env.EMBEDDING_PIPELINE_DIR ?? `${process.cwd()}/Pipeline`;
    const oneLiner = [
      "import json, sys",
      "from inference import process_image",
      "items = process_image(sys.argv[1])",
      "if not items: raise RuntimeError('No garment detected')",
      "best = max(items, key=lambda x: float(x.get('yolo_confidence', 0.0)) * float(x.get('zero_shot_confidence', 1.0)))",
      "emb = best.get('embedding')",
      "if not emb: raise RuntimeError('Embedding missing')",
      "print(json.dumps(emb))",
    ].join("; ");

    const { stdout } = await execFileAsync(
      process.env.PYTHON_BIN ?? "python3",
      ["-c", oneLiner, tempPath],
      { cwd: pipelineDir, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 },
    );

    return parseEmbeddingFromPythonStdout(stdout);
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

/**
 * Urunu DB'ye upsert eder ve embedding kolonunu otomatik doldurur.
 * Server tarafinda (Route Handler / Server Action / cron script) cagirilmalidir.
 */
export async function upsertProductWithEmbedding(
  rawInput: ProductInput,
  options: UpsertOptions = {},
) {
  const input = ProductInputSchema.parse(rawInput);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase env eksik. NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.",
    );
  }

  const table = options.table ?? DEFAULT_TABLE;
  const embeddingColumn = options.embeddingColumn ?? DEFAULT_EMBEDDING_COLUMN;
  const onConflict = options.onConflict ?? "id";
  const provider = options.provider ?? "pipeline";
  const model = options.model ?? DEFAULT_EMBEDDING_MODEL;

  const embeddingText = buildEmbeddingText(input);
  const embedding =
    provider === "pipeline"
      ? input.image_url
        ? await createPipelineImageEmbedding(input.image_url)
        : await createPipelineEmbedding(embeddingText)
      : await createGeminiEmbedding(embeddingText, model);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const row = {
    ...input,
    [embeddingColumn]: embedding,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(table)
    .upsert(row, { onConflict })
    .select()
    .single();

  if (error) {
    throw new Error(`DB upsert hatasi: ${error.message}`);
  }

  return {
    ok: true as const,
    product: data,
    embeddingDimensions: embedding.length,
    provider,
  };
}

