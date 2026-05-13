import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { Product, Gender, ProductType } from "@/lib/products";
import { RETAILERS, type RetailerSlug } from "./retailers";

type XmlPhotos = {
  front?: string;
  back?: string;
  garmentFront?: string;
  garmentBack?: string;
};
type XmlPriceNode = number | { "#text": number };
type XmlProductRaw = {
  id: string;
  name: string;
  price: XmlPriceNode;
  oldPrice?: XmlPriceNode;
  gender: Gender;
  category: ProductType;
  description?: string;
  sizes?: string;
  photos?: XmlPhotos;
  deeplink?: string;
  stock?: boolean | string;
  tag?: string;
};
type XmlFeed = {
  feed: {
    "@_retailer"?: string;
    product?: XmlProductRaw | XmlProductRaw[];
  };
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  // Tek <product> bile dizi olarak gelsin diye:
  isArray: (tag) => tag === "product",
});

function priceFromNode(node: XmlPriceNode | undefined): number | undefined {
  if (node === undefined) return undefined;
  if (typeof node === "number") return node;
  return Number(node["#text"]);
}

function importFeed(filePath: string): Product[] {
  const xml = fs.readFileSync(filePath, "utf-8");
  const data = parser.parse(xml) as XmlFeed;
  const feed = data.feed;
  const retailerAttr = feed["@_retailer"] as RetailerSlug | undefined;
  if (!retailerAttr || !RETAILERS[retailerAttr]) {
    console.warn(`[feed] Bilinmeyen retailer: ${retailerAttr}`);
    return [];
  }
  const retailer = RETAILERS[retailerAttr];
  const rawProducts: XmlProductRaw[] = feed.product
    ? Array.isArray(feed.product)
      ? feed.product
      : [feed.product]
    : [];

  return rawProducts
    .filter((p) => {
      const stock = p.stock;
      if (stock === false || stock === "false") return false;
      return true;
    })
    .map<Product>((p) => {
      const sizes = p.sizes
        ? String(p.sizes)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      return {
        id: String(p.id),
        name: String(p.name),
        price: priceFromNode(p.price) ?? 0,
        oldPrice: priceFromNode(p.oldPrice),
        gender: p.gender,
        type: p.category,
        photos: p.photos
          ? {
              front: p.photos.front ?? "",
              back: p.photos.back,
              garmentFront: p.photos.garmentFront,
              garmentBack: p.photos.garmentBack,
            }
          : undefined,
        description: p.description,
        sizes,
        tag: p.tag,
        retailer: retailer.slug,
        deeplink: p.deeplink,
      };
    });
}

/** Tüm /data/feeds/*.xml dosyalarını yükler. Build/dev sırasında bir kez okunur. */
let cached: Product[] | null = null;
export function loadAllFeeds(): Product[] {
  if (cached) return cached;
  const feedsDir = path.join(process.cwd(), "data", "feeds");
  if (!fs.existsSync(feedsDir)) {
    cached = [];
    return cached;
  }
  const files = fs
    .readdirSync(feedsDir)
    .filter((f) => f.endsWith(".xml"))
    .map((f) => path.join(feedsDir, f));

  const all = files.flatMap((f) => {
    try {
      return importFeed(f);
    } catch (err) {
      console.error(`[feed] ${f} parse hatası:`, err);
      return [];
    }
  });
  cached = all;
  return cached;
}
