"""Run notebook 03b inside the SAME Kaggle session as notebook 03a.

Why: 03a just downloaded the model and wrote cascade_config_lowmem.json; reusing the session skips a second
download and the "unzip + push" step. 03b's server runs on the SECOND T4 ("GPU T4 x2"), so 03a's kernel can keep
the first one.

In a new Kaggle cell after 03a has finished:
    !git -C /kaggle/working/text-image-CV pull -q && python /kaggle/working/text-image-CV/scripts/run_03b_on_kaggle.py
"""

import os
import subprocess
import sys
from pathlib import Path

W = Path("/kaggle/working")
REPO = W / "text-image-CV"
env = {
    **os.environ,
    "CUDA_VISIBLE_DEVICES": os.environ.get("P3_03B_GPU", "1"),  # the second T4
    "P3_REPO_DIR": str(REPO),  # use this checkout as it is
    "P3_SHARED": str(REPO / "results" / "02b" / "shared"),  # where 03a wrote cascade_config_lowmem.json
    "P3_02B_OUT": str(REPO / "results" / "02b"),
    "P3_OUT": str(W / "03b_out"),
}
config = Path(env["P3_SHARED"]) / "cascade_config_lowmem.json"
print("03a's low-memory config:", "found" if config.exists() else "MISSING: 03b will test the float16 model", flush=True)
print("Running notebook 03b on GPU", env["CUDA_VISIBLE_DEVICES"], "(~10-15 min, no live output)...", flush=True)
result = subprocess.run(
    [sys.executable, "-m", "jupyter", "nbconvert", "--to", "notebook", "--execute",
     str(REPO / "notebooks" / "P3_03b_backend.ipynb"), "--output", str(W / "03b_executed.ipynb"),
     "--ExecutePreprocessor.timeout=-1"],
    env=env,
)
summary = W / "03b_out" / "03b_summary.md"
print(summary.read_text(encoding="utf-8") if summary.exists() else
      "No summary written: open /kaggle/working/03b_executed.ipynb and 03b_out/server.log to see what failed.")
sys.exit(result.returncode)
