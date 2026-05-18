# ML Dataset — 14-class Fashion Taxonomy

LCWaikiki ürün feed'inden üretilmiş, arkadaşın taxonomy'sine eşlenmiş eğitim dataset'i.

## Çıktı dosyaları

| Dosya | İçerik |
|---|---|
| `ml-dataset.jsonl` | Line-delimited JSON — PyTorch / HF Datasets için ideal |
| `ml-dataset.csv` | Aynı veri, Excel / pandas için |
| `ml-dataset-unmatched.jsonl` | Sınıflanamayan ürünler (şu an boş) |
| `ml-dataset-stats.json` | Class dağılımı + cinsiyet breakdown |

## Şema (her satır)

```json
{
  "id": "LCW-3342496",
  "class": "shoe",
  "image_path": "public/products/lcwaikiki/lcw-3342496/front.jpg",
  "image_url": "https://moda-ruby.vercel.app/products/lcwaikiki/lcw-3342496/front.jpg",
  "name": "Siyah Sivri Burun Orta Kalın Topuklu Kadın Ayakkabı",
  "category": "ayakkabi",
  "gender": "kadin",
  "retailer": "lcwaikiki",
  "deeplink": "https://www.lcw.com/...",
  "classification_source": "type_default",
  "additional_photos": {
    "back": "...",
    "garment_front": "...",
    "garment_back": "..."
  }
}
```

## Class dağılımı (1099 satır)

| Class | Adet | Source dominant |
|---|---:|---|
| shirt_top | 394 | type_default |
| shoe | 247 | type_default (1:1 mapping) |
| pants | 183 | type_default |
| outerwear | 162 | keyword (mont/kaban/yelek/ceket/yağmurluk) |
| shorts | 45 | keyword (şort/bermuda) |
| skirt | 34 | keyword (etek) |
| dress_jumpsuit | 32 | keyword (elbise/tulum/salopet) |
| scarf | 2 | keyword |
| hat, headband, tie, tights, sock, bag_wallet | 0 | feed'de aksesuar yok |

## Önemli notlar

1. **6 class boş.** LCWaikiki feed'inde aksesuar yok (`aksesuar` coarse type 0 ürün). Bu sınıfların verisi için ayrı bir kaynak gerekir veya feed genişletilmeli.

2. **Class dengesizliği var.** shirt_top 394 ↔ shorts 45. Class weighting (`class_weight="balanced"`) veya weighted sampler kullan, yoksa model çoğunluk sınıfına bias yapar.

3. **`classification_source` field'ı:**
   - `keyword` (275 satır) — ürün adında Türkçe anahtar kelime eşleşti, **yüksek güven**
   - `type_default` (824 satır) — coarse kategori default'una düştü, **orta güven** (örn. ust-giyim → shirt_top)
   - Eğitimde sadece `keyword` olanlarla başlamak istersen filtreleyebilirsin.

4. **Foto path'leri 2 formatta:**
   - `image_path`: repo'daki dosya yolu (`public/products/...`) — offline çalışırken
   - `image_url`: production'daki URL — uzaktan stream'lerken

5. **`additional_photos`:** Bazı ürünlerin `back`, `garment_front` (flat-lay), `garment_back` fotoları var. Multi-view augmentation veya flat-lay vs on-model ayrımı için faydalı.

## Yeniden üretim

KEYWORD_RULES'a yeni regex eklersen veya feed güncellenirse:

```bash
node scripts/export-ml-dataset.mjs
```

Opsiyonel argüman:
```bash
node scripts/export-ml-dataset.mjs --base-url https://moda-ruby.vercel.app
```

## PyTorch Dataset örneği

```python
import json
from torch.utils.data import Dataset
from PIL import Image
from pathlib import Path

REPO = Path("/path/to/moda")
CLASSES = ["shirt_top", "outerwear", "pants", "shorts", "skirt",
           "dress_jumpsuit", "hat", "headband", "tie", "tights",
           "sock", "shoe", "bag_wallet", "scarf"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}

class MODAFashion(Dataset):
    def __init__(self, jsonl_path, transform=None, filter_keyword_only=False):
        with open(jsonl_path) as f:
            self.rows = [json.loads(l) for l in f]
        if filter_keyword_only:
            self.rows = [r for r in self.rows if r["classification_source"] == "keyword"]
        self.transform = transform

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        row = self.rows[i]
        img = Image.open(REPO / row["image_path"]).convert("RGB")
        if self.transform:
            img = self.transform(img)
        label = CLASS_TO_IDX[row["class"]]
        return img, label
```

## Sınıflandırma mantığı (script özeti)

1. **Türkçe keyword regex (sıra önemli, dar→geniş):**
   - tights → shorts → skirt → dress_jumpsuit → outerwear → accessories
   - İlk eşleşen kazanır
   - Turkish `ş ğ ü ı ç ö` için `\b` yerine `\p{L}` Unicode boundary kullanılıyor
2. **Coarse type default (yoksa):**
   - `ust-giyim → shirt_top`
   - `alt-giyim → pants`
   - `dis-giyim → outerwear`
   - `ayakkabi → shoe`
   - `aksesuar → null` (skip)

## Sınıflandırma doğruluğu (manuel sample audit)

- shoe: ~%100 (1:1 coarse mapping)
- shirt_top: ~%98 (tunik dahil, polarlı astar marjinal)
- pants: ~%97 (şortlar ayrıldı)
- outerwear: ~%97 (mont/kaban/yelek/ceket/yağmurluk/cardigan/polar/jean ceket yakalandı)
- shorts: ~%97 (Türkçe regex fix sonrası)
- skirt: ~%97 (mini/midi/maksi/kalem etek)
- dress_jumpsuit: ~%95 (elbise/tulum/salopet; tunik bilerek dışlandı)
