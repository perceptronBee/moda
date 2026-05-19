"""
FashionCLIP Attribute Model

I Bypassesed HuggingFace transformers because of bugs, It may be implemented with it.
"""

import torch
import torch.nn as nn
import open_clip

EMBED_DIM = 512   # ViT-B-16 output dim

class AttributeModel(nn.Module):
    def __init__(
        self,
        num_classes:     int,
        unfreeze_blocks: int   = 1,
        dropout:         float = 0.4,
        device:          str   = "cuda",
    ):
        super().__init__()
        self.device_str = device

        print("  Loading Marqo-FashionCLIP natively via open_clip...")
        # Loads directly from the Hub using open_clip, bypassing HF bugs
        self.backbone = open_clip.create_model(
            'hf-hub:Marqo/marqo-fashionCLIP', 
            device=device
        ).float()

        # Freeze everything first
        for param in self.backbone.parameters():
            param.requires_grad = False

        # Unfreeze last N transformer blocks using open_clip's architecture mapping
        if unfreeze_blocks > 0:
            layers = self.backbone.visual.transformer.resblocks
            n      = len(layers)
            for layer in layers[n - unfreeze_blocks:]:
                for param in layer.parameters():
                    param.requires_grad = True
            
            # Unfreeze post-layer norm
            for param in self.backbone.visual.ln_post.parameters():
                param.requires_grad = True
                
            # Unfreeze the projection matrix (if it exists)
            if hasattr(self.backbone.visual, "proj") and self.backbone.visual.proj is not None:
                self.backbone.visual.proj.requires_grad = True
                
            print(f"  Unfroze last {unfreeze_blocks} FashionCLIP vision blocks")

        self.head = nn.Sequential(

            nn.LayerNorm(EMBED_DIM),
            nn.Linear(EMBED_DIM, 256),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(256, num_classes),
        )
        self.num_classes = num_classes

    def encode_image(self, pixel_values: torch.Tensor) -> torch.Tensor:
        """Returns L2-normalized image embeddings (B, 512)."""
        # open_clip natively returns the correct tensor
        outputs  = self.backbone.encode_image(pixel_values)
        features = outputs / outputs.norm(dim=-1, keepdim=True)
        return features

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        features = self.encode_image(pixel_values)
        return self.head(features)

    def predict_proba(self, pixel_values: torch.Tensor) -> torch.Tensor:
        with torch.no_grad():
            return torch.sigmoid(self.forward(pixel_values))

    def predict(self, pixel_values: torch.Tensor, threshold: float = 0.40) -> torch.Tensor:
        return (self.predict_proba(pixel_values) > threshold).float()


class ZeroShotAttributeModel:
    

    PROMPT_TEMPLATES = [

        "a photo of a {} garment",
        "a {} piece of clothing",
        "clothing with a {} pattern",
        "a {} style outfit",
        "a garment that is {}",
    ]

    def __init__(self, attribute_names: list[str], device: str = "cuda"):

        self.device          = device
        self.attribute_names = attribute_names

        print(f"  Loading FashionCLIP for zero-shot ({len(attribute_names)} attributes)...")
        self.backbone = open_clip.create_model('hf-hub:Marqo/marqo-fashionCLIP', device=device).float()
        self.backbone.eval()
        
        # open_clip has its own dedicated tokenizer
        self.tokenizer = open_clip.get_tokenizer('hf-hub:Marqo/marqo-fashionCLIP')

        self.text_embeddings = self._compute_text_embeddings(attribute_names)
        print(f"  Text embeddings shape: {self.text_embeddings.shape}")

    def _compute_text_embeddings(self, names: list[str]) -> torch.Tensor:
        
        all_embeddings = []
        with torch.no_grad():

            for name in names:
                template_embs = []
                for template in self.PROMPT_TEMPLATES:

                    prompt = template.format(name)
                    # open_clip tokenizer outputs the tensor directly
                    inputs = self.tokenizer([prompt]).to(self.device)
                    emb    = self.backbone.encode_text(inputs)
                    emb    = emb / emb.norm(dim=-1, keepdim=True)
                    template_embs.append(emb)
                    
                avg = torch.stack(template_embs).mean(dim=0)
                avg = avg / avg.norm(dim=-1, keepdim=True)
                all_embeddings.append(avg)

        return torch.cat(all_embeddings, dim=0)   # (N, 512)

    @torch.no_grad()

    def predict_proba(self, image_embeddings: torch.Tensor) -> torch.Tensor:
        sims = image_embeddings @ self.text_embeddings.T
        return (sims + 1) / 2   

    @torch.no_grad()
    def predict(self, image_embeddings: torch.Tensor, threshold: float = 0.62) -> torch.Tensor:
        return (self.predict_proba(image_embeddings) > threshold).float()