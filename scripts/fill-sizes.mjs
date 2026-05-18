// Bir kerelik script — data/feeds/*.xml içindeki <sizes></sizes> elementlerini
// kategori + cinsiyete göre doldurur. Mock affiliate feed simülasyonunu güçlendirir.
//
// Kullanım:  node scripts/fill-sizes.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEEDS_DIR = path.resolve(__dirname, "..", "data", "feeds");

// Kategori + cinsiyet → beden listesi
function sizesFor(category, gender) {
  const cat = (category || "").toLowerCase();
  const g = (gender || "").toLowerCase();

  // Ayakkabı — numerik
  if (cat === "ayakkabi") {
    if (g === "erkek") return ["40", "41", "42", "43", "44", "45"];
    if (g === "kadin") return ["36", "37", "38", "39", "40", "41"];
    return ["36", "37", "38", "39", "40", "41", "42", "43"];
  }

  // Aksesuar — tek beden / standart
  if (cat === "aksesuar") return ["Standart"];

  // Tüm giyim (üst, alt, dış) — XS..XXL
  return ["XS", "S", "M", "L", "XL", "XXL"];
}

// XML'i regex ile parse etmek tehlikeli ama burada controlled bir input
// (kendi ürettiğimiz feed) — hızlı ve yeterli.
function fillSizesInXml(xml) {
  let count = 0;
  const updated = xml.replace(
    /<product>([\s\S]*?)<\/product>/g,
    (match, body) => {
      // Boş sizes var mı?
      if (!/<sizes>\s*<\/sizes>/.test(body)) return match;

      const catMatch = body.match(/<category>([^<]+)<\/category>/);
      const genMatch = body.match(/<gender>([^<]+)<\/gender>/);
      if (!catMatch) return match;

      const sizes = sizesFor(catMatch[1], genMatch?.[1]);
      // Her ürüne tüm bedenleri vermek yerine random subset (gerçekçilik için)
      // En az 3, en fazla hepsi — deterministik (id hash ile)
      const idMatch = body.match(/<id>([^<]+)<\/id>/);
      const seed = (idMatch?.[1] || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const dropCount = seed % Math.max(1, Math.floor(sizes.length / 2));
      const startOffset = seed % Math.max(1, sizes.length - dropCount);
      const chosen = sizes.filter(
        (_, i) => i >= startOffset && i < startOffset + (sizes.length - dropCount),
      );
      const final = chosen.length > 0 ? chosen : sizes;

      count++;
      return match.replace("<sizes></sizes>", `<sizes>${final.join(",")}</sizes>`);
    },
  );
  return { xml: updated, count };
}

function processFeed(file) {
  const full = path.join(FEEDS_DIR, file);
  const raw = fs.readFileSync(full, "utf8");
  const { xml, count } = fillSizesInXml(raw);
  if (count === 0) {
    console.log(`  ${file}: dolu boş <sizes> bulunamadı, atlandı`);
    return;
  }
  fs.writeFileSync(full, xml, "utf8");
  console.log(`  ${file}: ${count} ürüne beden eklendi`);
}

const feeds = fs
  .readdirSync(FEEDS_DIR)
  .filter((f) => f.endsWith(".xml"));

console.log(`${feeds.length} feed bulundu, işleniyor:`);
feeds.forEach(processFeed);
console.log("Bitti. npm run dev predev'i otomatik rebuild eder.");
