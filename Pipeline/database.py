import json
import numpy as np
import faiss
import os

class FashionDatabase:
    def __init__(self, jsonl_path: str):
        self.items = []
        self.index = None
        self.dimension = 512  # FashionCLIP outputs 512-dimensional vectors
        self._load_data(jsonl_path)

    def _load_data(self, path: str):
        if not os.path.exists(path):
            print(f"❌ Warning: Database file '{path}' not found!")
            return

        print(f"Loading catalog and building FAISS index from {path}...")
        embeddings = []
        
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): 
                    continue
                
                item = json.loads(line)
                
                # Only load items that successfully passed your Phase 1+2 pipeline
                if item.get("cv_status") == "ok" and "embedding" in item:
                    self.items.append(item)
                    embeddings.append(item["embedding"])

        if not embeddings:
            print("❌ No valid embeddings found in the database.")
            return

        # FAISS requires numpy arrays in float32 format
        emb_matrix = np.array(embeddings, dtype=np.float32)

        # Because your Phase 2 script already L2-normalized the embeddings, 
        # an Inner Product (IP) search behaves exactly like Cosine Similarity.
        self.index = faiss.IndexFlatIP(self.dimension)
        self.index.add(emb_matrix)
        
        print(f"✅ Successfully loaded {len(self.items)} items into FAISS memory.")

    def search_by_embedding(self, query_embedding: list, top_k: int = 3) -> list:
        """
        Takes a 512-dim embedding (from an image or text query) and returns the closest items.
        """
        if self.index is None or not self.items:
            return []

        # Format the query for FAISS (1, 512)
        query_np = np.array([query_embedding], dtype=np.float32)

        # Perform the search
        distances, indices = self.index.search(query_np, top_k)

        results = []
        for idx, dist in zip(indices[0], distances[0]):
            if idx != -1:  # -1 means no result found
                item_match = self.items[idx].copy()
                item_match["similarity_score"] = round(float(dist), 3)
                
                # CRITICAL: Delete the 512-number array from the dictionary 
                # before returning it, so we don't accidentally send massive 
                # walls of text to Gemini or the Next.js frontend!
                item_match.pop("embedding", None)
                
                results.append(item_match)

        return results