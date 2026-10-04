"""Cowork notes for Erebus. Stored locally until a cowork API is configured."""
import json
from pathlib import Path

STORE = Path.home() / ".lifeos" / "cowork_notes.json"


def note(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return "[COWORK] note required"
    rows = []
    if STORE.exists():
        try:
            rows = json.loads(STORE.read_text(encoding="utf-8"))
        except Exception:
            rows = []
    rows.append(text)
    STORE.parent.mkdir(parents=True, exist_ok=True)
    STORE.write_text(json.dumps(rows[-100:], ensure_ascii=False, indent=2), encoding="utf-8")
    return f"[COWORK] saved note ({len(rows)} total)"
