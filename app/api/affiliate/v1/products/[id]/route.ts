import { NextResponse, type NextRequest } from "next/server";
import { loadAllFeeds } from "@/lib/affiliate/feedImporter";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!req.headers.get("x-publisher-key")) {
    return NextResponse.json(
      { error: "X-Publisher-Key gerekli" },
      { status: 401 },
    );
  }
  const { id } = await params;
  const product = loadAllFeeds().find((p) => p.id === id);
  if (!product) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(product);
}
