# Run locally: uvicorn main:app --reload
import base64
import os
import io
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
import requests as http_requests

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE, override=True)

app = FastAPI(title="VTON Hackathon API")
INDEX_FILE = BASE_DIR / "index.html"

FAL_API_URL = "https://queue.fal.run/fal-ai/idm-vton"


import fal_client

def get_fal_key() -> str:
    key = os.getenv("FAL_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="FAL_KEY is missing.")
    # Ensure fal_client uses this key if not set inherently
    os.environ["FAL_KEY"] = key
    return key

def upload_to_fal(data: bytes, content_type: str, fal_key: str) -> str:
    """Upload a file to fal.ai storage and return the URL using proper Fal Client."""
    # This automatically uses the FAL_KEY env var
    return fal_client.upload(data, content_type)


@app.get("/debug-env")
async def debug_env():
    return {
        "model": "fal-ai/idm-vton",
        "api_key_set": bool(os.getenv("FAL_KEY")),
    }


@app.get("/")
async def serve_index() -> FileResponse:
    if not INDEX_FILE.exists():
        raise HTTPException(status_code=500, detail="index.html not found.")
    return FileResponse(INDEX_FILE)


@app.post("/api/try-on")
async def try_on(
    request: Request,
    base_image: UploadFile = File(...),
):
    fal_key = get_fal_key()

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
        raise HTTPException(status_code=400, detail="At least one item image is required.")

    try:
        # Read images
        human_content = await base_image.read()
        garment = item_uploads[0]
        garment_content = await garment.read()

        # Upload to fal storage
        human_url = upload_to_fal(human_content, base_image.content_type or "image/jpeg", fal_key)
        garment_url = upload_to_fal(garment_content, garment.content_type or "image/jpeg", fal_key)

        # Submit job to fal queue
        submit_resp = http_requests.post(
            FAL_API_URL,
            headers={
                "Authorization": f"Key {fal_key}",
                "Content-Type": "application/json",
            },
            json={
                "human_image_url": human_url,
                "garment_image_url": garment_url,
                "description": "A person wearing the selected garment, photorealistic, high quality",
                "num_inference_steps": 20
            },
            timeout=120,
        )

        if submit_resp.status_code != 200:
            raise ValueError(f"Fal API error {submit_resp.status_code}: {submit_resp.text[:500]}")

        result = submit_resp.json()

        # Check for queued response (request_id)
        if "request_id" in result:
            req_id = result["request_id"]
            # Poll for result
            import time
            for _ in range(60):  # max ~2 min polling
                time.sleep(2)
                status_resp = http_requests.get(
                    f"https://queue.fal.run/fal-ai/idm-vton/requests/{req_id}/status",
                    headers={"Authorization": f"Key {fal_key}"},
                    timeout=10,
                )
                status_data = status_resp.json()
                if status_data.get("status") == "COMPLETED":
                    result_resp = http_requests.get(
                        f"https://queue.fal.run/fal-ai/idm-vton/requests/{req_id}",
                        headers={"Authorization": f"Key {fal_key}"},
                        timeout=30,
                    )
                    result = result_resp.json()
                    break
                elif status_data.get("status") == "FAILED":
                    raise ValueError(f"Fal job failed: {status_data}")
            else:
                raise ValueError("Fal job timed out after 2 minutes")

        # Extract result image
        if "image" in result and "url" in result["image"]:
            result_url = result["image"]["url"]
            img_resp = http_requests.get(result_url, timeout=30)
            if img_resp.status_code == 200:
                image_b64 = base64.b64encode(img_resp.content).decode("utf-8")
                return {"result_image": f"data:image/png;base64,{image_b64}"}
            else:
                return {"result_image": result_url}
        else:
            raise ValueError(f"No image in result: {result}")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Try-on generation failed: {exc}") from exc
