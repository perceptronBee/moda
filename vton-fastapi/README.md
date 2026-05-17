# VTON FastAPI Service

Virtual try-on backend — Vertex AI Gemini 2.5 Flash Image (Nano Banana 2).

## ⚠️ Bu klasör Vercel'e deploy edilmiyor

Next.js + Python aynı projede ama farklı host'larda çalışır. Bu Python
servisi **Google Cloud Run / Render / Railway** gibi container destekli
bir host'a ayrı deploy edilir. Next sadece HTTP URL'i bilir.

## Local çalıştırma

```bash
cd vton-fastapi
cp .env.example .env
# .env içine GCP_PROJECT_ID gir
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Google Cloud auth — biri:
gcloud auth application-default login
# veya .env'e GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json

uvicorn main:app --reload --port 8000
```

Test: `http://localhost:8000/` — index.html demo UI

## Next.js entegrasyonu

Next'in `.env.local`'ine:

```
VTON_API_URL=http://localhost:8000
VTON_API_TOKEN=  # üretimde uzun rastgele string
```

Next route handler `/api/ai/try-on` bu servise multipart form forward eder.

## Auth (production'da zorunlu)

Servis public host'ta çalışacaksa kimlik doğrulaması ekle:
- `main.py`'a basit token middleware (header `X-API-Token`) ekle
- Vercel'de `VTON_API_TOKEN` ile aynı değer
- Bu olmadan herkes endpoint'i çağırıp Gemini fatura faturasını şişirebilir

## Cloud Run deploy (önerilen)

```bash
gcloud run deploy moda-vton \
  --source vton-fastapi \
  --region europe-west1 \
  --set-env-vars="GCP_PROJECT_ID=YOUR_PROJECT,VTON_API_TOKEN=YOUR_TOKEN" \
  --allow-unauthenticated   # Next proxy'de token check yapacağız
```

Cloud Run URL'ini `VTON_API_URL` olarak Vercel env'ine yaz.

## API

### POST /api/try-on
Multipart form-data:
- `base_image`: File (kullanıcının fotoğrafı)
- `item_1`, `item_2`, ...: File (giydirilecek kıyafetlerin foto'ları)

Cevap:
```json
{ "result_image": "data:image/png;base64,..." }
```
