export type Gender = "kadin" | "erkek" | "cocuk";
export type ProductType =
  | "ust-giyim"
  | "alt-giyim"
  | "dis-giyim"
  | "ayakkabi"
  | "aksesuar";

export type Product = {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  gender: Gender;
  type: ProductType;
  tone: string;
  tag?: string;
  description?: string;
  sizes?: string[];
};

export const MAIN_NAV: { slug: Gender; label: string }[] = [
  { slug: "kadin", label: "Kadın" },
  { slug: "erkek", label: "Erkek" },
  { slug: "cocuk", label: "Çocuk" },
];

export const TYPE_LABELS: Record<ProductType, string> = {
  "ust-giyim": "Üst Giyim",
  "alt-giyim": "Alt Giyim",
  "dis-giyim": "Dış Giyim",
  ayakkabi: "Ayakkabı",
  aksesuar: "Aksesuar",
};

export const PRODUCTS: Product[] = [
  {
    id: "01",
    name: "Oversize Keten Gömlek",
    price: 749,
    oldPrice: 999,
    gender: "kadin",
    type: "ust-giyim",
    tone: "#e8e0d4",
    tag: "İndirim",
    description: "Yumuşak keten dokuma. Düşük omuz, oversize kalıp.",
    sizes: ["XS", "S", "M", "L", "XL"],
  },
  {
    id: "02",
    name: "Basic Beyaz T-Shirt",
    price: 199,
    gender: "kadin",
    type: "ust-giyim",
    tone: "#f5f3ee",
    description: "Ağır gramajlı pamuk. Klasik kesim.",
    sizes: ["XS", "S", "M", "L"],
  },
  {
    id: "03",
    name: "Geniş Paça Pantolon",
    price: 599,
    gender: "kadin",
    type: "alt-giyim",
    tone: "#3a342a",
    description: "Yün karışım, yüksek bel.",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "04",
    name: "Vintage Mom Jean",
    price: 549,
    gender: "kadin",
    type: "alt-giyim",
    tone: "#5b6e87",
    tag: "Yeni",
    description: "Yıkamalı denim, yüksek bel.",
    sizes: ["28", "30", "32", "34"],
  },
  {
    id: "05",
    name: "Uzun Yün Palto",
    price: 1899,
    gender: "kadin",
    type: "dis-giyim",
    tone: "#1f1a15",
    description: "%100 yün, oversize silüet.",
    sizes: ["S", "M", "L"],
  },
  {
    id: "06",
    name: "Pililı Midi Etek",
    price: 449,
    gender: "kadin",
    type: "alt-giyim",
    tone: "#2c2a2e",
    tag: "Yeni",
    description: "Akıcı kumaş, ince pililer, midi boy.",
    sizes: ["XS", "S", "M", "L"],
  },
  // Erkek
  {
    id: "07",
    name: "Slim Fit Oxford Gömlek",
    price: 449,
    gender: "erkek",
    type: "ust-giyim",
    tone: "#dfe4ea",
    description: "%100 pamuk, slim fit kesim.",
    sizes: ["S", "M", "L", "XL", "XXL"],
  },
  {
    id: "08",
    name: "Chino Pantolon",
    price: 549,
    gender: "erkek",
    type: "alt-giyim",
    tone: "#6b5d47",
    description: "Stretch dokuma, modern fit.",
    sizes: ["30", "32", "34", "36", "38"],
  },
  {
    id: "09",
    name: "Yün Karışım Mont",
    price: 1499,
    gender: "erkek",
    type: "dis-giyim",
    tone: "#23272d",
    tag: "Az kaldı",
    description: "Soğuk hava için sıcak tutan yün karışım.",
    sizes: ["M", "L", "XL"],
  },
  {
    id: "10",
    name: "Deri Sneaker",
    price: 899,
    gender: "erkek",
    type: "ayakkabi",
    tone: "#f0eee9",
    description: "Hakiki deri üst yüz.",
    sizes: ["40", "41", "42", "43", "44", "45"],
  },
  {
    id: "11",
    name: "Klasik T-Shirt",
    price: 179,
    oldPrice: 249,
    gender: "erkek",
    type: "ust-giyim",
    tone: "#2b2b2b",
    tag: "İndirim",
    description: "Yumuşak pamuk, regular fit.",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "12",
    name: "Deri Kemer",
    price: 299,
    gender: "erkek",
    type: "aksesuar",
    tone: "#3d2c20",
    description: "Hakiki deri, klasik toka.",
  },
  // Çocuk
  {
    id: "13",
    name: "Renkli Sweatshirt",
    price: 249,
    gender: "cocuk",
    type: "ust-giyim",
    tone: "#e8bfb5",
    tag: "Yeni",
    description: "Pamuklu, içi yumuşak.",
    sizes: ["4-5", "6-7", "8-9", "10-11"],
  },
  {
    id: "14",
    name: "Eşofman Altı",
    price: 199,
    gender: "cocuk",
    type: "alt-giyim",
    tone: "#3f4756",
    description: "Rahat kesim, lastikli bel.",
    sizes: ["4-5", "6-7", "8-9"],
  },
  {
    id: "15",
    name: "Spor Ayakkabı",
    price: 399,
    gender: "cocuk",
    type: "ayakkabi",
    tone: "#f5e5cf",
    description: "Cırt cırtlı, hafif taban.",
    sizes: ["28", "30", "32", "34"],
  },
  {
    id: "16",
    name: "Polo Yaka T-Shirt",
    price: 169,
    gender: "cocuk",
    type: "ust-giyim",
    tone: "#5b8a72",
    description: "Pamuklu, nefes alan dokuma.",
    sizes: ["4-5", "6-7", "8-9", "10-11"],
  },
];

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductsByGender(gender: Gender): Product[] {
  return PRODUCTS.filter((p) => p.gender === gender);
}

export function getProductsByGenderAndType(
  gender: Gender,
  type?: ProductType | "tumu",
): Product[] {
  const base = PRODUCTS.filter((p) => p.gender === gender);
  if (!type || type === "tumu") return base;
  return base.filter((p) => p.type === type);
}
