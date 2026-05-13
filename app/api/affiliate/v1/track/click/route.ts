import { NextResponse, type NextRequest } from "next/server";
import { loadAllFeeds } from "@/lib/affiliate/feedImporter";
import { RETAILERS } from "@/lib/affiliate/retailers";

/**
 * POST /api/affiliate/v1/track/click
 *
 * Body: { productId, publisherKey, userId? }
 *
 * Publisher (örn. bizim site) ürün linkine tıklandığında bu endpoint'i çağırır.
 * Network burada:
 *   1. Click'i kaydeder (audit)
 *   2. Publisher'a kazanılacak komisyonu hesaplar
 *   3. Retailer'a yönlendirme URL'ini döner (genellikle imzalı bir tracking link)
 *
 * Demo'da: console'a log atar, hesaplanmış komisyonu cevapta döner.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    productId?: string;
    publisherKey?: string;
    userId?: string;
  } | null;

  if (!body?.productId || !body?.publisherKey) {
    return NextResponse.json(
      { error: "productId ve publisherKey zorunlu" },
      { status: 400 },
    );
  }

  const product = loadAllFeeds().find((p) => p.id === body.productId);
  if (!product || !product.retailer || !product.deeplink) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }

  const retailer = RETAILERS[product.retailer];
  const estimatedCommission = product.price * retailer.commission;
  const clickId = `clk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Gerçek hayatta DB'ye yaz:
  console.log("[affiliate/click]", {
    clickId,
    productId: product.id,
    retailer: retailer.slug,
    publisherKey: body.publisherKey.slice(0, 8) + "…",
    userId: body.userId,
    price: product.price,
    commission: estimatedCommission,
    at: new Date().toISOString(),
  });

  return NextResponse.json({
    clickId,
    redirectUrl: product.deeplink,
    estimatedCommission: {
      amount: Math.round(estimatedCommission * 100) / 100,
      currency: "TRY",
      rate: retailer.commission,
    },
  });
}
