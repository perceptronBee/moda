import os
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

from inference import process_image, get_text_embedding
from database import FashionDatabase


# App init

app = FastAPI(title="Moda AI Styling Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Services

db = FashionDatabase("enriched_database.jsonl")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
gemini_client  = genai.Client(api_key=GEMINI_API_KEY)

GEMINI_MODEL = "gemini-3.1-flash-lite"


# System prompt

SYSTEM_INSTRUCTION = """
Sen profesyonel bir yapay zeka moda stil danışmanısın. Kullanıcı ile her zaman Türkçe ve samimi bir dille konuş.

TEMEL KURALLAR:
1. Yalnızca sana "Veritabanından Bulunan Ürünler" JSON verisi içindeki kıyafetleri önerebilirsin. Asla veritabanı dışından ürün uydurma.
2. Veritabanında ürün varsa MUTLAKA öner. JSON verisi doluysa ürün var demektir — "stok yok" veya "uygun ürün bulamadım" deme.
3. Ürün önerirken mutlaka ürünün adını ve "deeplink" adresini ekle.
4. Moda dışı konulara girme; sorulursa kibarca reddet.
5. Kullanıcı açıkça istemediği sürece ve tam boy elbise (dress) yüklemedikçe ayakkabı önerme.
6. Üst giyim varsa alt giyim öner, alt giyim varsa üst giyim öner.
7. Fotoğrafta birden fazla kıyafet varsa ve kullanıcı hangisi için kombin istediğini belirtmediyse, sormadan önce önce en belirgin kıyafet için bir öneri yap, sonra diğerleri için de yardımcı olabileceğini belirt.

CİNSİYET KURALI (ÖNEMLİ):
- Sana her mesajda kullanıcının cinsiyeti ayrıca bildirilecek ("Kullanıcı cinsiyeti: ...").
- Cinsiyet bilinmiyorsa yalnızca bir kez sor. Cevap vermezse veya "bilmiyorum" derse unisex ürünler öner.
- Cinsiyet bir kez belirlendikten sonra bir daha sorma; sana zaten her turda bildirilecek.

ÖNERI TARZI:
- Koşullar tam uygun olmasa bile elindeki en iyi seçeneği öner ve neden uygun olduğunu kısaca açıkla.
- Eksik bilgi nedeniyle öneri yapmaktan kaçınma; bir şeyler öner, gerekirse "bu arada X'i de paylaşırsan daha iyi eşleştirebilirim" de.
"""


# Helpers


def _detect_search_intent(user_text: str, has_image: bool) -> bool:
    """
    Returns True if the message is a clothing search / styling request,
    False if it is purely conversational (e.g. "Emin misin?", "Teşekkürler").
    Uses a fast single-token Gemini call to decide.
    Image uploads are always treated as search intent regardless.
    """
    if has_image:
        return True

    prompt = (
        "Aşağıdaki mesaj bir kıyafet arama/stil talebi mi, yoksa sadece sohbet/onay cümlesi mi? "
        "Yalnızca 'ARAMA' veya 'SOHBET' yaz, başka hiçbir şey yazma.\n"
        f"Mesaj: '{user_text}'"
    )
    try:
        resp = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
            config=types.GenerateContentConfig(temperature=0.0, max_output_tokens=5),
        )
        return resp.text.strip().upper().startswith("ARAMA")
    except Exception as e:
        print(f"  Intent detection failed ({e}), defaulting to SEARCH")
        return True  # safe default: try to search


def _extract_gender_from_history(parsed_history: list) -> str:
    """
    Scans the chat history for a gender declaration so it is never forgotten
    across turns even if the frontend sends incomplete history.
    Returns 'erkek', 'kadın', or 'bilinmiyor'.
    """
    keywords_male   = ["erkek", "erkek.", "erkek,", "bay", "adam"]
    keywords_female = ["kadın", "kadın.", "kadın,", "bayan", "kız"]

    for msg in reversed(parsed_history):  # most recent first
        content = msg.get("content", "").lower()
        if any(k in content for k in keywords_male):
            return "erkek"
        if any(k in content for k in keywords_female):
            return "kadın"

    return "bilinmiyor"


def _build_gemini_history(parsed_history: list) -> list[types.Content]:
    """Convert frontend chat history to Gemini Content objects."""
    contents = []
    for msg in parsed_history:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg.get("content", ""))])
        )
    return contents



# Endpoint

@app.post("/api/chat")
async def chat_endpoint(
    user_text:    str        = Form(...),
    chat_history: str        = Form(default="[]"),
    image:        UploadFile = File(None),
):
    try:
        vision_data            = []
        retrieved_catalog_items = []
        parsed_history         = json.loads(chat_history)


        # A. Process image if provided

        if image:
            temp_path = f"temp_{image.filename}"
            with open(temp_path, "wb") as f:
                f.write(await image.read())

            vision_data = process_image(temp_path)
            os.remove(temp_path)

            # FIX: "embedding" is now present in vision_data items (fixed in inference.py)
            if vision_data and "embedding" in vision_data[0]:
                query_embedding = vision_data[0]["embedding"]
                retrieved_catalog_items = db.search_by_embedding(query_embedding, top_k=8)

            # Strip embeddings before sending to Gemini
            for item in vision_data:
                item.pop("embedding", None)


        # B. Text-only path — only search FAISS if this is a real search query

        if not image:
            is_search = _detect_search_intent(user_text, has_image=False)
            print(f"  Intent: {'SEARCH' if is_search else 'CHAT'} — '{user_text}'")

            if is_search:
                text_vector = get_text_embedding(user_text)
                retrieved_catalog_items = db.search_by_embedding(text_vector, top_k=8)

                for item in retrieved_catalog_items:
                    item.pop("embedding", None)


        # C. Extract gender from history so Gemini never forgets it

        gender = _extract_gender_from_history(parsed_history)

        # D. Build current-turn context

        prompt_parts = [f"Kullanıcı Mesajı: '{user_text}'"]

        if gender != "bilinmiyor":
            prompt_parts.append(f"Kullanıcı cinsiyeti: {gender}")
        else:
            prompt_parts.append(
                "Kullanıcı cinsiyeti: bilinmiyor — eğer henüz sormadıysan bir kez sor, "
                "sormadıysan unisex ürünler öner."
            )

        if vision_data:
            prompt_parts.append(
                f"Yüklenen Fotoğrafın Analizi (JSON):\n{json.dumps(vision_data, ensure_ascii=False)}"
            )

        if retrieved_catalog_items:
            prompt_parts.append(
                f"Veritabanından Bulunan Ürünler (JSON):\n"
                f"{json.dumps(retrieved_catalog_items, ensure_ascii=False)}"
            )
        else:
            # Be explicit so Gemini doesn't hallucinate items
            prompt_parts.append(
                "Veritabanından Bulunan Ürünler: Bu sorgu için eşleşen ürün bulunamadı. "
                "Bunu dürüstçe belirt ve kullanıcıdan farklı bir arama yapmayı veya "
                "fotoğraf yüklemeyi önер."
            )

        prompt_parts.append("Lütfen yukarıdaki kurallara uyarak kullanıcıya Türkçe yanıt ver.")
        prompt_context = "\n\n".join(prompt_parts)


        # E. Assemble Gemini conversation and generate response

        gemini_contents = _build_gemini_history(parsed_history)
        gemini_contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=prompt_context)])
        )

        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=gemini_contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.5,
            ),
        )

        return {
            "status":         "success",
            "ai_response":    response.text,
            "vision_debug":   vision_data,
            "suggested_items": retrieved_catalog_items,
        }

    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
