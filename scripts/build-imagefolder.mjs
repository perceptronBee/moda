#!/usr/bin/env node
/**
 * ImageFolder builder — class-based dataset for fashion classification.
 *
 * Ürünleri 14-class taxonomy'sine göre kendi klasörlerine koyar.
 * SADECE giyilmiş (worn) fotoları dahil eder — flat-lay (garment_front /
 * garment_back) fotoları dataset'e GİRMEZ.
 *
 * Çıktı yapısı (torchvision.datasets.ImageFolder uyumlu):
 *
 *   data/ml-dataset/
 *     shirt_top/
 *       LCW-3422865_front.jpg
 *       LCW-3422865_back.jpg     (varsa)
 *       LCW-xxxxxxx_front.jpg
 *       ...
 *     outerwear/
 *       ...
 *     pants/
 *     shorts/
 *     skirt/
 *     dress_jumpsuit/
 *     shoe/
 *     scarf/
 *
 * Disk şişmesin diye HARDLINK (Windows) veya SYMLINK (Unix) kullanır.
 * --copy ile gerçek dosya kopyası alınır.
 *
 * Boş class'lar (hat, headband, tie, tights, sock, bag_wallet) feed'de
 * veri olmadığı için klasör de oluşmaz.
 *
 * Kullanım:
 *   node scripts/build-imagefolder.mjs
 *   node scripts/build-imagefolder.mjs --copy
 *   node scripts/build-imagefolder.mjs --classes shirt_top,outerwear,pants
 *   node scripts/build-imagefolder.mjs --source-only keyword   # sadece keyword-match
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// CLI args
let copy = false;
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--copy") { copy = true; continue; }
  if (a.startsWith("--")) args.set(a.replace(/^--/, ""), process.argv[++i]);
}
const filterClasses = args.has("classes")
  ? new Set(args.get("classes").split(",").map((s) => s.trim()))
  : null;
const sourceFilter = args.get("source-only"); // "keyword" → sadece keyword match

const SRC_JSONL = path.join(REPO_ROOT, "data/ml-dataset.jsonl");
const PUBLIC_BASE = path.join(REPO_ROOT, "public");
const OUT_DIR = path.join(REPO_ROOT, "data/ml-dataset");

if (!fs.existsSync(SRC_JSONL)) {
  console.error(`Önce dataset üret: node scripts/export-ml-dataset.mjs`);
  process.exit(1);
}

if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const rows = fs
  .readFileSync(SRC_JSONL, "utf-8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));

const isWindows = process.platform === "win32";

function link(src, dst) {
  if (!fs.existsSync(src)) return false;
  try {
    if (copy) fs.copyFileSync(src, dst);
    else if (isWindows) fs.linkSync(src, dst);
    else fs.symlinkSync(path.relative(path.dirname(dst), src), dst);
    return true;
  } catch {
    return false;
  }
}

function urlToFsPath(urlPath) {
  try {
    const u = new URL(urlPath);
    return path.join(PUBLIC_BASE, u.pathname);
  } catch {
    return path.join(PUBLIC_BASE, urlPath.replace(/^\//, ""));
  }
}

const stats = {
  total: rows.length,
  written: 0,
  skipped_filtered: 0,
  skipped_missing: 0,
  by_class: {},
};

for (const row of rows) {
  if (filterClasses && !filterClasses.has(row.class)) {
    stats.skipped_filtered++;
    continue;
  }
  if (sourceFilter && row.classification_source !== sourceFilter) {
    stats.skipped_filtered++;
    continue;
  }

  const classDir = path.join(OUT_DIR, row.class);
  fs.mkdirSync(classDir, { recursive: true });

  // SADECE worn fotoları al
  const wornFront = path.join(REPO_ROOT, row.image_path);
  const wornBack = row.additional_photos?.back
    ? urlToFsPath(row.additional_photos.back)
    : null;

  let added = 0;
  if (link(wornFront, path.join(classDir, `${row.id}_front.jpg`))) added++;
  else stats.skipped_missing++;

  if (wornBack && link(wornBack, path.join(classDir, `${row.id}_back.jpg`))) {
    added++;
  }

  if (added > 0) {
    stats.written++;
    stats.by_class[row.class] = (stats.by_class[row.class] ?? 0) + added;
  }
}

console.log(`\n═══ ImageFolder Build (worn photos only) ═══`);
console.log(`Mod:           ${copy ? "copy" : isWindows ? "hardlink" : "symlink"}`);
console.log(`Yazılan ürün:  ${stats.written}`);
console.log(`Foto eksik:    ${stats.skipped_missing}`);
console.log(`Filtre dışı:   ${stats.skipped_filtered}`);
console.log(`\nClass dağılımı (foto sayısı):`);
for (const [cls, n] of Object.entries(stats.by_class).sort((a, b) => b[1] - a[1])) {
  const bar = "█".repeat(Math.min(40, Math.round(n / 20)));
  console.log(`  ${cls.padEnd(18)} ${String(n).padStart(5)}  ${bar}`);
}
console.log(`\nÇıktı: ${path.relative(REPO_ROOT, OUT_DIR)}/`);
console.log(`\nKullanım:`);
console.log(`  from torchvision.datasets import ImageFolder`);
console.log(`  ds = ImageFolder("data/ml-dataset/")`);
