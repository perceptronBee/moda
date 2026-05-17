# Run locally: uvicorn main:app --reload
import base64
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
import vertexai
from vertexai.generative_models import GenerationConfig, GenerativeModel, Part

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE, override=True)

# Cloud deploy desteği — credential JSON'u env var olarak geliyorsa dosyaya yaz
_creds_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if _creds_json and not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    _creds_path = BASE_DIR / "credentials_runtime.json"
    _creds_path.write_text(_creds_json)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_creds_path)

PROMPT_TEMPLATE = (
    "Act as an expert stylist. Seamlessly layer these {item_count} clothing items onto the "
    "base person. Maintain exact original identity, lighting, background, and realistic "
    "fabric physics."
)
MODEL_NAME = os.getenv("VERTEX_MODEL_NAME", "gemini-2.5-flash-image")
OUTPUT_ONLY_IMAGE_INSTRUCTION = (
    "Return exactly one edited photorealistic image and no explanatory text."
)
app = FastAPI(title="VTON Hackathon API")
INDEX_FILE = BASE_DIR / "index.html"


def get_vertex_model() -> GenerativeModel:
    project_id = os.getenv("GCP_PROJECT_ID")
    location = os.getenv("GCP_LOCATION", "us-central1")
    if not project_id:
        raise RuntimeError("GCP_PROJECT_ID is missing. Add it to your .env file.")

    vertexai.init(project=project_id, location=location, api_transport="rest")
    return GenerativeModel(MODEL_NAME)


def extract_generated_image(response) -> tuple[bytes, str] | tuple[None, None]:
    candidates = getattr(response, "candidates", []) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", []) or []
        for part in parts:
            inline_data = getattr(part, "inline_data", None)
            if inline_data and getattr(inline_data, "data", None) is not None:
                data = inline_data.data
                if isinstance(data, str):
                    data = base64.b64decode(data)
                mime_type = getattr(inline_data, "mime_type", "image/png")
                return data, mime_type
    return None, None


def extract_response_text(response) -> str:
    candidates = getattr(response, "candidates", []) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", []) or []
        for part in parts:
            text = getattr(part, "text", None)
            if text:
                return text.strip()
    return ""


def generate_with_retry(model: GenerativeModel, parts: list[Part], prompt: str):
    # First pass: normal prompt with image-only response modality.
    response = model.generate_content(
        [*parts, prompt],
        generation_config=GenerationConfig(response_modalities=["IMAGE"]),
    )
    image_bytes, mime_type = extract_generated_image(response)
    if image_bytes:
        return image_bytes, mime_type, ""

    # Retry once with a stricter instruction to avoid text-only responses.
    strict_prompt = f"{prompt} {OUTPUT_ONLY_IMAGE_INSTRUCTION}"
    retry_response = model.generate_content(
        [*parts, strict_prompt],
        generation_config=GenerationConfig(response_modalities=["IMAGE"]),
    )
    retry_image_bytes, retry_mime_type = extract_generated_image(retry_response)
    if retry_image_bytes:
        return retry_image_bytes, retry_mime_type, ""

    fallback_text = extract_response_text(retry_response) or extract_response_text(response)
    return None, None, fallback_text


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
    temp_paths: list[str] = []

    try:
        model = get_vertex_model()
        content_parts = []

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
                temp_paths.append(tmp_file.name)
                content_parts.append(
                    Part.from_data(data=content, mime_type=upload.content_type or "image/png")
                )

        image_bytes, mime_type, fallback_text = generate_with_retry(
            model=model,
            parts=content_parts,
            prompt=styling_prompt,
        )
        if not image_bytes:
            detail = "Model returned no image output. Try different source images."
            if fallback_text:
                detail = f"{detail} Model text: {fallback_text[:300]}"
            raise HTTPException(
                status_code=502,
                detail=detail,
            )

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        return {"result_image": f"data:{mime_type};base64,{image_b64}"}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Try-on generation failed: {exc}") from exc
    finally:
        for tmp_path in temp_paths:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

