# Run locally: uvicorn main:app --reload
import base64
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
import fal_client

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE, override=True)

app = FastAPI(title="VTON Hackathon API")
INDEX_FILE = BASE_DIR / "index.html"


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
        # Upload base human image to FAL temp storage
        human_content = await base_image.read()
        human_url = fal_client.upload(human_content, base_image.content_type or "image/jpeg")

        # Process each clothing item sequentially (layering them on top of the human)
        current_human_url = human_url
        
        for item in item_uploads:
            garment_content = await item.read()
            garment_url = fal_client.upload(garment_content, item.content_type or "image/jpeg")
            
            # Call IDM-VTON via Fal.ai
            result = fal_client.subscribe(
                "fal-ai/idm-vton",
                arguments={
                    "human_image_url": current_human_url,
                    "garment_image_url": garment_url,
                    # Category auto-detection is decent, but we can rely on IDM-VTON's robust processing
                }
            )
            
            if "image" in result and "url" in result["image"]:
                # The output becomes the input for the next layer
                current_human_url = result["image"]["url"]
            else:
                raise ValueError("Model did not return an image url.")

        # At the end of all passes, current_human_url holds the final image.
        # We can just return the URL, or download it and return as base64.
        # Returning base64 to match previous frontend expectations
        import requests
        final_img_resp = requests.get(current_human_url)
        if final_img_resp.status_code == 200:
            image_b64 = base64.b64encode(final_img_resp.content).decode("utf-8")
            return {"result_image": f"data:image/jpeg;base64,{image_b64}"}
        else:
            # Fallback to returning the URL directly if base64 conversion fails
            return {"result_image": current_human_url}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Try-on generation failed: {exc}") from exc
