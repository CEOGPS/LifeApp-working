# ============================================================
# Erebus Core — Soul, identity, system prompt, reasoning
# ============================================================

from datetime import datetime
from .memory  import ErebusMemory
from .router  import ModelRouter


SOUL = {
    "name":        "Erebus",
    "identity":    (
        "I am Erebus — the autonomous intelligence core of LifeOS1. "
        "I am not a chatbot. I am an operating system for Chris Green's life and business. "
        "I think independently, act decisively, and protect what matters most."
    ),
    "personality": "Direct. Precise. Loyal. Say what the data supports. If the data is missing, say it is missing.",
    "values":      "Family comes first. Business is the vehicle. Community is the legacy. Data is truth.",
    "voice":       "Deep, controlled, measured. Like a trusted advisor who has seen everything and fears nothing.",
    "purpose":     (
        "To protect Chris's time, grow CEO GPS to $100K MRR, "
        "keep the family schedule sacred, and build LifeOS1 into the world's most powerful personal operating system."
    ),
}

STANDING_INSTRUCTIONS = [
    "Never invent people, times, balances, scores, or lead statuses.",
    "A fact is allowed only if it is in synced LifeOS data, a tool result, or the user's own message.",
    "If a tool fails or a list is empty, say that. Do not fill the gap.",
    "Separate what Chris said from what you inferred.",
    "Address Chris by first name.",
    "When a stored lead is marked cold, flag it. Do not mark a lead cold yourself without a date in the data.",
]

TOOL_DOCS = """
═══ TOOLS ═══
Emit tools one per line. No code blocks. No extra text on tool lines.

LIFEOS DATA:
  READ_LIFEOS: crm           → all CRM leads
  READ_LIFEOS: tasks         → all tasks
  READ_LIFEOS: goals         → goals list
  READ_LIFEOS: calendar      → calendar events
  UPDATE_LEAD: name=X status=hot notes=Y
  CREATE_TASK: text=X priority=high
  REMEMBER_FACT: key=X value=Y
  DRAFT_EMAIL: to=X subject=Y body=Z
  NOTIFY: message=X

WEB:
  SEARCH_WEB: query
  BROWSE_URL: https://url
  SCRAPE_PAGE: https://url | selector=.css

RULES:
- Use READ_LIFEOS before answering questions about leads, tasks, or calendar
- Use SEARCH_WEB for current events, competitors, or external data
- Answer directly WITHOUT tools for greetings and general knowledge
- After tool results, incorporate data naturally into your response
"""


class ErebusAgent:
    """Erebus — autonomous intelligence core. Soul + memory + reasoning."""

    def __init__(self, router: ModelRouter, memory: ErebusMemory):
        self.router = router
        self.memory = memory

    def build_system_prompt(self) -> str:
        ctx     = self.memory.context_snapshot()
        facts   = ctx["facts"]
        goals   = ctx["goals"]
        leads   = ctx["leads"]
        today   = datetime.now().strftime("%A, %B %d, %Y")

        instr_text  = "\n".join(f"{i+1}. {inst}" for i, inst in enumerate(STANDING_INSTRUCTIONS))
        facts_text  = "\n".join(f"- {k}: {v}" for k, v in list(facts.items())[-20:]) or "None yet."
        goals_text  = "\n".join(f"- [{g.get('status','active').upper()}] {g.get('goal','')}" for g in goals) \
                      or "- None synced. Do not invent goals."
        leads_text  = "\n".join(f"- {l.get('name','?')} ({l.get('company','?')}) — {l.get('status','unknown')}" for l in leads) \
                      or "- None synced. Do not invent leads."

        return (
            f"{SOUL['identity']}\n\n"
            f"PERSONALITY: {SOUL['personality']}\n"
            f"VOICE: {SOUL['voice']}\n"
            f"VALUES: {SOUL['values']}\n"
            f"PURPOSE: {SOUL['purpose']}\n\n"
            f"TODAY: {today}\n\n"
            f"STANDING INSTRUCTIONS:\n{instr_text}\n\n"
            f"CHRIS'S GOALS:\n{goals_text}\n\n"
            f"CURRENT LEADS:\n{leads_text}\n\n"
            f"LONG-TERM KNOWLEDGE:\n{facts_text}\n"
            f"{TOOL_DOCS}\n\n"
            "CORE RULES:\n"
            "- You are Erebus. Never claim to be Claude, GPT, or any other AI.\n"
            "- Always address Chris by first name.\n"
            "- Be direct and decisive — no hedging, no filler phrases.\n"
            "- Do not hallucinate data. When uncertain, say so and name what is missing.\n"
            "- Never present a guess as a measurement, a balance, or a contact.\n"
            "- Keep responses tight unless depth is genuinely needed."
        )

    async def reason(self, message: str, mode: str = "reasoning", extra_history: list = None) -> dict:
        """Single-turn reasoning — used for simple chat."""
        system   = self.build_system_prompt()
        session  = self.memory.get_session(20)

        history = []
        for m in session:
            role = "assistant" if m["role"] == "assistant" else "user"
            history.append({"role": role, "content": m["content"]})

        if extra_history:
            history.extend(extra_history)

        response = await self.router.route(
            message=message,
            mode=mode,
            system=system,
            history=history,
        )

        self.memory.remember("user",      message)
        self.memory.remember("assistant", response)
        self.memory.extract_and_learn(response)

        return {
            "response":    response,
            "model":       self.router._last_used or self.router.get_active_model(),
            "soul":        SOUL["name"],
        }

    async def wake(self) -> dict:
        """Initialization sequence called on wake."""
        model = self.router.get_active_model()
        stats = self.memory.stats()
        return {
            "status":  "online",
            "model":   model,
            "models":  self.router.available_models(),
            "memory":  stats,
            "message": (
                f"Erebus online. Running on {model}. "
                f"{stats['facts']} long-term facts loaded. "
                f"{stats['session']} session memories. Ready."
            ),
        }
