"""Workshop drills for Erebus."""
from . import cowork_integration as _notes


def train(topic: str) -> str:
    topic = (topic or "").strip()
    if not topic:
        return "[WORKSHOP] topic required"
    _notes.note(f"workshop: {topic}")
    return f"[WORKSHOP] drill queued: {topic}"
