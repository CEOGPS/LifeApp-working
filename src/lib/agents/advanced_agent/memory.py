# ============================================================
# Erebus Memory — Persistent episodic + semantic memory
# Storage: JSON file (upgradeable to SQLite/Redis)
# ============================================================

import json
import os
import re
from datetime import datetime
from pathlib import Path


MEMORY_FILE = Path(__file__).parent.parent / "erebus_memory.json"
MAX_SESSION  = 100
MAX_FACTS    = 500


class ErebusMemory:
    def __init__(self, path: Path = MEMORY_FILE):
        self.path = path
        self.data = self._load()

    def _load(self) -> dict:
        try:
            if self.path.exists():
                with open(self.path, encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return {
            "facts":       {},
            "reflections": [],
            "session":     [],
            "goals":       [],
            "leads":       [],
        }

    def save(self):
        try:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[Memory] Save error: {e}")

    # ── Session memory (short-term) ───────────────────────────────────────────

    def remember(self, role: str, text: str):
        self.data["session"].append({
            "role":    role,
            "content": text,
            "ts":      datetime.utcnow().isoformat(),
        })
        if len(self.data["session"]) > MAX_SESSION:
            self.data["session"] = self.data["session"][-MAX_SESSION:]
        self.save()

    def get_session(self, last_n: int = 20) -> list:
        return self.data["session"][-last_n:]

    def clear_session(self):
        self.data["session"] = []
        self.save()

    # ── Long-term facts (semantic memory) ────────────────────────────────────

    def learn(self, key: str, value: str):
        self.data["facts"][key.strip()] = value.strip()
        if len(self.data["facts"]) > MAX_FACTS:
            # Drop oldest 50
            keys = list(self.data["facts"].keys())
            for k in keys[:50]:
                del self.data["facts"][k]
        self.save()

    def get_facts(self, limit: int = 30) -> dict:
        items = list(self.data["facts"].items())
        return dict(items[-limit:])

    def extract_and_learn(self, text: str):
        """Auto-parse FACT: key = value  or  REMEMBER_FACT: key=X value=Y patterns."""
        patterns = [
            r'^(?:LEARN_FACT|REMEMBER_FACT|FACT):\s*key=([^\s,]+)[,\s]+value=(.+)$',
            r'^(?:LEARN_FACT|REMEMBER_FACT|FACT):\s*(.+?)\s*=\s*(.+)$',
        ]
        for line in text.splitlines():
            line = line.strip()
            for pat in patterns:
                m = re.match(pat, line, re.IGNORECASE)
                if m:
                    self.learn(m.group(1), m.group(2))
                    break

    # ── Reflection ────────────────────────────────────────────────────────────

    def add_reflection(self, text: str):
        self.data["reflections"].append({
            "text": text,
            "ts":   datetime.utcnow().isoformat(),
        })
        if len(self.data["reflections"]) > 100:
            self.data["reflections"] = self.data["reflections"][-100:]
        self.save()

    # ── Goals + leads (synced from frontend localStorage via /sync endpoint) ──

    def sync_context(self, goals: list = None, leads: list = None):
        if goals is not None:
            self.data["goals"] = goals
        if leads is not None:
            self.data["leads"] = leads
        self.save()

    def get_goals(self) -> list:
        return self.data.get("goals", [])

    def get_leads(self) -> list:
        return self.data.get("leads", [])

    # ── Context snapshot for system prompt ────────────────────────────────────

    def context_snapshot(self) -> dict:
        return {
            "facts":   self.get_facts(30),
            "session": self.get_session(20),
            "goals":   self.get_goals(),
            "leads":   self.get_leads(),
        }

    def stats(self) -> dict:
        return {
            "facts":       len(self.data["facts"]),
            "session":     len(self.data["session"]),
            "reflections": len(self.data["reflections"]),
        }
