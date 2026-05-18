# MODA Fashion Dataset

> Bu branch sadece **dataset** için. App kodu yok, sadece görseller + metadata + build script'leri.
> Ana proje için `main` branch'ine bak.

## Hızlı başlangıç

```bash
git checkout dataset-only
node scripts/build-photo-folders.mjs
```

Çıktı: `data/ml-dataset/` altında 3 klasör — her ürün kendi alt-klasöründe, foto'ları açıklayıcı isimlerle.

Tam dokümantasyon: **[`dataset/README.md`](dataset/README.md)**

## İçerik

| Yol | İçerik |
|---|---|
| `data/ml-dataset.jsonl` | 1099 ürünün metadata'sı (id, class, gender, foto URL'leri, deeplink) |
| `data/ml-dataset.csv` | Aynı veri Excel/pandas için |
| `data/ml-dataset-stats.json` | Class dağılımı + breakdown |
| `data/ml-dataset-README.md` | Şema dokümantasyonu |
| `dataset/README.md` | **Asıl kullanım rehberi** |
| `scripts/export-ml-dataset.mjs` | Metadata üreten script |
| `scripts/build-photo-folders.mjs` | Klasör yapısı kuran script |
| `public/products/` | 1100+ ürün fotoğrafı |

## Notlar

- `data/ml-dataset/` (build çıktısı) `.gitignore`'da — script çalıştırınca lokal oluşur
- Build hardlink kullanır, disk şişmez (~0 byte ekstra)
- Foto-availability bazlı 3 grup: `01_flatlay_full`, `02_flatlay_front_only`, `03_no_flatlay`
- 14-class taxonomy de mevcut (`INDEX.jsonl` içinde `class` alanı), opsiyonel
