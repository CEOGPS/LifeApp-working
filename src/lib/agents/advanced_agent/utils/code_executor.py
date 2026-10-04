"""Run a short Python snippet for Erebus. Local only, 15 second cap."""
import subprocess
import sys


def run(code: str) -> str:
    code = (code or "").strip()
    if not code:
        return "[CODE] code required"
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        timeout=15,
    )
    out = (result.stdout or result.stderr or "(no output)").strip()
    return f"[CODE exit {result.returncode}] {out[:2000]}"
