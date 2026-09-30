# LunarSync backend

FastAPI wrapper around the notebook registration search.

- **USER_IMAGE** — uploaded source frame (`POST /jobs` or `POST /match`)
- **DATABASE_FOLDER** — `Images/` at the repo root (override with `REFERENCE_FOLDER`)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then run the friend's UI from `frontend/` (`bun dev` / `npm run dev`). Uploads on `/jobs` are proxied to this API.
