"""
inference.py — Fixed version.

Changes vs original:
  1. Removed CLIPProcessor entirely. open_clip's own tokenizer is used for
     get_text_embedding(), which matches exactly what the backbone expects.
     Using the HF CLIPProcessor tokenizer with an open_clip backbone produced
     misaligned token sequences → garbage vectors → FAISS misses.

  2. process_image() now includes "embedding" in every output dict so the
     FAISS image-search branch in main.py actually fires. Previously emb_list
     was computed but never stored, making the condition
     `if vision_data and "embedding" in vision_data[0]` always False.

  3. get_text_embedding() wraps the query in the same ensemble prompt templates
     used by ZeroShotAttributeModel so the text vector lands in the same region
     of the embedding space as the image vectors stored in FAISS.
"""

import os
import json
import cv2
import torch
import numpy as np
import open_clip
from PIL import Image

from ultralytics import YOLO
from attribute_model import AttributeModel, ZeroShotAttributeModel

# ===========================
# Config
# ===========================
os.environ["YOLO_VERBOSE"] = "False"

DEVICE            = "cuda" if torch.cuda.is_available() else "cpu"
YOLO_WEIGHTS      = "best_module1.pt"
ATTR_WEIGHTS      = "best_module2_head.pt"
ATTR_CONFIG_PATH  = "attribute_config.json"

# High precision threshold so the LLM gets clean signal
CONFIDENCE_THRESH = 0.75

# Zero-shot sub-category map
ZERO_SHOT_MAP = {
    "shirt_top":      ["top", "t-shirt", "sweatshirt", "sweater", "shirt", "blouse"],
    "outerwear":      ["jacket", "coat", "vest", "cardigan"],
    "dress_jumpsuit": ["dress", "jumpsuit"],
}

# Prompt templates for text embedding (must match ZeroShotAttributeModel)
TEXT_PROMPT_TEMPLATES = [
    "a photo of a {} garment",
    "a {} piece of clothing",
    "clothing with a {} pattern",
    "a {} style outfit",
    "a garment that is {}",
]

# ===========================
# Model Init
# ===========================
print("Loading Phase 1: YOLOv11...")
yolo_model = YOLO(YOLO_WEIGHTS)

print("Loading Phase 2: Attribute Config...")
with open(ATTR_CONFIG_PATH, "r") as f:
    attr_config = json.load(f)
finetune_names = attr_config["finetune_names"]
num_classes    = attr_config["num_classes"]

print(f"Loading Phase 2: Fine-Tuned Model ({num_classes} attributes)...")
finetuned_model = AttributeModel(num_classes=num_classes, device=DEVICE).to(DEVICE)
finetuned_model.load_state_dict(
    torch.load(ATTR_WEIGHTS, map_location=DEVICE, weights_only=True),
    strict=False,
)
finetuned_model.eval()

print("Loading Phase 2: Zero-Shot Models...")
zero_shot_models: dict[str, ZeroShotAttributeModel] = {}
for yolo_name, sub_classes in ZERO_SHOT_MAP.items():
    zero_shot_models[yolo_name] = ZeroShotAttributeModel(
        attribute_names=sub_classes, device=DEVICE
    )

# FIX: Use open_clip's own tokenizer, not CLIPProcessor.
# The open_clip backbone was trained with this tokenizer; mixing it with the
# HF CLIPProcessor produces subtly wrong token sequences.
print("Loading open_clip tokenizer...")
_oc_tokenizer = open_clip.get_tokenizer("hf-hub:Marqo/marqo-fashionCLIP")

# Grab the backbone from any zero-shot model — they all share the same weights
_clip_backbone = list(zero_shot_models.values())[0].backbone

# open_clip image preprocessing transform (used to replace CLIPProcessor for images)
_, _, _image_transform = open_clip.create_model_and_transforms(
    "hf-hub:Marqo/marqo-fashionCLIP", device=DEVICE
)


# ===========================
# Helpers
# ===========================

def _pil_to_pixel_values(pil_img: Image.Image) -> torch.Tensor:
    """Convert a PIL image to a (1, C, H, W) tensor using open_clip's transform."""
    return _image_transform(pil_img).unsqueeze(0).to(DEVICE)


def extract_dominant_colors(
    image_bgr: np.ndarray, binary_mask: np.ndarray, k: int = 3
) -> list:
    """K-Means dominant color extraction, ignoring background pixels."""
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pixels = image_rgb.reshape(-1, 3)
    mask_flat = binary_mask.reshape(-1)
    foreground_pixels = pixels[mask_flat > 0]

    if len(foreground_pixels) == 0:
        return []

    data = np.float32(foreground_pixels)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    actual_k = min(k, len(np.unique(data, axis=0)))
    _, labels, centers = cv2.kmeans(
        data, actual_k, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS
    )

    label_counts = np.bincount(labels.flatten())
    percentages = label_counts / len(foreground_pixels)

    colors = []
    for center, pct in zip(centers, percentages):
        r, g, b = [int(c) for c in center]
        colors.append(
            {
                "hex": f"#{r:02x}{g:02x}{b:02x}",
                "rgb": [r, g, b],
                "percentage": round(float(pct) * 100, 1),
            }
        )
    colors.sort(key=lambda x: x["percentage"], reverse=True)
    return colors


# ===========================
# Main Pipeline
# ===========================

def process_image(image_path: str) -> list:
    """
    Run the full YOLO → attribute → zero-shot pipeline on an image.
    Each returned dict includes an "embedding" key (512-dim list) for FAISS.
    main.py is responsible for popping "embedding" before sending to Gemini.
    """
    image_bgr = cv2.imread(image_path)
    if image_bgr is None:
        print(f"  ⚠ Could not read image: {image_path}")
        return []

    img_h, img_w = image_bgr.shape[:2]
    yolo_results = yolo_model(image_bgr, verbose=False)[0]
    final_outputs = []

    if yolo_results.masks is None:
        return final_outputs

    for i, box in enumerate(yolo_results.boxes):
        class_id        = int(box.cls[0].item())
        yolo_conf       = box.conf[0].item()
        base_class_name = yolo_results.names[class_id]

        # Bounding box
        x_c, y_c, w, h = box.xywh[0].tolist()
        x1 = max(0, int(x_c - w / 2))
        y1 = max(0, int(y_c - h / 2))
        x2 = min(img_w, int(x_c + w / 2))
        y2 = min(img_h, int(y_c + h / 2))

        # Segmentation mask
        binary_mask = yolo_results.masks.data[i].cpu().numpy()
        binary_mask = cv2.resize(
            binary_mask, (img_w, img_h), interpolation=cv2.INTER_NEAREST
        )

        crop_img  = image_bgr[y1:y2, x1:x2]
        crop_mask = binary_mask[y1:y2, x1:x2]

        if crop_img.size == 0 or crop_mask.sum() == 0:
            continue

        # --- 1. Color extraction ---
        dominant_colors = extract_dominant_colors(crop_img, crop_mask, k=3)

        # Apply neutral gray background so CLIP focuses on the garment
        bg = np.full_like(crop_img, 128)
        crop_gray_bg = np.where(crop_mask[:, :, None] > 0, crop_img, bg)
        crop_rgb = cv2.cvtColor(crop_gray_bg, cv2.COLOR_BGR2RGB)

        # FIX: use open_clip transform instead of CLIPProcessor
        pil_img      = Image.fromarray(crop_rgb)
        pixel_values = _pil_to_pixel_values(pil_img)

        # --- 2. Fine-tuned attributes + embedding ---
        with torch.no_grad():
            attr_probs = finetuned_model.predict_proba(pixel_values)[0].cpu().numpy()
            emb        = finetuned_model.encode_image(pixel_values)
            emb_list   = emb[0].cpu().numpy().tolist()  # stored for FAISS

        detected_attributes = [
            {"name": finetune_names[idx], "confidence": round(float(prob), 3)}
            for idx, prob in enumerate(attr_probs)
            if prob > CONFIDENCE_THRESH
        ]

        # --- 3. Zero-shot sub-category ---
        specific_type = base_class_name
        zs_confidence = yolo_conf

        if base_class_name in ZERO_SHOT_MAP:
            zs_model = zero_shot_models[base_class_name]
            with torch.no_grad():
                img_emb  = zs_model.backbone.encode_image(pixel_values)
                img_emb  = img_emb / img_emb.norm(dim=-1, keepdim=True)
                zs_probs = zs_model.predict_proba(img_emb)[0].cpu().numpy()

            best_idx      = int(np.argmax(zs_probs))
            specific_type = ZERO_SHOT_MAP[base_class_name][best_idx]
            zs_confidence = float(zs_probs[best_idx])

        # FIX: "embedding" is now included so main.py's FAISS branch fires
        final_outputs.append(
            {
                "embedding":           emb_list,   # <-- was missing before
                "base_geometry":       base_class_name,
                "yolo_confidence":     round(yolo_conf, 3),
                "specific_item":       specific_type,
                "zero_shot_confidence": round(zs_confidence, 3),
                "colors":              dominant_colors,
                "attributes":          detected_attributes,
            }
        )

    return final_outputs


def get_text_embedding(text_query: str) -> list:
    """
    Encode a free-text clothing query into a 512-dim L2-normalised vector that
    is compatible with the image vectors stored in FAISS.

    FIX: Uses open_clip's tokenizer (not HF CLIPProcessor) and averages over
    the same prompt ensemble used by ZeroShotAttributeModel so the text vector
    lands in the same region of embedding space as the stored image vectors.
    """
    template_embs = []
    with torch.no_grad():
        for template in TEXT_PROMPT_TEMPLATES:
            prompt = template.format(text_query)
            tokens = _oc_tokenizer([prompt]).to(DEVICE)
            emb    = _clip_backbone.encode_text(tokens)
            emb    = emb / emb.norm(dim=-1, keepdim=True)
            template_embs.append(emb)

    avg = torch.stack(template_embs).mean(dim=0)
    avg = avg / avg.norm(dim=-1, keepdim=True)
    return avg[0].cpu().numpy().tolist()


if __name__ == "__main__":
    test_image = ""  # set to a valid path to test
    if os.path.exists(test_image):
        results = process_image(test_image)
        # Don't print raw embeddings — too noisy
        for r in results:
            r.pop("embedding", None)
        print(json.dumps(results, indent=2))
    else:
        print("Set test_image to a valid image path to test.")
