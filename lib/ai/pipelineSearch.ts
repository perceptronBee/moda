import { execFile } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PipelineHit = {
  id: string;
  similarity_score?: number;
  class?: string;
  gender?: string;
  name?: string;
};

function parseLastJson<T>(stdout: string): T {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]) as T;
    } catch {
      // keep scanning
    }
  }
  throw new Error("Pipeline stdout icinde parse edilebilir JSON bulunamadi.");
}

async function runPipeline(args: string[]): Promise<PipelineHit[]> {
  const pipelineDir = process.env.EMBEDDING_PIPELINE_DIR ?? `${process.cwd()}/Pipeline`;
  const pythonBin = process.env.PYTHON_BIN ?? "python3";

  const script = [
    "import json, sys",
    "from inference import get_text_embedding, process_image",
    "from database import FashionDatabase",
    "db = FashionDatabase('enriched_database.jsonl')",
    "mode = sys.argv[1]",
    "payload = sys.argv[2]",
    "top_k = int(sys.argv[3])",
    "if mode == 'text':",
    "  emb = get_text_embedding(payload)",
    "else:",
    "  items = process_image(payload)",
    "  if not items: raise RuntimeError('No garment detected')",
    "  best = max(items, key=lambda x: float(x.get('yolo_confidence', 0.0)) * float(x.get('zero_shot_confidence', 1.0)))",
    "  emb = best.get('embedding')",
    "  if not emb: raise RuntimeError('Embedding missing')",
    "res = db.search_by_embedding(emb, top_k=top_k)",
    "print(json.dumps(res, ensure_ascii=False))",
  ].join("; ");

  const { stdout } = await execFileAsync(
    pythonBin,
    ["-c", script, ...args],
    {
      cwd: pipelineDir,
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  const parsed = parseLastJson<unknown>(stdout);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x): x is PipelineHit => Boolean(x && typeof x === "object" && typeof (x as PipelineHit).id === "string"));
}

export async function searchPipelineByText(text: string, topK = 40): Promise<PipelineHit[]> {
  return runPipeline(["text", text, String(topK)]);
}

export async function searchPipelineByImageUrl(
  imageUrl: string,
  topK = 40,
): Promise<PipelineHit[]> {
  const res = await fetch(imageUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Anchor gorseli indirilemedi (${res.status})`);
  }
  const mime = res.headers.get("content-type") ?? "";
  if (!mime.startsWith("image/")) {
    throw new Error("Anchor image_url bir gorsel degil.");
  }

  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const filePath = join(
    tmpdir(),
    `moda-suggest-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
  );
  const bytes = new Uint8Array(await res.arrayBuffer());
  await writeFile(filePath, bytes);

  try {
    return await runPipeline(["image", filePath, String(topK)]);
  } finally {
    await unlink(filePath).catch(() => undefined);
  }
}

