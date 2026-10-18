
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    raise RuntimeError("Missing Supabase credentials in root .env")

supabase = create_client(supabase_url, supabase_key)

# Must match the model used to embed the catalogue.
model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2",
    device="cpu"
)

app = FastAPI(title="Fit Cloths Product RAG")


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    max_price: float | None = Field(default=None, gt=0)
    category: str | None = Field(default=None, max_length=100)
    match_count: int = Field(default=5, ge=1, le=10)


@app.get("/health")
def health():
    return {"status": "ok", "service": "fit-cloths-rag"}


@app.post("/search")
def search_products(request: SearchRequest):
    try:
        vector = model.encode(
            request.query,
            normalize_embeddings=True
        ).tolist()

        result = supabase.rpc(
            "search_products",
            {
                "query_embedding": vector,
                "match_count": request.match_count,
                "max_price": request.max_price,
                "category_filter": request.category,
            }
        ).execute()

        return {
            "query": request.query,
            "count": len(result.data or []),
            "products": result.data or [],
        }

    except Exception as exc:
        # Log full details in the server terminal, not to customers.
        print("RAG search failed:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Product search failed. Check the RAG server logs."
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag_api:app", host="127.0.0.1", port=8000, reload=True)
