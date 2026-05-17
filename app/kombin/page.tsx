import { getProductById } from "@/lib/products";
import { KombinFlow } from "./KombinFlow";

// Server Component — lib/products burada import edilir, client bundle'a sızmaz.
export default async function KombinPage({
  searchParams,
}: {
  searchParams: Promise<{ baseProduct?: string }>;
}) {
  const sp = await searchParams;
  const baseProductId = sp.baseProduct;
  const baseProduct = baseProductId ? getProductById(baseProductId) : undefined;

  return (
    <KombinFlow
      baseProductId={baseProduct?.id}
      baseProductName={baseProduct?.name}
      baseProductImage={
        baseProduct?.photos?.front ?? baseProduct?.photos?.garmentFront
      }
    />
  );
}
