# ============================================================
# Erebus Model Router v2 — Local → NVIDIA → Cloud → Fallback
# ============================================================

import json
import os
import time
from importlib import import_module

_SCORE_PATH = os.path.join(os.path.expanduser("~"), ".lifeos", "model_scores.json")


def _load_environment() -> bool:
    """Load a local .env file when present without requiring python-dotenv."""
    candidates = []
    env_file = os.getenv("ENV_FILE")
    if env_file:
        candidates.append(env_file)

    base_dir = os.path.dirname(__file__)
    candidates.extend(
        [
            os.path.join(base_dir, ".env"),
            os.path.join(base_dir, "..", ".env"),
            os.path.join(os.getcwd(), ".env"),
        ]
    )

    seen = set()
    for candidate in candidates:
        normalized = os.path.abspath(candidate)
        if normalized in seen:
            continue
        seen.add(normalized)
        if not os.path.isfile(normalized):
            continue
        try:
            with open(normalized, "r", encoding="utf-8") as handle:
                for raw_line in handle:
                    line = raw_line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip()
                    if value and value[0] in {'"', "'"} and value[-1] == value[0]:
                        value = value[1:-1]
                    os.environ.setdefault(key, value)
        except OSError:
            continue
        return True
    return False


_load_environment()


def _httpx():
    """Load the HTTP client when a backend request is made."""
    return import_module("httpx")


class ModelRouter:
    def __init__(self):
        self.ollama_base   = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
        self.ollama_model  = os.getenv("OLLAMA_MODEL", "llama3.2")

        self.nvidia_key    = os.getenv("NVIDIA_API_KEY", "").strip()
        self.nvidia_base   = (os.getenv("NVIDIA_BASE_URL") or "https://integrate.api.nvidia.com/v1").rstrip("/")
        self.nvidia_model  = os.getenv("NVIDIA_MODEL", "openai/gpt-oss-20b")

        self.groq_key      = os.getenv("GROQ_API_KEY", "").strip()
        self.groq_model    = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

        self.grok_key      = (os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY") or "").strip()
        self.openai_key    = os.getenv("OPENAI_API_KEY", "").strip()
        self.perplexity_key = os.getenv("PERPLEXITY_API_KEY", "").strip()
        self.claude_key    = os.getenv("ANTHROPIC_API_KEY", "").strip()
        self.gemini_key    = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()

        self._active = self._pick_active()
        self._last_used = self._active
        self.scores = self._load_scores()

    def _pick_active(self) -> str:
        if self._ollama_up_sync():
            return "ollama"
        if self.nvidia_key:
            return "nvidia"
        if self.groq_key:
            return "groq"
        if self.grok_key:
            return "grok"
        if self.openai_key:
            return "openai"
        return "local"

    def _ollama_up_sync(self) -> bool:
        try:
            r = _httpx().get(f"{self.ollama_base}/api/tags", timeout=1.5)
            return r.status_code == 200
        except Exception:
            return False

    def get_active_model(self) -> str:
        ranked = self._ranked()
        if not ranked:
            return "local"
        return ranked[0][0]

    def _load_scores(self) -> dict:
        try:
            with open(_SCORE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return {k: float(v) for k, v in data.items()}
        except Exception:
            pass
        return {}

    def _save_scores(self) -> None:
        try:
            os.makedirs(os.path.dirname(_SCORE_PATH), exist_ok=True)
            with open(_SCORE_PATH, "w", encoding="utf-8") as f:
                json.dump(self.scores, f)
        except Exception:
            pass

    def _enabled(self) -> list:
        rows = []
        if self._active == "ollama":
            rows.append(("ollama", self._call_ollama))
        if self.nvidia_key:
            rows.append(("nvidia", self._call_nvidia))
        if self.groq_key:
            rows.append(("groq", self._call_groq))
        if self.grok_key:
            rows.append(("grok", self._call_grok))
        if self.openai_key:
            rows.append(("openai", self._call_openai))
        if self.claude_key:
            rows.append(("claude", self._call_claude))
        if self.gemini_key:
            rows.append(("gemini", self._call_gemini))
        if self.perplexity_key:
            rows.append(("perplexity", self._call_perplexity))
        return rows

    def _ranked(self) -> list:
        return sorted(self._enabled(), key=lambda item: self.scores.get(item[0], 50.0), reverse=True)

    def _record(self, name: str, ok: bool, seconds: float) -> None:
        current = self.scores.get(name, 50.0)
        speed = max(0.0, 20.0 - seconds)
        sample = (70.0 + speed) if ok else 10.0
        self.scores[name] = round(current * 0.7 + sample * 0.3, 2)
        self._save_scores()

    def scoreboard(self) -> dict:
        return {name: self.scores.get(name, 50.0) for name, _ in self._enabled()}

    def available_models(self) -> list:
        available = []
        if self._active == "ollama":
            available.append(f"ollama/{self.ollama_model}")
        if self.nvidia_key:
            available.append(f"nvidia/{self.nvidia_model}")
        if self.groq_key:
            available.append("groq/llama-3.3-70b")
        if self.grok_key:
            available.append("xai/grok-3-mini")
        if self.openai_key:
            available.append("openai/gpt-4o-mini")
        if self.perplexity_key:
            available.append("perplexity/sonar")
        if self.claude_key:
            available.append("anthropic/claude")
        if self.gemini_key:
            available.append("google/gemini")
        if not available:
            available.append("local/pattern-match")
        return available

    # ── Routing ───────────────────────────────────────────────────────────────

    async def route(self, message: str, mode: str, system: str, history: list) -> str:
        if mode == "search" and self.perplexity_key:
            return await self._try(self._call_perplexity, message, system, history, "perplexity")
        # Highest score goes first. A failure drops that model and the next one is tried.
        for name, fn in self._ranked():
            started = time.perf_counter()
            try:
                text = await fn(message, system, history)
                if not text or not str(text).strip():
                    raise RuntimeError("empty reply")
                self._record(name, True, time.perf_counter() - started)
                self._last_used = name
                return text
            except Exception:
                self._record(name, False, time.perf_counter() - started)
        return self.local_fallback(message)

    async def _try(self, fn, message, system, history, tag):
        try:
            return await fn(message, system, history)
        except Exception:
            return self.local_fallback(message)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _build_messages(self, system: str, history: list, message: str) -> list:
        msgs = []
        if system:
            msgs.append({"role": "system", "content": system[:6000]})
        for h in history[-12:]:
            role = h.get("role", "user")
            content = h.get("content", "")
            if role in ("user", "assistant") and content:
                msgs.append({"role": role, "content": content})
        msgs.append({"role": "user", "content": message})
        return msgs

    # ── Local (Ollama) ────────────────────────────────────────────────────────

    async def _call_ollama(self, message: str, system: str, history: list) -> str:
        msgs = self._build_messages(system, history, message)
        async with _httpx().AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{self.ollama_base}/api/chat",
                json={
                    "model": self.ollama_model,
                    "messages": msgs,
                    "stream": False,
                    "options": {"num_predict": 2000, "temperature": 0.6},
                },
            )
            r.raise_for_status()
            return r.json()["message"]["content"]

    # ── NVIDIA NIM ────────────────────────────────────────────────────────────

    async def _call_nvidia(self, message: str, system: str, history: list) -> str:
        msgs = self._build_messages(system, history, message)
        async with _httpx().AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{self.nvidia_base}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.nvidia_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.nvidia_model,
                    "messages": msgs,
                    "max_tokens": 2000,
                    "temperature": 0.6,
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    # ── Groq ──────────────────────────────────────────────────────────────────

    async def _call_groq(self, message: str, system: str, history: list) -> str:
        msgs = self._build_messages(system, history, message)
        async with _httpx().AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.groq_key}",
                         "Content-Type": "application/json"},
                json={"model": self.groq_model, "messages": msgs, "max_tokens": 2000},
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    # ── xAI Grok ──────────────────────────────────────────────────────────────

    async def _call_grok(self, message: str, system: str, history: list) -> str:
        from .models.grok import complete
        return await complete(self._build_messages(system, history, message), self.grok_key)

    # ── OpenAI ────────────────────────────────────────────────────────────────

    async def _call_openai(self, message: str, system: str, history: list) -> str:
        from .models.gpt import complete
        return await complete(self._build_messages(system, history, message), self.openai_key)

    async def _call_claude(self, message: str, system: str, history: list) -> str:
        from .models.claude import complete
        return await complete(self._build_messages(system, history, message), self.claude_key)

    async def _call_gemini(self, message: str, system: str, history: list) -> str:
        from .models.gemini import complete
        return await complete(self._build_messages(system, history, message), self.gemini_key)

    # ── Perplexity ────────────────────────────────────────────────────────────

    async def _call_perplexity(self, message: str, system: str, history: list) -> str:
        from .models.perplexity import complete
        return await complete(self._build_messages(system, history, message), self.perplexity_key, "sonar")

    # ── Local fallback ────────────────────────────────────────────────────────

    def local_fallback(self, message: str) -> str:
        return (
            "Erebus is online, but no model answered this turn. "
            "I will not guess. Start Ollama on port 11434 or set NVIDIA_API_KEY, GROQ_API_KEY, or XAI_API_KEY. "
            f"Your message was: \"{message[:160]}\""
        )