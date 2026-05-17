# Run locally: uvicorn main:app --reload
import base64
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
import fal_client

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE, override=True)

# fal_client reads FAL_KEY from env automatically
os.environ.setdefault("FAL_KEY", os.getenv("FAL_KEY", ""))

app = FastAPI(title="VTON Hackathon API")
INDEX_FILE = BASE_DIR / "index.html"


def to_data_url(content: bytes, content_type: str) -> str:
    """Convert raw bytes to a base64 data URL."""
    b64 = base64.b64encode(content).decode("utf-8")
    return f"data:{content_type};base64,{b64}"


@app.get("/debug-env")
async def debug_env():
    return {
        "model": "fal-ai/idm-vton",
        "api_key_set": bool(os.getenv("FAL_KEY")),
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
    if not os.getenv("FAL_KEY"):
        raise HTTPException(status_code=500, detail="FAL_KEY is missing in environment variables.")

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

    try:
        # Convert human image to data URL (avoids fal storage upload 403)
        human_content = await base_image.read()
        human_data_url = to_data_url(human_content, base_image.content_type or "image/jpeg")

        # Process the FIRST garment item (IDM-VTON works best with single garment)
        garment = item_uploads[0]
        garment_content = await garment.read()
        garment_data_url = to_data_url(garment_content, garment.content_type or "image/jpeg")

        # Call IDM-VTON via Fal.ai
        result = fal_client.subscribe(
            "fal-ai/idm-vton",
            arguments={
                "human_image_url": human_data_url,
                "garment_image_url": garment_data_url,
            },
        )

        # Extract result image
        if "image" in result and "url" in result["image"]:
            result_url = result["image"]["url"]
            # Download and convert to base64 for frontend
            import requests as req
            resp = req.get(result_url, timeout=30)
            if resp.status_code == 200:
                image_b64 = base64.b64encode(resp.content).decode("utf-8")
                return {"result_image": f"data:image/png;base64,{image_b64}"}
            else:
                return {"result_image": result_url}
        else:
            raise ValueError(f"Model did not return an image. Response: {result}")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Try-on generation failed: {exc}") from exc
