# Hosting: how this goes live

**Decision (team):** one Hugging Face Space on a paid **T4** GPU serves **both** this web app and the
generation API from the same address. One link, no cross-site requests, and the timer in the app matches the T4
numbers in our report.

```
phone ──https──▶  <user>-<space>.hf.space
                   ├── /            → out/index.html        (this app: static files)
                   ├── /compare/    → out/compare/index.html
                   ├── /_next/...   → out/_next/...          (JS/CSS, cache forever)
                   └── /api/*       → Python backend on the T4 (model + checks)
```

## What the frontend hands over

`npm run build` → the **`out/`** folder (≈ 1–2 MB). That folder is the whole website. The `postbuild` step
(`scripts/fix-static-export.mjs`) runs automatically and fixes prefetch file names when built on Windows.

## What the backend does with it (for the backend person)

FastAPI example (`app.py` in the Space). The API routes must be registered **before** the static mount:

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

@app.get("/api/health")
def health(): ...

@app.post("/api/generate")
def generate(req: GenerateRequest): ...

# Last: everything else is the website. html=True serves index.html for folders and 404.html for unknown paths.
app.mount("/", StaticFiles(directory="static", html=True), name="site")
```

Space layout (Docker SDK, listens on port **7860**):

```
space/
├── Dockerfile
├── app.py
├── requirements.txt
└── static/        ← contents of frontend/out/
```

**Alternative (recommended once things settle):** build the frontend _inside_ the Docker image, so nobody has to
copy `out/` by hand:

```dockerfile
FROM node:24-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
# ... install the model's requirements ...
COPY --from=web /web/out /app/static
```

**Nice to have:** send `Cache-Control: public, max-age=31536000, immutable` for `/_next/static/*` (file names
contain hashes) and `no-cache` for HTML. The mock's `--static` mode already does this, so you can compare.

## Rehearse it locally (no GPU needed)

```bash
npm run preview
```

This builds the site and serves `out/` plus the mock API from **one** address, http://localhost:8080. That's the
same setup as the Space. If it works there, it will work on the Space.

## Before the demo

- [ ] Space hardware set to **T4**, sleep time long enough that it won't nap during judging
- [ ] Open the link once ~5 minutes before judging (model loads, warm-up picture runs)
- [ ] Status pill says **Ready · Tesla T4**
- [ ] Try it on a phone over mobile data (not just Wi-Fi)
- [ ] "Add to Home Screen" works and opens full-screen
