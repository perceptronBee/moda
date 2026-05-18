# MODA Fashion Dataset

LCWaikiki ürün feed'inden üretilmiş, model eğitimi için hazır görseller.

## Hızlı başlangıç

```bash
git clone https://github.com/perceptronBee/moda.git
cd moda
git checkout dataset/ml-export

# Klasör yapısını kur (hardlink, disk şişmez)
node scripts/build-photo-folders.mjs
```

## Klasör yapısı

Ürünler kıyafet türüne göre değil, **mevcut fotoğraf tipine** göre 3 ana gruba ayrıldı. Her ürünün kendi alt-klasörü var, içinde o ürün için var olan tüm fotoğraflar açıklayıcı isimlerle bulunur.

```
data/ml-dataset/
│
├── 01_flatlay_full/                ← 570 ürün
│   │   FLAT-LAY ÖN + ARKA mevcut
│   │   Hem giyilmiş hem giyilmemiş, hem ön hem arka
│   │
│   ├── LCW-4261962/
│   │   ├── worn_front.jpg          (model üzerinde, önden)
│   │   ├── worn_back.jpg           (model üzerinde, arkadan)
│   │   ├── garment_front.jpg       (flat-lay, önden)
│   │   └── garment_back.jpg        (flat-lay, arkadan)
│   └── LCW-xxx/...
│
├── 02_flatlay_front_only/          ← 222 ürün
│   │   SADECE ÖN FLAT-LAY mevcut
│   │   Ön için flat-lay var, arka için yalnızca giyilmiş
│   │
│   ├── LCW-yyy/
│   │   ├── worn_front.jpg
│   │   ├── worn_back.jpg           (varsa)
│   │   └── garment_front.jpg
│   └── ...
│
├── 03_no_flatlay/                  ← 307 ürün
│   │   FLAT-LAY YOK
│   │   Sadece giyilmiş foto var
│   │
│   ├── LCW-zzz/
│   │   ├── worn_front.jpg
│   │   └── worn_back.jpg           (varsa)
│   └── ...
│
└── INDEX.jsonl                      ← her ürünün hangi gruba düştüğü +
                                       hangi fotolara sahip olduğu meta dosya
```

Her grup klasöründe ayrıca `_README.txt` var, içeriği açıklar.

## Foto dosya isimleri (sabit)

| Dosya | Anlam |
|---|---|
| `worn_front.jpg` | Model üstünde, önden |
| `worn_back.jpg` | Model üstünde, arkadan |
| `garment_front.jpg` | Flat-lay (manken yok), önden |
| `garment_back.jpg` | Flat-lay (manken yok), arkadan |

Bir ürün klasöründe bu 4 dosyadan hangileri varsa o ürün için mevcut görsellerdir.

## Kullanım

### Yöntem A — Klasörler üzerinden

```python
from pathlib import Path
from PIL import Image

DATASET = Path("data/ml-dataset")

# Tüm "tam set" ürünleri (4 view'ı olanlar)
for product_dir in (DATASET / "01_flatlay_full").iterdir():
    if not product_dir.is_dir():
        continue
    product_id = product_dir.name  # "LCW-xxx"
    photos = {
        view: Image.open(product_dir / f"{view}.jpg")
        for view in ["worn_front", "worn_back", "garment_front", "garment_back"]
    }
    # photos ile çalış...
```

### Yöntem B — INDEX.jsonl üzerinden (filtre + meta)

```python
import json
from pathlib import Path

DATASET = Path("data/ml-dataset")
rows = [json.loads(l) for l in (DATASET / "INDEX.jsonl").open(encoding="utf-8")]

# Sadece flat-lay tam seti olanları al
full = [r for r in rows if r["group"] == "01_flatlay_full"]

# Kadın ürünler
women = [r for r in full if r["gender"] == "kadin"]

# Bir ürünün belirli view'ını yükle
from PIL import Image
sample = full[0]
front = Image.open(DATASET / sample["product_dir"] / "garment_front.jpg")
```

### INDEX.jsonl şeması (her satır)

```json
{
  "id": "LCW-3422865",
  "group": "01_flatlay_full",
  "class": "shoe",
  "category": "ayakkabi",
  "gender": "kadin",
  "name": "Kahverengi TABA Hakiki Deri Küt Burun ...",
  "photos": ["worn_front.jpg", "garment_front.jpg"],
  "deeplink": "https://www.lcw.com/...",
  "product_dir": "01_flatlay_full/LCW-3422865"
}
```

## Grup istatistikleri (1099 ürün)

| Grup | Adet | Foto tipleri |
|---|---:|---|
| `01_flatlay_full` | 570 | worn_front + worn_back + garment_front + garment_back |
| `02_flatlay_front_only` | 222 | worn_front + (worn_back) + garment_front |
| `03_no_flatlay` | 307 | worn_front + (worn_back) |

Toplam 3284 görsel linklenmiş (eksik: 0).

## Yeniden üretim

Feed güncellenirse veya farklı bir bölme yapmak istersen:

```bash
node scripts/export-ml-dataset.mjs        # JSONL'i yeniden üret
node scripts/build-photo-folders.mjs      # klasörleri yeniden kur
```

`build-photo-folders.mjs --copy` dersen hardlink yerine gerçek dosya kopyası alır (taşınabilir ama 2x disk).

## Bonus: kıyafet türü etiketi var (opsiyonel)

`INDEX.jsonl` içinde her ürünün `class` ve `category` alanları da var, istersen kullanırsın:
- `class` (14-class taxonomy): `shirt_top`, `outerwear`, `pants`, `shorts`, `skirt`, `dress_jumpsuit`, `shoe`, `scarf` (8 sınıfta veri var, 6 sınıf boş)
- `category` (5-class coarse): `ust-giyim`, `alt-giyim`, `dis-giyim`, `ayakkabi`

Ama foto-availability tabanlı asıl klasörler bu **photo-type** yapısıdır.

## Sorular

Klasör isimleri veya bölmeleme mantığı değişmesi gerekirse: `scripts/build-photo-folders.mjs` içindeki `GROUPS` ve gruplama mantığı tek yerde, kolay düzenlenir.
