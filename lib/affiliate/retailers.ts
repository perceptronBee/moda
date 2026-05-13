// Mock affiliate ağındaki perakendeci tanımları.
// Demo'da: her perakendeciden XML feed çekiyormuş gibi yapıyoruz.

export type RetailerSlug =
  | "lcwaikiki"
  | "defacto"
  | "boyner"
  | "koton";

export type Retailer = {
  slug: RetailerSlug;
  name: string;
  domain: string;
  commission: number; // 0.05 = %5
  logo?: string;
};

export const RETAILERS: Record<RetailerSlug, Retailer> = {
  lcwaikiki: {
    slug: "lcwaikiki",
    name: "LC Waikiki",
    domain: "lcwaikiki.com",
    commission: 0.08,
  },
  defacto: {
    slug: "defacto",
    name: "DeFacto",
    domain: "defacto.com.tr",
    commission: 0.07,
  },
  boyner: {
    slug: "boyner",
    name: "Boyner",
    domain: "boyner.com.tr",
    commission: 0.10,
  },
  koton: {
    slug: "koton",
    name: "Koton",
    domain: "koton.com",
    commission: 0.08,
  },
};
