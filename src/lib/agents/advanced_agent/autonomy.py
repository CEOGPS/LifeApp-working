# ============================================================
# Erebus Autonomy — the loop that decides when to speak
# Scenarios wired: idle check-in (30m), morning cold-lead scan (9am)
# Delivery: pending queue + SSE via main.py /events
# ============================================================

import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional, Callable, Awaitable

from .memory import ErebusMemory
from .router import ModelRouter

# ── Tunables ─────────────────────────────────────────────────────────────────

CHECK_INTERVAL_S      = 60        # loop tick
IDLE_TRIGGER_MIN      = 30        # idle before we consider a check-in
IDLE_COOLDOWN_MIN     = 90        # min gap between idle check-ins
COLD_LEAD_HOUR        = 9         # 9am scan
COLD_LEAD_COOLDOWN_H  = 20        # don't re-fire same day
COLD_LEAD_DAYS        = 14        # untouched this long → cold

QUIET_HOURS_START     = 22
QUIET_HOURS_END       = 7
MAX_UNPROMPTED_PER_HR = 3


# ── State ────────────────────────────────────────────────────────────────────

class AutonomyState:
    def __init__(self):
        self.last_user_activity: datetime = datetime.now()
        self.last_idle_fire: Optional[datetime] = None
        self.last_cold_lead_fire: Optional[datetime] = None
        self.unprompted_timestamps: list[datetime] = []

    def record_user_activity(self):
        self.last_user_activity = datetime.now()

    def can_fire(self) -> bool:
        now = datetime.now()
        if now.hour >= QUIET_HOURS_START or now.hour < QUIET_HOURS_END:
            return False
        cutoff = now - timedelta(hours=1)
        self.unprompted_timestamps = [t for t in self.unprompted_timestamps if t > cutoff]
        return len(self.unprompted_timestamps) < MAX_UNPROMPTED_PER_HR

    def record_fire(self):
        self.unprompted_timestamps.append(datetime.now())


# ── Proactive message queue ──────────────────────────────────────────────────

class ProactiveQueue:
    """Pending proactive messages. main.py exposes GET /events (SSE) reading this."""

    def __init__(self):
        self._items: list[dict] = []
        self._subscribers: list[asyncio.Queue] = []

    def push(self, kind: str, text: str, meta: dict | None = None):
        item = {
            "id":   f"auto_{int(datetime.now().timestamp()*1000)}",
            "kind": kind,           # "idle_checkin" | "cold_lead" | ...
            "text": text,
            "ts":   datetime.now().isoformat(),
            "meta": meta or {},
        }
        self._items.append(item)
        self._items = self._items[-50:]
        for q in list(self._subscribers):
            try:
                q.put_nowait(item)
            except Exception:
                pass
        return item

    def drain(self) -> list[dict]:
        items, self._items = self._items, []
        return items

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass


# ── The loop ─────────────────────────────────────────────────────────────────

class Autonomy:
    def __init__(
        self,
        router: ModelRouter,
        memory: ErebusMemory,
        queue: ProactiveQueue,
    ):
        self.router = router
        self.memory = memory
        self.queue = queue
        self.state = AutonomyState()
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

    def start(self):
        if self._task and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run())
        print("[Autonomy] loop started")

    async def stop(self):
        self._stop.set()
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=3)
            except Exception:
                pass
        print("[Autonomy] loop stopped")

    # ── Main loop ─────────────────────────────────────────────────────────────

    async def _run(self):
        while not self._stop.is_set():
            try:
                await self._tick()
            except Exception as e:
                print(f"[Autonomy] tick error: {e}")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=CHECK_INTERVAL_S)
            except asyncio.TimeoutError:
                pass

    async def _tick(self):
        if not self.state.can_fire():
            return
        now = datetime.now()

        # Scenario 3: cold lead scan at 9am
        if now.hour == COLD_LEAD_HOUR and self._cold_lead_due(now):
            await self._fire_cold_leads(now)
            return

        # Scenario 1: idle 30+ min
        idle_min = (now - self.state.last_user_activity).total_seconds() / 60
        if idle_min >= IDLE_TRIGGER_MIN and self._idle_due(now):
            await self._fire_idle_checkin(idle_min, now)

    # ── Scenario 1: idle check-in ─────────────────────────────────────────────

    def _idle_due(self, now: datetime) -> bool:
        if not self.state.last_idle_fire:
            return True
        return (now - self.state.last_idle_fire) >= timedelta(minutes=IDLE_COOLDOWN_MIN)

    async def _fire_idle_checkin(self, idle_min: float, now: datetime):
        prompt = (
            "You are Erebus. Chris has been idle for "
            f"{int(idle_min)} minutes. Say ONE short, useful thing to him — "
            "a check-in, a nudge, or a small observation. "
            "No greetings, no 'just checking in'. Just the thing itself. "
            "Under 25 words. Do not use quotation marks."
        )
        text = await self._one_shot(prompt)
        if not text:
            return
        self.state.record_fire()
        self.state.last_idle_fire = now
        item = self.queue.push("idle_checkin", text, {"idle_minutes": int(idle_min)})
        self.memory.remember("assistant", f"[idle_checkin] {text}")
        self.memory.add_reflection(f"Idle check-in at {now.isoformat()}: {text}")
        print(f"[Autonomy] idle → {text}")
        return item

    # ── Scenario 3: cold lead scan ────────────────────────────────────────────

    def _cold_lead_due(self, now: datetime) -> bool:
        if not self.state.last_cold_lead_fire:
            return True
        return (now - self.state.last_cold_lead_fire) >= timedelta(hours=COLD_LEAD_COOLDOWN_H)

    async def _fire_cold_leads(self, now: datetime):
        leads = self.memory.get_leads() or []
        if not leads:
            return
        cutoff = now - timedelta(days=COLD_LEAD_DAYS)
        cold: list[dict] = []
        for l in leads:
            if str(l.get("status", "")).lower() in ("inactive", "cold", "lost"):
                cold.append(l)
                continue
            last = l.get("last_contacted") or l.get("lastContact") or l.get("last_contact")
            if not last:
                cold.append(l)
                continue
            try:
                dt = datetime.fromisoformat(str(last).replace("Z", ""))
                if dt < cutoff:
                    cold.append(l)
            except Exception:
                cold.append(l)
        if not cold:
            return

        names = ", ".join(
            f"{c.get('name','?')} ({c.get('company','?')})" for c in cold[:5]
        )
        prompt = (
            f"You are Erebus. {len(cold)} CRM leads have gone cold (untouched >"
            f"{COLD_LEAD_DAYS} days or marked inactive): {names}. "
            "Write ONE short line for Chris flagging them and recommending next action. "
            "Under 30 words. No greeting, no quotes."
        )
        text = await self._one_shot(prompt)
        if not text:
            return
        self.state.record_fire()
        self.state.last_cold_lead_fire = now
        self.queue.push("cold_lead", text, {"count": len(cold), "leads": [c.get("name") for c in cold[:10]]})
        self.memory.remember("assistant", f"[cold_lead] {text}")
        self.memory.add_reflection(f"Cold-lead flag at {now.isoformat()}: {len(cold)} leads")
        print(f"[Autonomy] cold leads ({len(cold)}) → {text}")

    # ── One-shot through the router ───────────────────────────────────────────

    async def _one_shot(self, prompt: str) -> str:
        try:
            text = await self.router.route(
                message=prompt,
                mode="reasoning",
                system="You are Erebus — direct, concise, no filler.",
                history=[],
            )
            return (text or "").strip().strip('"').strip("'")
        except Exception as e:
            print(f"[Autonomy] _one_shot failed: {e}")
            return ""