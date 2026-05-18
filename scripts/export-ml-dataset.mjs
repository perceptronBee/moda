#!/usr/bin/env node
/**
 * ML Dataset Export — fashion classification (14-class taxonomy)
 *
 * Bizim 5-coarse kategorimizi (ust-giyim, alt-giyim, dis-giyim, ayakkabi,
 * aksesuar) arkadaşın 14-class fine taxonomy'sine eşleyip eğitim için
 * hazır dataset üretir.
 *
 * Çıktılar:
 *   data/ml-dataset.jsonl  — line-delimited JSON (PyTorch/HF Dataset için)
 *   data/ml-dataset.csv    — Excel/pandas için
 *   data/ml-dataset-unmatched.jsonl — sınıflanamayan ürünler (manuel inceleme)
 *   data/ml-dataset-stats.json — class dağılımı + source breakdown
 *
 * Kullanım:
 *   node scripts/export-ml-dataset.mjs
 *   node scripts/export-ml-dataset.mjs --base-url https://moda-ruby.vercel.app
 *
 * Class mapping mantığı:
 *   1) Türkçe keyword regex (dar→geniş sıralı, ilk eşleşen kazanır)
 *   2) Yoksa coarse type default'u (aksesuar hariç)
 *   3) Aksesuar match etmezse skip + unmatched dosyasına yaz
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
}
const BASE_URL = args.get("base-url") ?? "https://moda-ruby.vercel.app";

const SRC = path.join(REPO_ROOT, "lib/products.generated.json");
const OUT_DIR = path.join(REPO_ROOT, "data");
const OUT_JSONL = path.join(OUT_DIR, "ml-dataset.jsonl");
const OUT_CSV = path.join(OUT_DIR, "ml-dataset.csv");
const OUT_UNMATCHED = path.join(OUT_DIR, "ml-dataset-unmatched.jsonl");
const OUT_STATS = path.join(OUT_DIR, "ml-dataset-stats.json");

// 14-class taxonomy (arkadaşın listesi — orijinal etiketleriyle)
const CLASSES = [
  "shirt_top",
  "outerwear",
  "pants",
  "shorts",
  "skirt",
  "dress_jumpsuit",
  "hat",
  "headband",          // headband, head covering, hair accessory
  "tie",
  "tights",            // tights, stockings
  "sock",
  "shoe",
  "bag_wallet",        // bag, wallet
  "scarf",
];

// ─────────────────────────────────────────────────────────────────────────
// Türkçe keyword sözlüğü — SIRA ÖNEMLİ: dar/spesifik match önce, geniş sonra
//
// ⚠ Turkish karakter sorunu: JS regex'inde `\b` sadece [A-Za-z0-9_] sınırı
// tanır. Türkçe `ş ğ ü ı ç ö İ Ğ ...` harfleri \w değildir → `\bşort\b`
// "Erkek Şort"u YAKALAYAMAZ. Bu yüzden Unicode-aware word boundary kullan:
//   önce: ya string başı ya da harf-olmayan karakter
//   sonra: ya string sonu ya da harf-olmayan karakter
// `u` (unicode) flag'i şart, `\p{L}` ile tüm harfleri yakalar.
// ─────────────────────────────────────────────────────────────────────────
const TB_PRE = "(?<![\\p{L}])";
const TB_POST = "(?![\\p{L}])";
function w(pattern) {
  return new RegExp(`${TB_PRE}(?:${pattern})${TB_POST}`, "iu");
}

const KEYWORD_RULES = [
  // ── 1) tights (önce, çünkü "çorap" geniş match'ler tights'ı da yakalar) ──
  { match: w("külotlu\\s*çorap|tayt|stocking|diz\\s*üstü\\s*çorap|file\\s*çorap"), class: "tights" },

  // ── 2) alt-giyim alt sınıfları ──
  { match: w("şort|shorts?|bermuda|kısa\\s*pantolon|capri|şortu"), class: "shorts" },
  { match: w("etek|mini\\s*etek|midi\\s*etek|maksi\\s*etek|kalem\\s*etek"), class: "skirt" },

  // ── 3) ust-giyim alt sınıfları (tam vücut) ──
  //    NOT: "tunik" bilerek dahil DEĞİL — tunik uzun bir üst, shirt_top
  { match: w("elbise|tulum|jumpsuit|salopet|tulumcuk"), class: "dress_jumpsuit" },

  // ── 4) OUTERWEAR (önce kontrol, çünkü çoğu yanlışlıkla ust-giyim coarse'da) ──
  //    Friend: "jackets, coats, vests, cardigans"
  //    fermuarlı sweatshirt = zip-up jacket → outerwear
  //    kapüşonlu sweatshirt (pullover) ust-giyim KALABILIR — sadece zip-up'ı yakala
  {
    match: w(
      "mont|kaban|palto|trench|puffer|şişme\\s*yelek|şişme\\s*mont|yelek|" +
        "hırka|cardigan|polar|kaşe\\s*mont|kaşe\\s*ceket|deri\\s*ceket|" +
        "jean\\s*ceket|denim\\s*ceket|spor\\s*ceket|blazer|biker|parka|" +
        "fermuarlı\\s*sweatshirt|fermuarlı\\s*kapüşonlu|zip\\s*hoodie|" +
        "rüzgarlık|yağmurluk|kürk",
    ),
    class: "outerwear",
  },
  // Tek başına "ceket" — yelek/hırka değil ise outerwear
  { match: w("ceket"), class: "outerwear" },

  // ── 5) aksesuar alt sınıfları ──
  { match: w("çanta|cüzdan|portföy|kartlık|valiz|bel\\s*çantası|sırt\\s*çantası|el\\s*çantası|omuz\\s*çantası|clutch|backpack"), class: "bag_wallet" },
  { match: w("şapka|bere|kep|kasket|fötr|panama|beanie|baret|hat|cap"), class: "hat" },
  { match: w("bandana|saç\\s*bandı|saç\\s*tokası|saç\\s*aksesuar|taç|toka|headband"), class: "headband" },
  { match: w("kravat|papyon|bow\\s*tie|bowtie"), class: "tie" },
  { match: w("atkı|fular|şal|eşarp|scarf"), class: "scarf" },
  { match: w("çorap|sock|patik"), class: "sock" },
];

// Coarse type → default fine class (keyword match olmadığında)
const DEFAULT_BY_TYPE = {
  "ust-giyim": "shirt_top",
  "alt-giyim": "pants",
  "dis-giyim": "outerwear",
  "ayakkabi": "shoe",
  "aksesuar": null,        // güvenli default yok — match yoksa skip
};

// ─────────────────────────────────────────────────────────────────────────
function classifyProduct(product) {
  const name = product.name ?? "";

  // 1) Keyword rule (sıra önemli)
  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(name)) {
      return {
        class: rule.class,
        source: "keyword",
        matched: rule.match.source,
      };
    }
  }

  // 2) Coarse default
  const def = DEFAULT_BY_TYPE[product.type];
  if (def) {
    return { class: def, source: "type_default", matched: product.type };
  }

  // 3) Sınıflanamadı (genellikle aksesuar + tanımsız parça)
  return { class: null, source: "unmatched", matched: product.type };
}

function escapeCsv(s) {
  if (s === null || s === undefined) return "";
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// ─────────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Kaynak bulunamadı: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const products = JSON.parse(fs.readFileSync(SRC, "utf-8"));

  const jsonlStream = fs.createWriteStream(OUT_JSONL);
  const csvStream = fs.createWriteStream(OUT_CSV);
  const unmatchedStream = fs.createWriteStream(OUT_UNMATCHED);

  // CSV header
  csvStream.write(
    [
      "id",
      "class",
      "image_path",
      "image_url",
      "name",
      "category",
      "gender",
      "retailer",
      "deeplink",
      "classification_source",
    ].join(",") + "\n",
  );

  const stats = {
    base_url: BASE_URL,
    generated_at: new Date().toISOString(),
    taxonomy: CLASSES,
    total: 0,
    written: 0,
    skipped_no_photo: 0,
    skipped_no_class: 0,
    by_class: Object.fromEntries(CLASSES.map((c) => [c, 0])),
    by_source: { keyword: 0, type_default: 0, unmatched: 0 },
    by_gender: {},
    by_coarse_type: {},
  };

  for (const p of products) {
    stats.total++;
    stats.by_coarse_type[p.type] = (stats.by_coarse_type[p.type] ?? 0) + 1;

    const photo = p.photos?.front;
    if (!photo) {
      stats.skipped_no_photo++;
      continue;
    }

    const cls = classifyProduct(p);
    if (!cls.class) {
      stats.skipped_no_class++;
      stats.by_source.unmatched++;
      unmatchedStream.write(
        JSON.stringify({
          id: p.id,
          name: p.name,
          category: p.type,
          gender: p.gender,
        }) + "\n",
      );
      continue;
    }

    // Relative image path (repo'da public/ altında dosya var)
    const image_path = `public${photo}`;
    const image_url = `${BASE_URL}${photo}`;

    const row = {
      id: p.id,
      class: cls.class,
      image_path,
      image_url,
      name: p.name,
      category: p.type,
      gender: p.gender,
      retailer: p.retailer,
      deeplink: p.deeplink,
      classification_source: cls.source,
      // Bonus: arkadaş çoklu görsel kullanmak isterse
      additional_photos: {
        back: p.photos?.back ? `${BASE_URL}${p.photos.back}` : null,
        garment_front: p.photos?.garmentFront
          ? `${BASE_URL}${p.photos.garmentFront}`
          : null,
        garment_back: p.photos?.garmentBack
          ? `${BASE_URL}${p.photos.garmentBack}`
          : null,
      },
    };

    jsonlStream.write(JSON.stringify(row) + "\n");
    csvStream.write(
      [
        row.id,
        row.class,
        row.image_path,
        row.image_url,
        row.name,
        row.category,
        row.gender,
        row.retailer,
        row.deeplink,
        row.classification_source,
      ]
        .map(escapeCsv)
        .join(",") + "\n",
    );

    stats.written++;
    stats.by_class[cls.class]++;
    stats.by_source[cls.source]++;
    stats.by_gender[p.gender] = (stats.by_gender[p.gender] ?? 0) + 1;
  }

  jsonlStream.end();
  csvStream.end();
  unmatchedStream.end();
  fs.writeFileSync(OUT_STATS, JSON.stringify(stats, null, 2));

  // ─── Konsol özeti ───
  console.log("\n═══ ML Dataset Export ═══");
  console.log(`Toplam ürün:            ${stats.total}`);
  console.log(`Yazılan satır:          ${stats.written}`);
  console.log(`Atlandı (foto yok):     ${stats.skipped_no_photo}`);
  console.log(`Atlandı (sınıflanamadı):${stats.skipped_no_class}`);

  console.log("\n── Class dağılımı ──");
  const sortedClasses = Object.entries(stats.by_class).sort(
    (a, b) => b[1] - a[1],
  );
  for (const [cls, count] of sortedClasses) {
    const bar = "█".repeat(Math.min(40, Math.round(count / 20)));
    console.log(`  ${cls.padEnd(18)} ${String(count).padStart(5)}  ${bar}`);
  }

  console.log("\n── Source breakdown ──");
  for (const [src, count] of Object.entries(stats.by_source)) {
    console.log(`  ${src.padEnd(15)} ${count}`);
  }

  console.log("\n── Coarse type dağılımı (kaynak) ──");
  for (const [t, count] of Object.entries(stats.by_coarse_type)) {
    console.log(`  ${t.padEnd(15)} ${count}`);
  }

  console.log("\n── Cinsiyet ──");
  for (const [g, count] of Object.entries(stats.by_gender)) {
    console.log(`  ${g.padEnd(15)} ${count}`);
  }

  console.log("\n── Çıktılar ──");
  console.log(`  ${path.relative(REPO_ROOT, OUT_JSONL)}`);
  console.log(`  ${path.relative(REPO_ROOT, OUT_CSV)}`);
  console.log(`  ${path.relative(REPO_ROOT, OUT_UNMATCHED)}`);
  console.log(`  ${path.relative(REPO_ROOT, OUT_STATS)}`);

  if (stats.skipped_no_class > 0) {
    console.log(
      `\n⚠ ${stats.skipped_no_class} ürün sınıflanamadı — ml-dataset-unmatched.jsonl içinde.`,
    );
    console.log("  Gerekirse KEYWORD_RULES'a yeni eşleşme ekle ve yeniden çalıştır.");
  }
}

main();
