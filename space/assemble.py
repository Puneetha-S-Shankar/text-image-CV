"""Put together everything the Hugging Face Space needs into one folder, ready to upload.

    python space/assemble.py --config <cascade_config_lowmem.json> --out <folder> [--requirements <pinned.txt>]

The folder gets: app.py, safety.py, Dockerfile, README.md, requirements.txt (pinned if given), the three engine
modules from src/, the cascade config, and the frontend SOURCE (the Space builds it on Linux, see Dockerfile).
Notebook 03b runs this and uploads the result; you can also run it yourself and upload the folder by hand.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SPACE_FILES = ["app.py", "safety.py", "Dockerfile", "README.md"]
MODULES = ["p3_classical.py", "p3_semantic.py", "p3_engine.py"]
FRONTEND_SKIP = {"node_modules", ".next", "out", ".vscode", "next-env.d.ts"}
CONFIG_NAMES = {"cascade_config_lowmem.json", "cascade_config.json"}


def assemble(config: Path, out: Path, requirements: Path | None = None) -> Path:
    if config.name not in CONFIG_NAMES:
        raise ValueError(f"config must be named one of {sorted(CONFIG_NAMES)}, got {config.name}")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for f in SPACE_FILES:
        shutil.copy2(REPO / "space" / f, out / f)
    shutil.copy2(requirements or REPO / "space" / "requirements.txt", out / "requirements.txt")
    for f in MODULES:
        shutil.copy2(REPO / "src" / f, out / f)
    shutil.copy2(config, out / config.name)
    shutil.copytree(REPO / "frontend", out / "frontend",
                    ignore=lambda d, names: [n for n in names if n in FRONTEND_SKIP or n.endswith(".tsbuildinfo")])
    (out / ".dockerignore").write_text("frontend/node_modules\nfrontend/.next\nfrontend/out\n", encoding="utf-8")
    n = sum(1 for p in out.rglob("*") if p.is_file())
    print(f"Assembled {n} files into {out} (config: {config.name})")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--requirements", type=Path, default=None)
    a = ap.parse_args()
    assemble(a.config, a.out, a.requirements)
