import { PRODUCTS, type Product } from "./products";

export type KombinSuggestion = {
  id: string;
  title: string;
  description: string;
  items: Product[];
};

/**
 * Kombin önerisi — şimdilik mock.
 *
 * Gerçek AI bağlandığında imza aynı kalacak, sadece içerik gerçek model
 * cevabıyla dolacak.
 *
 * Strateji: gerçek katalogtaki foto'lu ürünlerden 3 farklı kombin oluştur.
 * Try-on adımı için ürünlerin `photos.front` URL'leri gerekli.
 */
export async function fetchKombinSuggestions(opts: {
  baseProductId?: string;
  userPhotoDataUrl?: string;
}): Promise<KombinSuggestion[]> {
  await delay(1400);

  const base = opts.baseProductId
    ? PRODUCTS.find((p) => p.id === opts.baseProductId)
    : undefined;

  // Foto'su olan ürünler — try-on için zorunlu
  const withPhoto = PRODUCTS.filter((p) => p.photos?.front);

  function pickByType(
    type: Product["type"],
    gender?: Product["gender"],
    excludeId?: string,
  ): Product | undefined {
    const pool = withPhoto.filter(
      (p) =>
        p.type === type &&
        (!gender || p.gender === gender) &&
        p.id !== excludeId,
    );
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const gender = base?.gender;

  // 3 farklı kombin: günlük / akşam / statement
  function build(themeId: string, title: string, desc: string): KombinSuggestion {
    const items: Product[] = [];
    if (base) items.push(base);
    const ust = pickByType("ust-giyim", gender, base?.id);
    const alt = pickByType("alt-giyim", gender, base?.id);
    const ayk = pickByType("ayakkabi", gender, base?.id);
    if (ust && ust.type !== base?.type) items.push(ust);
    if (alt && alt.type !== base?.type) items.push(alt);
    if (ayk && ayk.type !== base?.type) items.push(ayk);
    return {
      id: themeId,
      title,
      description: desc,
      items: items.slice(0, 4),
    };
  }

  return [
    build("k1", "MİNİMAL · GÜNDÜZ", "Sade, hafta içi için rahat kombin."),
    build("k2", "KATMANLI · AKŞAM", "Soğuk akşamlar için katmanlı bir yaklaşım."),
    build("k3", "STATEMENT", "Dikkat çekici parçalarla cesur bir kombin."),
  ];
}

/**
 * @deprecated KombinFlow artık /api/ai/try-on endpoint'ini direkt çağırıyor.
 * Geriye uyumluluk için bırakıldı; sadece dev mock olarak kullanıcının
 * fotoğrafını "sonuç" diye geri döner.
 */
export async function generateTryOnImage(opts: {
  userPhotoDataUrl: string;
  outfitId: string;
}): Promise<{ resultUrl: string }> {
  await delay(2200);
  return { resultUrl: opts.userPhotoDataUrl };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
