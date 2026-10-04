# ============================================================
# kokoro-server.py - Local Kokoro-82M TTS server for Erebus
#
# Endpoints:
#   GET  /health  -> {"ok": true, "service": "kokoro-tts"}
#   POST /tts     -> audio/wav (24 kHz mono)
#        body: { "text": str, "voice": "af_heart", "speed": 1.0, "lang_code": "a" }
#
# Run from the repo root (the file name has a hyphen, so run it as a script,
# not as `uvicorn kokoro-server:app`):
#   python kokoro-server.py            # listens on 127.0.0.1:8880
#
# Env (optional, read from <repo>/.env.local if python-dotenv is installed):
#   KOKORO_PORT  (default 8880)
#   KOKORO_HOST  (default 127.0.0.1)
#
# Kokoro pipelines are lazy-loaded per lang_code on first request and cached.
# The first request downloads the model weights from Hugging Face (~330 MB).
# Kokoro uses espeak-ng for out-of-dictionary words; on Windows install the
# espeak-ng MSI if you see phonemizer/espeak errors.
# ============================================================

import io
import os
import threading
from pathlib import Path
from typing import Any, Dict

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parent

# -- .env.local (optional) ----------------------------------------------------
try:
    from dotenv import load_dotenv

    _ENV_LOCAL = REPO_ROOT / ".env.local"
    if _ENV_LOCAL.exists():
        load_dotenv(_ENV_LOCAL)
except ImportError:  # python-dotenv not installed; env vars still work
    pass

PORT = int(os.getenv("KOKORO_PORT", "8880"))
HOST = os.getenv("KOKORO_HOST", "127.0.0.1")
SAMPLE_RATE = 24000

# -- Kokoro import (kept soft so /health still answers if it's missing) ------
try:
    from kokoro import KPipeline  # type: ignore

    KOKORO_IMPORT_ERROR = None
except Exception as e:  # pragma: no cover - depends on local install
    KPipeline = None  # type: ignore
    KOKORO_IMPORT_ERROR = e

_pipelines: Dict[str, Any] = {}
_pipeline_lock = threading.Lock()
_synth_lock = threading.Lock()


def get_pipeline(lang_code: str):
    """Lazy-load one KPipeline per lang_code and cache it."""
    if KPipeline is None:
        raise RuntimeError(f"kokoro is not importable: {KOKORO_IMPORT_ERROR}")
    with _pipeline_lock:
        pipeline = _pipelines.get(lang_code)
        if pipeline is None:
            print(f"  [kokoro] loading pipeline lang_code={lang_code!r} ...")
            pipeline = KPipeline(lang_code=lang_code)
            _pipelines[lang_code] = pipeline
            print(f"  [kokoro] pipeline {lang_code!r} ready")
        return pipeline


def _to_numpy(audio: Any) -> np.ndarray:
    if audio is None:
        return np.zeros(0, dtype=np.float32)
    if hasattr(audio, "detach"):  # torch.Tensor
        audio = audio.detach().cpu().numpy()
    return np.asarray(audio, dtype=np.float32).reshape(-1)


# -- App ----------------------------------------------------------------------
app = FastAPI(title="Erebus Kokoro TTS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = 1.0
    lang_code: str = "a"


@app.get("/health")
def health():
    return {"ok": True, "service": "kokoro-tts"}


@app.post("/tts")
def tts(req: TTSRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    try:
        pipeline = get_pipeline(req.lang_code)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Kokoro unavailable: {e}")

    try:
        segments = []
        with _synth_lock:
            for _graphemes, _phonemes, audio in pipeline(
                text, voice=req.voice, speed=req.speed
            ):
                chunk = _to_numpy(audio)
                if chunk.size:
                    segments.append(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {e}")

    if not segments:
        raise HTTPException(status_code=500, detail="Kokoro produced no audio")

    wav = np.concatenate(segments)
    buf = io.BytesIO()
    sf.write(buf, wav, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return Response(content=buf.getvalue(), media_type="audio/wav")


# -- Entry point --------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    if KOKORO_IMPORT_ERROR is None:
        model_status = "kokoro importable; pipelines load lazily on first /tts"
    else:
        model_status = f"kokoro NOT importable ({KOKORO_IMPORT_ERROR}); /tts will return 503"

    print("\n  ============================================")
    print("  Erebus Kokoro TTS")
    print(f"  Listening: http://{HOST}:{PORT}")
    print(f"  Model:     {model_status}")
    print(f"  Sample rate: {SAMPLE_RATE} Hz")
    print("  ============================================\n")
    uvicorn.run(app, host=HOST, port=PORT, reload=False)
