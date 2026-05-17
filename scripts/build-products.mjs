// XML feed'leri tarayıp lib/products.generated.json üretir.
// `npm run dev` ve `npm run build` öncesi otomatik çalışır.
// Client component'lerden de import edilebilir, çünkü saf JSON.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FEEDS_DIR = path.join(ROOT, "data", "feeds");
const OUT_PATH = path.join(ROOT, "lib", "products.generated.json");

// Build-time XML parse'ında güvenlik — XXE / Billion Laughs koruması.
// CI/CD sunucusu hackathon feed'ini build ederken patlatılmasın.
const MAX_FEED_BYTES = 50 * 1024 * 1024;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  // External Entity processing kapalı — XXE/Billion Laughs vektörü
  processEntities: false,
  allowBooleanAttributes: false,
  commentPropName: "",
  isArray: (tag) => tag === "product",
});

const KNOWN_RETAILERS = new Set([
  "lcwaikiki",
  "defacto",
  "boyner",
  "koton",
]);

function priceFromNode(node) {
  if (node === undefined || node === null) return undefined;
  if (typeof node === "number") return node;
  if (typeof node === "object" && "#text" in node) return Number(node["#text"]);
  return Number(node);
}

function importFeed(filePath) {
  // Dosya boyut check — devasa malicious feed CI sunucusunu çökertmesin
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FEED_BYTES) {
    console.warn(`  ⚠ ${path.basename(filePath)} çok büyük (${stat.size}B), atlandı`);
    return [];
  }

  const xml = fs.readFileSync(filePath, "utf-8");

  // DOCTYPE bloğu reddet — XXE / entity bomb ana vektörü
  if (/<!DOCTYPE/i.test(xml.slice(0, 2048))) {
    console.warn(`  ⚠ ${path.basename(filePath)} DOCTYPE içeriyor, atlandı`);
    return [];
  }

  const data = parser.parse(xml);
  const feed = data.feed;
  if (!feed) return [];
  const retailer = feed["@_retailer"];
  // Prototype pollution koruması
  if (
    !retailer ||
    typeof retailer !== "string" ||
    !Object.prototype.hasOwnProperty.call(
      Object.fromEntries([...KNOWN_RETAILERS].map((k) => [k, true])),
      retailer,
    ) ||
    !KNOWN_RETAILERS.has(retailer)
  ) {
    console.warn(`  ⚠ Bilinmeyen retailer: ${retailer} (${filePath})`);
    return [];
  }
  const raw = feed.product ? (Array.isArray(feed.product) ? feed.product : [feed.product]) : [];

  return raw
    .filter((p) => p.stock !== false && p.stock !== "false")
    .map((p) => ({
      id: String(p.id),
      name: String(p.name),
      price: priceFromNode(p.price) ?? 0,
      oldPrice: priceFromNode(p.oldPrice),
      gender: p.gender,
      type: p.category,
      photos: p.photos
        ? {
            front: p.photos.front || "",
            back: p.photos.back || undefined,
            garmentFront: p.photos.garmentFront || undefined,
            garmentBack: p.photos.garmentBack || undefined,
          }
        : undefined,
      tone: p.tone || undefined,
      description: p.description || undefined,
      sizes: p.sizes
        ? String(p.sizes).split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      tag: p.tag || undefined,
      retailer,
      deeplink: p.deeplink || undefined,
    }))
    .filter((p) => !p.photos?.front || p.photos.front);
}

function main() {
  if (!fs.existsSync(FEEDS_DIR)) {
    console.log("data/feeds/ yok, mevcut products.generated.json korunuyor");
    return;
  }
  const files = fs
    .readdirSync(FEEDS_DIR)
    .filter((f) => f.endsWith(".xml"))
    .map((f) => path.join(FEEDS_DIR, f));

  if (files.length === 0) {
    console.log("data/feeds/ boş, mevcut products.generated.json korunuyor");
    return;
  }

  const all = files.flatMap((f) => {
    try {
      const products = importFeed(f);
      console.log(`  ${path.basename(f).padEnd(20)} ${products.length} ürün`);
      return products;
    } catch (err) {
      console.error(`  ✘ ${f} parse hatası: ${err.message}`);
      return [];
    }
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(all, null, 2));
  console.log(`\n${all.length} ürün → ${path.relative(ROOT, OUT_PATH)}`);
}

main();
