# MODA Fashion Dataset

LCWaikiki ürün feed'inden üretilmiş, **giyilmiş (worn)** fotoğraflarla class-based eğitim dataset'i. Flat-lay (giyilmemiş) fotolar dataset'e dahil edilmez.

## Klasör yapısı (ImageFolder uyumlu)

```
data/ml-dataset/
├── shirt_top/                ← 781 foto
│   ├── LCW-3422865_front.jpg
│   ├── LCW-3422865_back.jpg   (varsa)
│   └── ...
├── outerwear/                ← 320 foto
├── pants/                    ← 354 foto
├── shorts/                   ← 86 foto
├── skirt/                    ← 66 foto
├── dress_jumpsuit/           ← 64 foto
└── shoe/                     ← 251 foto
```

LCW feed'inde aksesuar olmadığı için `hat`, `headband`, `tie`, `tights`, `sock`, `bag_wallet`, `scarf` klasörleri yok.

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
print(ds.classes)   # ['dress_jumpsuit', 'outerwear', 'pants', 'shirt_top', 'shoe', 'shorts', 'skirt']
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

## Class dağılımı

| Class | Foto | İçerik |
|---|---:|---|
| shirt_top | 781 | tişört/gömlek/sweatshirt/bluz/tunik |
| pants | 354 | pantolon/jean/eşofman |
| outerwear | 320 | mont/kaban/yelek/ceket/cardigan/yağmurluk |
| shoe | 251 | ayakkabı/bot/sandalet |
| shorts | 86 | şort/bermuda |
| skirt | 66 | etek |
| dress_jumpsuit | 64 | elbise/tulum/salopet |
| **Toplam** | **1922** | 1099 üründen |

## Meta dosyalar

| Dosya | İçerik |
|---|---|
| `data/ml-dataset.jsonl` | Source of truth — her ürün için id, class, gender, deeplink, foto URL'leri |
| `data/ml-dataset.csv` | Aynı veri Excel/pandas için |
| `data/ml-dataset-stats.json` | Class dağılımı + breakdown |

## JSONL şeması (her satır)

```json
{
  "id": "LCW-3422865",
  "class": "shoe",
  "image_path": "public/products/lcwaikiki/lcw-3422865/front.jpg",
  "image_url": "https://moda-ruby.vercel.app/products/lcwaikiki/lcw-3422865/front.jpg",
  "name": "Kahverengi TABA Hakiki Deri Küt Burun ...",
  "category": "ayakkabi",
  "gender": "kadin",
  "retailer": "lcwaikiki",
  "deeplink": "https://www.lcw.com/...",
  "classification_source": "type_default"
}
```

`classification_source`:
- `keyword` (275 satır) — Türkçe regex eşleşti, yüksek güven
- `type_default` (824 satır) — coarse kategori default'una düştü, orta güven

## Sınıflandırma doğruluğu

Manuel sample audit ile:
- shoe ~%100, shirt_top ~%98, pants ~%97, outerwear ~%97
- shorts/skirt/dress_jumpsuit ~%95-97 (keyword bazlı)
