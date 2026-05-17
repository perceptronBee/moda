import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { RETAILERS } from "@/lib/affiliate/retailers";

const MAX_FEED_BYTES = 50 * 1024 * 1024;

// Prototype pollution koruması — __proto__, constructor gibi key'leri reddet
function isKnownRetailer(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(RETAILERS, slug);
}

/**
 * GET /api/affiliate/v1/feeds/{retailer}
 *
 * Perakendecinin ham XML feed'ini döner. Gerçek hayatta perakendeciler
 * bu feed'i kendi sunucularında host eder; biz simülasyonda kendi
 * data/feeds/ klasörümüzden serve ediyoruz.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ retailer: string }> },
) {
  const { retailer } = await params;

  // Prototype pollution + path traversal koruması
  if (
    typeof retailer !== "string" ||
    !/^[a-z0-9_-]+$/i.test(retailer) ||
    !isKnownRetailer(retailer)
  ) {
    return NextResponse.json(
      { error: `Bilinmeyen retailer` },
      { status: 404 },
    );
  }

  const filePath = path.join(
    process.cwd(),
    "data",
    "feeds",
    `${retailer}.xml`,
  );
  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: "Bu retailer için henüz feed yok" },
      { status: 404 },
    );
  }

  // Boyut kontrolü — devasa malicious feed event loop'u kitlemesin
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_FEED_BYTES) {
    return NextResponse.json(
      { error: "Feed dosyası boyut sınırını aşıyor" },
      { status: 500 },
    );
  }

  // Stream — büyük dosyada bile event loop bloklanmaz
  const nodeStream = createReadStream(filePath);
  // Node Readable → Web ReadableStream köprüsü
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) =>
        controller.enqueue(
          chunk instanceof Buffer ? new Uint8Array(chunk) : chunk,
        ),
      );
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(stat.size),
    },
  });
}
