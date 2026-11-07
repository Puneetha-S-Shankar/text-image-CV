"""P3 Studio backend: one FastAPI server on the T4 Hugging Face Space.

It serves BOTH the phone app (the frontend's static files, in ./static) and the generation API, from one address.
The API follows frontend/docs/API_CONTRACT.md exactly:
    GET  /api/health     model loading / ready
    POST /api/generate   prompt + mode -> picture + timing + checks + retry history

Run locally (from the repo root):   cd space && uvicorn app:app --port 7860
Environment variables (all optional):
    P3_CONFIG      path to the cascade config (default: ./cascade_config_lowmem.json, then ./cascade_config.json)
    P3_SETUP       override the generator setup: "M3" | "M2" | "fp16"
    P3_MOCK=1      no GPU needed: fake pictures, real checks (to try the app on a free CPU Space)
    P3_STATIC      folder with the built frontend (default ./static)
    P3_MAX_QUEUE   requests allowed to wait for the GPU before answering BUSY (default 6)
"""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import sys
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

HERE = Path(__file__).resolve().parent
for _p in (HERE, HERE.parent / "src"):  # in the Space the modules sit next to app.py; in the repo they're in src/
    if (_p / "p3_engine.py").exists():
        sys.path.insert(0, str(_p))
        break

import safety  # noqa: E402

PROMPT_MAX_CHARS = 400
MODES = ("fast", "balanced", "quality")
MOCK = os.environ.get("P3_MOCK") == "1"
MAX_QUEUE = int(os.environ.get("P3_MAX_QUEUE", "6"))
STATIC_DIR = Path(os.environ.get("P3_STATIC", HERE / "static"))
CONFIG_CANDIDATES = [os.environ.get("P3_CONFIG"), HERE / "cascade_config_lowmem.json", HERE / "cascade_config.json"]

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("font/woff2", ".woff2")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("p3")

STATE = {"engine": None, "error": None, "started": time.time(), "queue": 0, "config": None}
GPU_LOCK = threading.Lock()  # one picture at a time on the GPU
QUEUE_LOCK = threading.Lock()


def load_engine():
    """Runs in a background thread at start-up, so /api/health can answer "loading" meanwhile."""
    try:
        import torch

        if not MOCK and not torch.cuda.is_available():
            raise RuntimeError("No GPU attached. In the Space settings choose a T4, or set P3_MOCK=1 to try without one.")
        cfg_path = next((Path(p) for p in CONFIG_CANDIDATES if p and Path(p).exists()), None)
        if cfg_path is None:
            raise FileNotFoundError("cascade_config_lowmem.json / cascade_config.json not found next to app.py")
        import p3_engine as pe

        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        t0 = time.time()
        engine = pe.Engine(cfg, setup=os.environ.get("P3_SETUP") or None, mock=MOCK,
                           log=lambda *a: log.info(" ".join(map(str, a))))
        engine.warm_up()
        STATE.update(engine=engine, config=cfg_path.name)
        log.info("Ready in %.0f s: %s on %s (config %s)", time.time() - t0, engine.model_name, engine.gpu_name,
                 cfg_path.name)
    except Exception as e:  # keep serving /api/health so the app can say what's wrong
        log.exception("The engine failed to load")
        STATE["error"] = f"{type(e).__name__}: {e}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=load_engine, daemon=True).start()
    yield


app = FastAPI(title="P3 Studio API", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
# The phone app is served from this same address (no CORS needed). Open CORS only helps local development
# (frontend dev server on :3000 pointed at this backend). No cookies or credentials are ever used.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
                   max_age=86400)


def error(status: int, code: str, message: str, retry_after_s: int | None = None) -> JSONResponse:
    body = {"code": code, "message": message}
    if retry_after_s is not None:
        body["retry_after_s"] = int(retry_after_s)
    return JSONResponse({"error": body}, status_code=status)


@app.get("/api/health")
def health():
    engine = STATE["engine"]
    body = {
        "ready": engine is not None,
        "status": "ready" if engine is not None else "loading",
        "model": engine.model_name if engine else "SANA-Sprint 0.6B (loading)",
        "gpu": engine.gpu_name if engine else "",
        "uptime_s": int(time.time() - STATE["started"]),
        "queue": STATE["queue"],
    }
    if MOCK:
        body["mock"] = True
    if STATE["error"]:
        body["error"] = STATE["error"]  # optional extra field (allowed by the contract)
    return body


def _run_on_gpu(engine, prompt: str, mode: str, seed: int | None) -> dict:
    with GPU_LOCK:
        return engine.run(prompt, mode, seed)


@app.post("/api/generate")
async def generate(request: Request):
    t_arrived = time.perf_counter()
    try:
        body = await request.json()
    except Exception:
        body = None
    if not isinstance(body, dict):
        return error(400, "EMPTY_PROMPT", 'Send JSON like {"prompt": "...", "mode": "balanced"}.')
    prompt = body.get("prompt").strip() if isinstance(body.get("prompt"), str) else ""
    mode = body.get("mode", "balanced")
    seed = body.get("seed")
    if not (isinstance(seed, int) and not isinstance(seed, bool) and 0 <= seed < 2**31):
        seed = None

    engine = STATE["engine"]
    if engine is None:
        if STATE["error"]:
            return error(500, "INTERNAL", "The server couldn't load the model. Please tell the team.")
        return error(503, "WARMING_UP", "The model is still loading. Try again in a few seconds.", retry_after_s=15)
    if not prompt:
        return error(400, "EMPTY_PROMPT", "Type something to draw first.")
    if len(prompt) > PROMPT_MAX_CHARS:
        return error(400, "PROMPT_TOO_LONG", f"Keep the prompt under {PROMPT_MAX_CHARS} characters.")
    if mode not in MODES:
        return error(400, "BAD_MODE", "Mode must be fast, balanced or quality.")
    if not safety.is_allowed(prompt):
        return error(422, "UNSAFE_PROMPT", "This prompt isn't allowed. Please try something else.")

    with QUEUE_LOCK:
        if STATE["queue"] >= MAX_QUEUE:
            return error(429, "BUSY", "Lots of people are drawing right now. Try again shortly.",
                         retry_after_s=2 * STATE["queue"])
        STATE["queue"] += 1
    try:
        result = await run_in_threadpool(_run_on_gpu, engine, prompt, mode, seed)
    except Exception as e:
        log.exception("generation failed")
        if "out of memory" in str(e).lower():
            return error(500, "INTERNAL", "The GPU ran out of memory on this one. Please try again.")
        return error(500, "INTERNAL", "Something went wrong on the server. Please try again.")
    finally:
        with QUEUE_LOCK:
            STATE["queue"] -= 1

    result["id"] = uuid.uuid4().hex[:8]
    result["timing"]["total_s"] = round(time.perf_counter() - t_arrived, 3)  # includes any wait for the GPU
    # Log the request shape only, never the prompt text.
    log.info("generate mode=%s chars=%d tries=%d passed=%s total=%.2fs", mode, len(prompt), len(result["attempts"]),
             result["passed"], result["timing"]["total_s"])
    return result


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def unknown_api(rest: str):
    return error(404, "INTERNAL", f"No such endpoint: /api/{rest}")


class SiteFiles(StaticFiles):
    """The built phone app. Hashed JS/CSS can be cached forever; HTML must always be re-checked."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if path.startswith("_next/static/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers.setdefault("Cache-Control", "no-cache")
        return response


if STATIC_DIR.is_dir():
    # Last: everything that isn't /api/* is the website. html=True serves index.html for folders and 404.html
    # for unknown paths, matching the frontend's `trailingSlash: true` static export.
    app.mount("/", SiteFiles(directory=STATIC_DIR, html=True), name="site")
else:

    @app.get("/")
    def no_frontend():
        return {"message": "P3 Studio API is running. The phone app isn't built into ./static yet.",
                "endpoints": ["GET /api/health", "POST /api/generate", "GET /api/docs"]}
