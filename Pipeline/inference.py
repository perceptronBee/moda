import os
import json
import cv2
import torch
import numpy as np
from pathlib import Path
from PIL import Image

from ultralytics import YOLO
from transformers import CLIPProcessor
from attribute_model import AttributeModel, ZeroShotAttributeModel

# Suppress warnings
os.environ["YOLO_VERBOSE"] = "False"

# Configs
DEVICE            = "cuda" if torch.cuda.is_available() else "cpu"
#Init paths
YOLO_WEIGHTS      = "" 
ATTR_WEIGHTS      = ""
ATTR_CONFIG_PATH  = ""

# We raise the threshold here from 0.40 to 0.75 to force high precision for helping the LLM
CONFIDENCE_THRESH = 0.75 

# Sub-categories for zero-shot un-merging based on our YOLO map
ZERO_SHOT_MAP = {
    "shirt_top":      ["top", "t-shirt", "sweatshirt", "sweater", "shirt", "blouse"],
    "outerwear":      ["jacket", "coat", "vest", "cardigan"],
    "dress_jumpsuit": ["dress", "jumpsuit"]
}

#  Init
print("Loading Phase 1: YOLOv11...")
yolo_model = YOLO(YOLO_WEIGHTS)

print("Loading Phase 2: Attribute Config...")
with open(ATTR_CONFIG_PATH, "r") as f:
    attr_config = json.load(f)
finetune_names = attr_config["finetune_names"]
num_classes    = attr_config["num_classes"]

print(f"Loading Phase 2: Fine-Tuned Model ({num_classes} attributes)...")
finetuned_model = AttributeModel(num_classes=num_classes, device=DEVICE).to(DEVICE)
finetuned_model.load_state_dict(torch.load(ATTR_WEIGHTS, map_location=DEVICE, weights_only=True))
finetuned_model.eval()

print("Loading Phase 2: Zero-Shot Models...")


# Initialize a zero-shot model for each merged category to save time during inference
zero_shot_models = {}
for yolo_name, sub_classes in ZERO_SHOT_MAP.items():
    zero_shot_models[yolo_name] = ZeroShotAttributeModel(attribute_names=sub_classes, device=DEVICE)

print("Loading Processor...")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch16")


# Helper Functions

def extract_dominant_colors(image_bgr: np.ndarray, binary_mask: np.ndarray, k: int = 3) -> list:
    """Uses K-Means clustering to find dominant colors, strictly ignoring the background."""
    # Convert to RGB
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    
    # Flatten image and mask
    pixels = image_rgb.reshape(-1, 3)
    mask_flat = binary_mask.reshape(-1)
    
    # Filter out pixels where mask is 0 (background)
    foreground_pixels = pixels[mask_flat > 0]
    
    if len(foreground_pixels) == 0:
        return []
        
    # Convert to float32 for cv2.kmeans
    data = np.float32(foreground_pixels)
    
    # K-Means criteria: Stop after 100 iterations or accuracy > 0.2
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    flags = cv2.KMEANS_RANDOM_CENTERS
    
    # Run K-Means
    # Ensure K isn't larger than the number of unique pixels
    actual_k = min(k, len(np.unique(data, axis=0))) 
    _, labels, centers = cv2.kmeans(data, actual_k, None, criteria, 10, flags)
    
    # Calculate percentages
    label_counts = np.bincount(labels.flatten())
    percentages = label_counts / len(foreground_pixels)
    
    # Sort by dominance
    colors = []
    for center, percentage in zip(centers, percentages):
        r, g, b = [int(c) for c in center]
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        colors.append({
            "hex": hex_color,
            "rgb": [r, g, b],
            "percentage": round(float(percentage) * 100, 1)
        })
        
    colors.sort(key=lambda x: x["percentage"], reverse=True)
    return colors


# Main Pipeline

def process_image(image_path: str):
    image_bgr = cv2.imread(image_path)
    img_h, img_w = image_bgr.shape[:2]
    
    # Phase 1: YOLO Segmentation
    yolo_results = yolo_model(image_bgr, verbose=False)[0]
    final_outputs = []

    if yolo_results.masks is None:
        return final_outputs # No garments found

    for i, box in enumerate(yolo_results.boxes):
        class_id = int(box.cls[0].item())
        yolo_conf = box.conf[0].item()
        base_class_name = yolo_results.names[class_id]
        
        # Get bounding box and mask
        bbox = box.xywh[0].tolist() # x_center, y_center, w, h
        x_c, y_c, w, h = bbox
        x1, y1 = int(x_c - w/2), int(y_c - h/2)
        x2, y2 = int(x_c + w/2), int(y_c + h/2)
        
        # Clamp coordinates
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(img_w, x2), min(img_h, y2)
        
        # YOLO mask is (H, W) resized to the original image
        binary_mask = yolo_results.masks.data[i].cpu().numpy()
        binary_mask = cv2.resize(binary_mask, (img_w, img_h), interpolation=cv2.INTER_NEAREST)
        
        # Crop the image and the mask
        crop_img = image_bgr[y1:y2, x1:x2]
        crop_mask = binary_mask[y1:y2, x1:x2]
        
        if crop_img.size == 0 or crop_mask.sum() == 0:
            continue
            
        # 1. Color Extraction (Phase 2b)
        dominant_colors = extract_dominant_colors(crop_img, crop_mask, k=3)
        
        # Apply gray background to crop for CLIP
        bg = np.full_like(crop_img, 128)
        crop_img_gray_bg = np.where(crop_mask[:, :, None] > 0, crop_img, bg)
        crop_rgb = cv2.cvtColor(crop_img_gray_bg, cv2.COLOR_BGR2RGB)
        
        # Prepare for FashionCLIP
        pil_img = Image.fromarray(crop_rgb)
        pixel_values = processor(images=pil_img, return_tensors="pt")["pixel_values"].to(DEVICE)
        
        # 2. Extract Fine-Tuned Attributes (Phase 2a)
        with torch.no_grad():
            attr_probs = finetuned_model.predict_proba(pixel_values)[0].cpu().numpy()
            
        # FILTER using our strict CONFIDENCE_THRESH
        detected_attributes = [
            {"name": finetune_names[idx], "confidence": round(float(prob), 3)}
            for idx, prob in enumerate(attr_probs) if prob > CONFIDENCE_THRESH
        ]

        # 3. Extract Specific Type via Zero-Shot (Phase 2c)
        specific_type = base_class_name
        zs_confidence = yolo_conf
        
        if base_class_name in ZERO_SHOT_MAP:
            zs_model = zero_shot_models[base_class_name]
            with torch.no_grad():
                image_embeddings = zs_model.backbone.encode_image(pixel_values)
                image_embeddings = image_embeddings / image_embeddings.norm(dim=-1, keepdim=True)
                zs_probs = zs_model.predict_proba(image_embeddings)[0].cpu().numpy()
                
            best_idx = np.argmax(zs_probs)
            specific_type = ZERO_SHOT_MAP[base_class_name][best_idx]
            zs_confidence = float(zs_probs[best_idx])

        # Compile data for Phase 3 LLM
        final_outputs.append({
            "base_geometry": base_class_name,
            "yolo_confidence": round(yolo_conf, 3),
            "specific_item": specific_type,
            "zero_shot_confidence": round(zs_confidence, 3),
            "colors": dominant_colors,
            "attributes": detected_attributes
        })

    return final_outputs

if __name__ == "__main__":
    # Test it on a image
    test_image = "" # Path
    if os.path.exists(test_image):
        results = process_image(test_image)
        print(json.dumps(results, indent=2))
    else:
        print("Please point test_image to a valid image path to test.")