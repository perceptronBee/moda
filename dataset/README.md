# MODA Fashion Dataset

LCWaikiki ürün feed'inden üretilmiş, **giyilmiş (worn)** fotoğraflarla class-based eğitim dataset'i. Flat-lay (giyilmemiş) fotolar dataset'e dahil edilmez.

## Hızlı başlangıç

```bash
git checkout dataset-only
node scripts/build-imagefolder.mjs
```

Çıktı: `data/ml-dataset/` altında her class kendi klasöründe, içinde o sınıfa ait worn fotolar.

## Klasör yapısı (ImageFolder uyumlu)

```
data/ml-dataset/
├── shirt_top/                ← 781 foto
│   ├── LCW-3422865_front.jpg
│   ├── LCW-3422865_back.jpg   (varsa)
│   ├── LCW-xxxxxxx_front.jpg
│   └── ...
├── outerwear/                ← 320 foto
├── pants/                    ← 354 foto
├── shorts/                   ← 86 foto
├── skirt/                    ← 66 foto
├── dress_jumpsuit/           ← 64 foto
└── shoe/                     ← 251 foto
```

**Boş class'lar yok** — `hat`, `headband`, `tie`, `tights`, `sock`, `bag_wallet`, `scarf` LCW feed'inde olmadığı için klasör de oluşmuyor.

## Foto isimlendirme

| Dosya | Anlam |
|---|---|
| `{id}_front.jpg` | Model üstünde, önden |
| `{id}_back.jpg` | Model üstünde, arkadan (her üründe olmayabilir) |

Flat-lay (garment_front / garment_back) fotolar **dataset'e dahil değil**.

## Kullanım

### PyTorch ImageFolder (tek satır)

```python
from torchvision.datasets import ImageFolder
from torchvision import transforms

tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

ds = ImageFolder("data/ml-dataset/", transform=tf)
print(ds.classes)   # ['dress_jumpsuit', 'outerwear', 'pants', 'scarf', 'shirt_top', 'shoe', 'shorts', 'skirt']
print(len(ds))      # 1922
```

### Class imbalance için weight

```python
import torch
from collections import Counter

counts = Counter([label for _, label in ds.samples])
max_c = max(counts.values())
weights = torch.tensor([max_c / counts[i] for i in range(len(ds.classes))])
criterion = torch.nn.CrossEntropyLoss(weight=weights)
```

### Meta lookup (gender / deeplink lazımsa)

```python
import json
from pathlib import Path

meta = {r["id"]: r for r in (json.loads(l) for l in open("data/ml-dataset.jsonl"))}

p = Path("data/ml-dataset/shoe/LCW-3422865_front.jpg")
product_id = p.stem.rsplit("_", 1)[0]   # "LCW-3422865"
print(meta[product_id]["gender"])       # "kadin"
print(meta[product_id]["deeplink"])     # affiliate link
```

## Build seçenekleri

```bash
# Sadece belirli class'lar
node scripts/build-imagefolder.mjs --classes shirt_top,outerwear,pants,shoe

# Sadece yüksek-güven sınıflandırma (keyword match)
node scripts/build-imagefolder.mjs --source-only keyword

# Gerçek dosya kopyası (taşınabilir, ~500MB+ disk)
node scripts/build-imagefolder.mjs --copy
```

Default: hardlink (Windows) veya symlink (Unix) — ~0 byte ekstra disk.

## Class dağılımı

| Class | Foto | Not |
|---|---:|---|
| shirt_top | 781 | tişört/gömlek/sweatshirt/bluz/tunik |
| pants | 354 | pantolon/jean/eşofman |
| outerwear | 320 | mont/kaban/yelek/ceket/cardigan/yağmurluk |
| shoe | 251 | ayakkabı/bot/sandalet |
| shorts | 86 | şort/bermuda |
| skirt | 66 | etek |
| dress_jumpsuit | 64 | elbise/tulum/salopet |
| **Toplam foto** | **1922** | 1099 üründen |

## Meta dosyalar

| Dosya | İçerik |
|---|---|
| `data/ml-dataset.jsonl` | Source of truth — her ürün için id, class, gender, deeplink, foto URL'leri |
| `data/ml-dataset.csv` | Aynı veri Excel/pandas için |
| `data/ml-dataset-stats.json` | Class dağılımı + breakdown |

## Yeniden üretim

```bash
node scripts/export-ml-dataset.mjs        # JSONL'i yeniden üret
node scripts/build-imagefolder.mjs        # klasör yapısını yeniden kur
```

## Sınıflandırma doğruluğu

Manuel sample audit ile:
- shoe ~%100, shirt_top ~%98, pants ~%97, outerwear ~%97
- shorts/skirt/dress_jumpsuit ~%95-97 (keyword-based)

Her JSONL satırında `classification_source` alanı var:
- `keyword` (yüksek güven, Türkçe regex ile yakalandı)
- `type_default` (orta güven, coarse kategori default'una düştü)

`--source-only keyword` ile sadece yüksek-güveni dahil et.
