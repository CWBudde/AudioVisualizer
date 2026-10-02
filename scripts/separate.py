"""Run seeded local Demucs inference and record its provenance."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import random
import time

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
os.environ["HF_HOME"] = str(ROOT / ".cache/huggingface")
os.environ["TORCH_HOME"] = str(ROOT / ".cache/torch")
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"

import numpy as np
import torch
from demucs.separate import main

random.seed(42)
np.random.seed(42)
torch.manual_seed(42)
torch.set_num_threads(4)
args = ["-n", "htdemucs", "--repo", ".cache/models", "-d", "cpu", "--shifts", "1", "--float32",
        "--clip-mode", "none", "-o", "analysis/stems", "public/audio/PixelParade.wav"]
packages = ["demucs", "torch", "numpy", "einops", "julius", "lameenc", "sphn",
            "huggingface-hub", "safetensors", "pyyaml", "tqdm"]
started = time.time()
metadata = {"model": "htdemucs", "device": "cpu", "seed": 42,
            "arguments": args, "clipMode": "none", "python": platform.python_version(),
            "versions": {p: importlib.metadata.version(p) for p in packages}}
try:
    main(args)
    metadata["status"] = "complete"
except Exception as exc:
    metadata["status"] = "failed"
    metadata["error"] = str(exc)
    raise
finally:
    metadata["elapsedSeconds"] = round(time.time() - started, 3)
    metadata["modelFiles"] = [{"path": str(p.relative_to(ROOT)),
                                "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                               for p in sorted((ROOT / ".cache/models").glob("*")) if p.is_file()]
    (ROOT / "analysis/separation.json").write_text(json.dumps(metadata, indent=2) + "\n")
