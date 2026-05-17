# Run locally: uvicorn main:app --reload
import base64
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from google import genai
from google.genai import types

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE, override=True)

app = FastAPI(title="VTON Hackathon API")
INDEX_FILE = BASE_DIR / "index.html"

# The user explicitly wants "nanobanana 2" which means gemini-2.0-flash-exp
MODEL_NAME = "gemini-2.0-flash-exp"

PROMPT_TEMPLATE = (
    "Act as an expert stylist. Layer these {item_count} clothing items onto the "
    "base person. You MUST output ONLY the resulting photorealistic image using "
    "response modalities. Maintain exact original identity, lighting, background."
)


def get_genai_client() -> genai.Client:
    # Use the GEMINI_API_KEY from environment
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing. Add it to your .env file or environment.")
    return genai.Client(api_key=api_key)


@app.get("/debug-env")
async def debug_env():
    return {
        "model": MODEL_NAME,
        "api_key_set": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.get("/")
async def serve_index() -> FileResponse:
    if not INDEX_FILE.exists():
        raise HTTPException(status_code=500, detail="index.html not found in project root.")
    return FileResponse(INDEX_FILE)


@app.post("/api/try-on")
async def try_on(
    request: Request,
    base_image: UploadFile = File(...),
):
    form = await request.form()
    item_fields: list[tuple[str, UploadFile]] = []

    for key, value in form.multi_items():
        if key.startswith("item_") and hasattr(value, "filename"):
            item_fields.append((key, value))

    item_fields.sort(
        key=lambda pair: int(pair[0].split("_")[1]) if pair[0].split("_")[1].isdigit() else 10_000
    )
    item_uploads = [upload for _, upload in item_fields]
    if not item_uploads:
        raise HTTPException(
            status_code=400,
            detail="At least one item image is required (item_1, item_2, ...).",
        )

    uploads = [base_image, *item_uploads]
    styling_prompt = PROMPT_TEMPLATE.format(item_count=len(item_uploads))

    client = get_genai_client()
    contents = []

    # Upload files using genai.Client
    uploaded_files = []
    try:
        # Upload all images directly to Gemini Files API
        for upload in uploads:
            if not upload.filename:
                raise HTTPException(status_code=400, detail="Each upload must include a file.")

            if upload.content_type and not upload.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="Only image files are accepted.")

            content = await upload.read()
            if not content:
                raise HTTPException(status_code=400, detail=f"{upload.filename} is empty.")

            suffix = Path(upload.filename).suffix or ".png"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
                tmp_file.write(content)
                tmp_file.flush()
                
                gemini_file = client.files.upload(
                    file=tmp_file.name,
                    config={"mime_type": upload.content_type or "image/png"}
                )
                uploaded_files.append(gemini_file)
                contents.append(gemini_file)
                
                os.remove(tmp_file.name)
        
        # Add the text prompt at the end
        contents.append(styling_prompt)

        # Generate content with IMAGE response modality
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            )
        )

        if not response.generated_images:
            fallback = response.text if response.text else "No image was generated."
            raise HTTPException(
                status_code=502,
                detail=f"Model returned no image output. Text: {fallback[:300]}",
            )

        # Get the first generated image
        generated_image = response.generated_images[0]
        image_bytes = generated_image.image.image_bytes
        
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        return {"result_image": f"data:image/jpeg;base64,{image_b64}"}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Try-on generation failed: {exc}") from exc
    finally:
        # Cleanup uploaded files from Gemini
        for g_file in uploaded_files:
            try:
                client.files.delete(name=g_file.name)
            except Exception:
                pass
