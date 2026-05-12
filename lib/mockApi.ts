import { PRODUCTS, type Product } from "./products";

export type KombinSuggestion = {
  id: string;
  title: string;
  description: string;
  items: Product[];
};

// Fake combination suggestions. Backend gelince burası gerçek API call'a dönecek.
export async function fetchKombinSuggestions(opts: {
  baseProductId?: string;
  // userPhotoDataUrl is provided but not used in mock
  userPhotoDataUrl?: string;
}): Promise<KombinSuggestion[]> {
  await delay(1400);

  const base = opts.baseProductId
    ? PRODUCTS.find((p) => p.id === opts.baseProductId)
    : undefined;

  // build 3 mock outfits
  const pick = (ids: string[]) =>
    ids.map((id) => PRODUCTS.find((p) => p.id === id)!).filter(Boolean);

  const suggestions: KombinSuggestion[] = [
    {
      id: "k1",
      title: "MİNİMAL · GÜNDÜZ",
      description: "Sade, akıcı, hafta içi için kolay.",
      items: pick([base?.id ?? "02", "03", "07"]),
    },
    {
      id: "k2",
      title: "KATMANLI · AKŞAM",
      description: "Üst üste katman, soğuk akşamlar için.",
      items: pick([base?.id ?? "01", "04", "05", "08"]),
    },
    {
      id: "k3",
      title: "STATEMENT",
      description: "Cesur, dikkat çekici parçalar.",
      items: pick([base?.id ?? "06", "12", "10", "08"]),
    },
  ];

  return suggestions.map((s) => ({
    ...s,
    items: Array.from(new Map(s.items.map((i) => [i.id, i])).values()),
  }));
}

export async function generateTryOnImage(opts: {
  userPhotoDataUrl: string;
  outfitId: string;
}): Promise<{ resultUrl: string }> {
  await delay(2200);
  // Şimdilik kullanıcının kendi fotoğrafını "üretilmiş" gibi gösteriyoruz.
  return { resultUrl: opts.userPhotoDataUrl };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
