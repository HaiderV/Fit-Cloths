# Fit Cloths — Complete Setup & Integration Guide

This guide provides end-to-end instructions for installing, configuring, running, and integrating all services in the **Fit Cloths** project.

---

## 1. System Architecture & Component Map

The platform consists of five interconnected microservices and a cloud database:

```mermaid
graph TD
    User["Client Browser"] -->|Port 5173| Frontend["Frontend (React + Vite)"]
    Frontend -->|Port 5001 /api| Backend["Backend (Node.js + Express 5)"]
    Backend -->|Port 8000 /search| RAG["RAG Service (FastAPI)"]
    Backend -->|Port 5000 /api/predict-measurements| TailorVision["TailorVision AI (Flask + PyTorch)"]
    Backend -->|Port 11434 /api/chat (SSE Stream)| Ollama["Local LLM (Ollama / Gemma 4)"]
    RAG -->|RPC search_products (pgvector)| Supabase[("Supabase Cloud Database")]
    TailorVision -->|In-Memory Model Fitting| CPU[("Local CPU SMPL-X Engine")]
```

| Service | Port | Directory | Runtime | Function |
| :--- | :---: | :--- | :--- | :--- |
| **Frontend** | `5173` | `frontend/` | Node.js 18+ / Vite | Web Storefront, Measurement Studio, GX Drawer |
| **Backend** | `5001` | `backend/` | Node.js / Express 5 | Gateway, CORS, Multipart Parser, SSE Proxy |
| **TailorVision** | `5000` | `tailoring-grade_anthropometric_Python_tool/` | Python 3.12 (Venv) | 3D SMPL-X Body Fitting & Slicing |
| **RAG API** | `8000` | `AI/` | Python 3.12 (Venv) | MiniLM Embeddings & Supabase Vector RPC |
| **Ollama** | `11434` | System Daemon | Ollama Engine | Gemma 4 2B (`gemma4:e2b`) CPU inference |
| **Database** | Cloud | External | Supabase PostgreSQL | Product catalog and `pgvector` store |

---

## 2. Prerequisites & Toolchain

Before setting up the project, ensure the following are installed on your machine:

1. **Node.js**: `v18.x`, `v20.x`, or `v22.x` (LTS recommended)
   - Verify: `node -v` and `npm -v`
2. **Python**: `3.10` to `3.12` (64-bit)
   - Verify: `python --version`
3. **Ollama**: Download and install from [ollama.com](https://ollama.com/)
   - Pull model: `ollama pull gemma4:e2b`
   - Verify: `ollama list`
4. **Git**: Installed and configured
5. **Supabase Account**: An active Supabase project with `pgvector` enabled

---

## 3. Environment Variables Configuration

Create the respective `.env` files in each service directory.

### A. Root `.env` (Used by FastAPI RAG Service)
Create `Fit-Cloths/.env`:
```ini
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key
```

### B. Backend `.env`
Create `backend/.env`:
```ini
PORT=5001
FLASK_API_URL=http://127.0.0.1:5000
RAG_API_URL=http://127.0.0.1:8000
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=gemma4:e2b

# Supabase Credentials
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_secret_key
```

### C. Frontend `.env`
Create `frontend/.env`:
```ini
VITE_API_BASE_URL=http://localhost:5001
```

### D. AI Service `.env`
Create `AI/.env`:
```ini
FLASK_PORT=5000
FLASK_HOST=127.0.0.1
OLLAMA_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=gemma4:e2b
```

---

## 4. Step-by-Step Installation

### Step 4.1: Install Node Dependencies
Open PowerShell:

```powershell
# 1. Install Backend Dependencies
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths\backend
npm install

# 2. Install Frontend Dependencies
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths\frontend
npm install
```

### Step 4.2: Setup Python Virtual Environments

#### 1. TailorVision Measurement Service
```powershell
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths\tailoring-grade_anthropometric_Python_tool

# Create virtualenv if not already created
python -m venv .venv

# Activate virtualenv
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt
```

*Note: Ensure SMPL-X model files exist in `models/smplx/` (`SMPLX_MALE.pkl`, `SMPLX_FEMALE.pkl`, `SMPLX_NEUTRAL.pkl`).*

#### 2. FastAPI RAG Service
```powershell
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths\AI

# Create virtualenv if not already created
python -m venv .venv

# Activate virtualenv
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt
```

---

## 5. Supabase Vector Database Setup

If configuring a new Supabase database, execute the following SQL in the Supabase **SQL Editor**:

```sql
-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price_inr NUMERIC NOT NULL,
    fabric_composition TEXT,
    fit_type TEXT,
    description TEXT,
    image_urls TEXT[],
    embedding vector(384),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create HNSW vector search index
CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx 
ON products 
USING hnsw (embedding vector_cosine_ops);

-- 4. Create vector matching RPC function
CREATE OR REPLACE FUNCTION search_products(
    query_embedding vector(384),
    match_count int DEFAULT 5,
    max_price numeric DEFAULT NULL,
    category_filter text DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    product_code TEXT,
    name TEXT,
    category TEXT,
    price_inr NUMERIC,
    fabric_composition TEXT,
    fit_type TEXT,
    description TEXT,
    image_urls TEXT[],
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.product_code,
        p.name,
        p.category,
        p.price_inr,
        p.fabric_composition,
        p.fit_type,
        p.description,
        p.image_urls,
        1 - (p.embedding <=> query_embedding) AS similarity
    FROM products p
    WHERE
        (max_price IS NULL OR p.price_inr <= max_price)
        AND (category_filter IS NULL OR LOWER(p.category) = LOWER(category_filter))
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

---

## 6. How to Run All Services

Open 5 separate PowerShell windows (or terminal tabs) and run each service:

### Terminal 1: Ollama Server
```powershell
ollama run gemma4:e2b
```
*(Keep this running. Ollama loads the model into RAM with `keep_alive: 60m`.)*

### Terminal 2: FastAPI RAG Service (Port 8000)
```powershell
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths\AI
.\.venv\Scripts\Activate.ps1
uvicorn rag_api:app --host 0.0.0.0 --port 8000
```
*(Verify health: `http://127.0.0.1:8000/health`)*

### Terminal 3: TailorVision Measurement Engine (Port 5000)
```powershell
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths\tailoring-grade_anthropometric_Python_tool
.\.venv\Scripts\Activate.ps1
python app.py
```
*(Verify online: `http://127.0.0.1:5000/`)*

### Terminal 4: Node.js Express Gateway (Port 5001)
```powershell
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths\backend
npm run dev
```
*(Verify status: `http://localhost:5001/api/measurements/status`)*

### Terminal 5: Vite React Storefront (Port 5173)
```powershell
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths\frontend
npm run dev
```

Open your browser and navigate to: **`http://localhost:5173`**.

---

## 7. Key API Endpoints & Request Contracts

### A. Health & Status Checks
- `GET http://localhost:5001/api/measurements/status`: Probes Express-to-Flask communication.
- `GET http://127.0.0.1:8000/health`: Verifies RAG vector embedding service.

### B. Body Measurement Prediction
- **Endpoint**: `POST http://localhost:5001/api/measurements/predict`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `front_image`: Frontal body photo (JPEG, PNG, WebP)
  - `side_image`: Side profile photo (JPEG, PNG, WebP)
  - `height_cm`: Subject height in centimeters (e.g. `178`)
  - `gender`: Prior (`male`, `female`, or `neutral`)
  - `garment_type`: Garment for ease calculation (e.g. `traditional`, `suit`, `casual`)
- **Headers (Optional)**:
  - `X-Correlation-ID`: Trace request lifecycle across Node and Python logs.

### C. Conversational RAG AI Agent
- **Endpoint**: `POST http://localhost:5001/api/ai/chat?stream=true`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "message": "Recommend lightweight linen shirts under 3000",
    "max_price": 3000,
    "category": "Shirts"
  }
  ```
- **Stream Events (SSE)**:
  - `event: token` -> Streamed text chunk from Gemma
  - `event: products` -> Array of matching product cards
  - `event: done` -> Final execution duration and metrics

---

## 8. Verification & Performance Benchmarking

Run the included automated benchmark script to test both pipelines end-to-end:

```powershell
cd c:\Users\haide\OneDrive\Documents\Fit-Cloths
tailoring-grade_anthropometric_Python_tool\.venv\Scripts\python.exe scratch\benchmark_end_to_end.py
```

### Expected Benchmark Results:
- **Warm TailorVision Prediction**: `~12.4s – 13.1s` (Under the 15s threshold on CPU)
- **Warm RAG Chat Response**: `~8.1s – 9.6s` (Under the 15s threshold)
- **Time to First Visible Token (TTFT)**: `~0.38s` (Instant streaming response)

---

## 9. Troubleshooting & FAQ

1. **Port In Use (`EADDRINUSE: 5000` or `5001`)**:
   - TailorVision runs on port **5000**. Express runs on port **5001**.
   - Check listening processes:
     ```powershell
     Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 5000, 5001, 8000 }
     ```

2. **Ollama Streaming Shows Empty Text**:
   - Ensure `"think": false` is present in `ollamaPayload` inside `backend/routes/ai.js`. Gemma 4 defaults to internal reasoning tokens if thinking mode is active.

3. **Photo Validation Returns 422 Unprocessable Entity**:
   - The deterministic computer vision validator requires the entire subject from head to feet to be in frame.
   - If feet or head are cropped by the camera frame edge, the validator intentionally rejects the photo to prevent erroneous measurement scaling. Step back and ensure full body framing.

4. **MediaPipe / Windows DLL Warnings**:
   - TensorFlow Lite XNNPACK logs (`landmark_projection_calculator.cc:81`) are informational notices and do not affect inference accuracy.
