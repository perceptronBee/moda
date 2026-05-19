# MODA Fashion Dataset

> Bu branch sadece **dataset** içerir. App kodu yok, sadece görseller + metadata.
> Ana proje için `main` branch'ine bak.

## Hızlı başlangıç

```bash
git checkout dataset-only
```

Hepsi hazır — `data/ml-dataset/` altında 7 class kendi klasöründe, içinde worn (giyilmiş) fotolar.

```python
from torchvision.datasets import ImageFolder
ds = ImageFolder("data/ml-dataset/")
print(ds.classes)   # ['dress_jumpsuit', 'outerwear', 'pants', 'shirt_top', 'shoe', 'shorts', 'skirt']
print(len(ds))      # 1922
```

Detaylı kullanım: **[`dataset/README.md`](dataset/README.md)**

## İçerik

| Yol | İçerik |
|---|---|
| `data/ml-dataset/{class}/` | **ImageFolder uyumlu dataset** — class başına bir klasör, içinde `{id}_front.jpg` ve `{id}_back.jpg` |
| `data/ml-dataset.jsonl` | Her ürünün metadata'sı (id, class, gender, deeplink) — meta lookup için |
| `data/ml-dataset.csv` | Aynı veri Excel/pandas için |
| `data/ml-dataset-stats.json` | Class dağılımı |
| `public/products/` | Kaynak fotolar (1100+ ürün) |

## Class dağılımı

| Class | Foto |
|---|---:|
| shirt_top | 781 |
| pants | 354 |
| outerwear | 320 |
| shoe | 251 |
| shorts | 86 |
| skirt | 66 |
| dress_jumpsuit | 64 |
| **Toplam** | **1922** |
