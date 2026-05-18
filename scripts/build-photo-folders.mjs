#!/usr/bin/env node
/**
 * Photo-availability organized dataset builder.
 *
 * Ürünleri kategori/sınıfa göre değil, MEVCUT FOTOĞRAF TİPLERİNE göre 3 ana
 * gruba ayırır. Her ürünün kendi alt-klasörü olur, içinde o ürün için var
 * olan tüm görseller (worn front/back + flat-lay front/back) bulunur.
 *
 * Çıktı yapısı:
 *
 *   data/ml-dataset/
 *     01_flatlay_full/              ← 570 ürün — flat-lay ön+arka mevcut
 *       LCW-3422865/
 *         worn_front.jpg
 *         worn_back.jpg
 *         garment_front.jpg
 *         garment_back.jpg
 *       LCW-xxx/...
 *
 *     02_flatlay_front_only/        ← 222 ürün — sadece flat-lay ön
 *       LCW-yyy/
 *         worn_front.jpg
 *         worn_back.jpg            (varsa)
 *         garment_front.jpg
 *
 *     03_no_flatlay/                ← 307 ürün — sadece giyilmiş foto
 *       LCW-zzz/
 *         worn_front.jpg
 *         worn_back.jpg            (varsa)
 *
 *     INDEX.jsonl                   ← her ürün hangi gruba düştü, hangi
 *                                     fotolara sahip — meta lookup
 *
 * Disk şişmesin diye HARDLINK (Windows) veya SYMLINK (Unix) kullanır.
 * --copy ile gerçek dosya kopyası alınır.
 *
 * Kullanım:
 *   node scripts/build-photo-folders.mjs
 *   node scripts/build-photo-folders.mjs --copy
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const copy = process.argv.includes("--copy");

const SRC_JSONL = path.join(REPO_ROOT, "data/ml-dataset.jsonl");
const PUBLIC_BASE = path.join(REPO_ROOT, "public");
const OUT_DIR = path.join(REPO_ROOT, "data/ml-dataset");

const GROUPS = {
  FLATLAY_FULL: "01_flatlay_full",         // garmentFront + garmentBack ikisi de var
  FLATLAY_FRONT_ONLY: "02_flatlay_front_only", // sadece garmentFront
  NO_FLATLAY: "03_no_flatlay",             // hiç flat-lay yok
};

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
  } catch (e) {
    return false;
  }
}

function urlToFsPath(urlPath) {
  // image_url -> /products/lcwaikiki/lcw-xxx/garment_front.jpg style
  // Bizim için: row.additional_photos.garment_front gibi mutlak URL gelir,
  // pathname'i alıp public/ ile birleştir.
  try {
    const u = new URL(urlPath);
    return path.join(PUBLIC_BASE, u.pathname);
  } catch {
    // Belki zaten relative path
    return path.join(PUBLIC_BASE, urlPath.replace(/^\//, ""));
  }
}

const stats = {
  total: rows.length,
  by_group: {
    [GROUPS.FLATLAY_FULL]: 0,
    [GROUPS.FLATLAY_FRONT_ONLY]: 0,
    [GROUPS.NO_FLATLAY]: 0,
  },
  photos_linked: 0,
  photos_missing: 0,
};

const indexStream = fs.createWriteStream(path.join(OUT_DIR, "INDEX.jsonl"));

for (const row of rows) {
  const ap = row.additional_photos ?? {};
  const hasGF = !!ap.garment_front;
  const hasGB = !!ap.garment_back;

  let group;
  if (hasGF && hasGB) group = GROUPS.FLATLAY_FULL;
  else if (hasGF) group = GROUPS.FLATLAY_FRONT_ONLY;
  else group = GROUPS.NO_FLATLAY;

  const productDir = path.join(OUT_DIR, group, row.id);
  fs.mkdirSync(productDir, { recursive: true });

  // Her view tipi için sırasıyla link kur
  const wornFrontSrc = path.join(REPO_ROOT, row.image_path);
  const photoMap = {
    "worn_front.jpg": wornFrontSrc,
    "worn_back.jpg": ap.back ? urlToFsPath(ap.back) : null,
    "garment_front.jpg": ap.garment_front
      ? urlToFsPath(ap.garment_front)
      : null,
    "garment_back.jpg": ap.garment_back ? urlToFsPath(ap.garment_back) : null,
  };

  const linkedPhotos = [];
  for (const [filename, src] of Object.entries(photoMap)) {
    if (!src) continue;
    const dst = path.join(productDir, filename);
    if (link(src, dst)) {
      stats.photos_linked++;
      linkedPhotos.push(filename);
    } else {
      stats.photos_missing++;
    }
  }

  stats.by_group[group]++;

  // INDEX.jsonl satırı
  indexStream.write(
    JSON.stringify({
      id: row.id,
      group,
      class: row.class,
      category: row.category,
      gender: row.gender,
      name: row.name,
      photos: linkedPhotos,
      deeplink: row.deeplink,
      product_dir: path.relative(OUT_DIR, productDir).replace(/\\/g, "/"),
    }) + "\n",
  );
}

indexStream.end();

// Her grup için README oluştur
const groupDescriptions = {
  [GROUPS.FLATLAY_FULL]:
    "FLAT-LAY ÖN + ARKA — Ürünün hem önden hem arkadan giyilmemiş (flat-lay) fotoğrafı var. Her ürün klasöründe 4 görsel olabilir: worn_front.jpg, worn_back.jpg, garment_front.jpg, garment_back.jpg",
  [GROUPS.FLATLAY_FRONT_ONLY]:
    "SADECE ÖN FLAT-LAY — Sadece önden giyilmemiş (flat-lay) foto var. Arka için yalnızca giyilmiş görsel mevcut. Klasörde: worn_front.jpg, worn_back.jpg (varsa), garment_front.jpg",
  [GROUPS.NO_FLATLAY]:
    "FLAT-LAY YOK — Hiç giyilmemiş foto yok, sadece manken/model üzerinde foto var. Klasörde: worn_front.jpg, worn_back.jpg (varsa)",
};

for (const [groupKey, groupName] of Object.entries(GROUPS)) {
  const readme = path.join(OUT_DIR, groupName, "_README.txt");
  fs.writeFileSync(
    readme,
    `${groupName}\n` +
      `${"=".repeat(groupName.length)}\n\n` +
      `${groupDescriptions[groupName]}\n\n` +
      `Toplam ürün: ${stats.by_group[groupName]}\n\n` +
      `Her ürün kendi alt-klasöründe (LCW-xxx/). Klasör içindeki dosya isimleri\n` +
      `o görselin tipini belirtir. Bir ürünün tüm view'ları aynı klasörde.\n`,
  );
}

console.log(`\n═══ Photo Availability Folders ═══`);
console.log(`Mod:           ${copy ? "copy" : isWindows ? "hardlink" : "symlink"}`);
console.log(`Toplam ürün:   ${stats.total}`);
console.log(`Foto linkleri: ${stats.photos_linked}  (eksik: ${stats.photos_missing})`);
console.log(`\nGrup dağılımı:`);
for (const [name, count] of Object.entries(stats.by_group)) {
  console.log(`  ${name.padEnd(28)} ${count}`);
}
console.log(`\nÇıktı: ${path.relative(REPO_ROOT, OUT_DIR)}/`);
console.log(`İndex: ${path.relative(REPO_ROOT, OUT_DIR)}/INDEX.jsonl`);
console.log(`\nYapı:`);
console.log(`  data/ml-dataset/01_flatlay_full/{product_id}/{worn|garment}_{front|back}.jpg`);
console.log(`  data/ml-dataset/02_flatlay_front_only/{product_id}/...`);
console.log(`  data/ml-dataset/03_no_flatlay/{product_id}/...`);
