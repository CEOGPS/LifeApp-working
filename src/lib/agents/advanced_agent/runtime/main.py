# ============================================================
# Erebus Advanced Agent — FastAPI Backend v2.1
# ============================================================

import os
import json
import asyncio
import subprocess
import webbrowser
from typing import Optional, AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ── Import shim ──────────────────────────────────────────────────────────────
import sys as _sys
import importlib.util as _ilu
from importlib import import_module as _import_module
from pathlib import Path as _Path

_AGENT_PKG_DIR = _Path(__file__).resolve().parent.parent
if "agent" not in _sys.modules:
    _spec = _ilu.spec_from_file_location(
        "agent",
        _AGENT_PKG_DIR / "__init__.py",
        submodule_search_locations=[str(_AGENT_PKG_DIR)],
    )
    if _spec is None or _spec.loader is None:
        raise ImportError("Unable to load the advanced_agent package")
    _agent_pkg = _ilu.module_from_spec(_spec)
    _sys.modules["agent"] = _agent_pkg
    _spec.loader.exec_module(_agent_pkg)

_router_mod   = _import_module("agent.router")
_memory_mod   = _import_module("agent.memory")
_core_mod     = _import_module("agent.core")
_planner_mod  = _import_module("agent.planner")
_autonomy_mod = _import_module("agent.autonomy")

ModelRouter    = _router_mod.ModelRouter
ErebusMemory   = _memory_mod.ErebusMemory
ErebusAgent    = _core_mod.ErebusAgent
TaskPlanner    = _planner_mod.TaskPlanner
Autonomy       = _autonomy_mod.Autonomy
ProactiveQueue = _autonomy_mod.ProactiveQueue
AutonomyState  = _autonomy_mod.AutonomyState

# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Erebus Advanced Agent", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ───────────────────────────────────────────────────────────────

_router          = ModelRouter()
_memory          = ErebusMemory()
_agent           = ErebusAgent(_router, _memory)
_planner         = TaskPlanner(_router, _memory)
_proactive_queue = ProactiveQueue()
_autonomy        = Autonomy(_router, _memory, _proactive_queue)

# ── Schemas ──────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    mode: str = "reasoning"
    system: str = ""
    history: list = []

class TaskRequest(BaseModel):
    task: str
    context: str = ""

class SyncRequest(BaseModel):
    crm: list = []
    tasks: list = []
    goals: list = []
    calendar: list = []
    contacts: list = []

class ExecuteRequest(BaseModel):
    action: str
    path: Optional[str] = ""
    content: Optional[str] = ""
    cmd: Optional[str] = ""
    url: Optional[str] = ""

class MemoryRequest(BaseModel):
    key: str
    value: str

# ── Lifecycle ────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def _startup():
    _autonomy.start()

@app.on_event("shutdown")
async def _shutdown():
    await _autonomy.stop()

# ── Core endpoints ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":           "online",
        "model":            _router.get_active_model(),
        "models_available": _router.available_models(),
        "scores":           _router.scoreboard(),
        "memory":           _memory.stats(),
    }

@app.get("/wake")
async def wake():
    return await _agent.wake()

@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        return await _agent.reason(
            message=req.message,
            mode=req.mode,
            extra_history=req.history or None,
        )
    except Exception as e:
        return {
            "response": _router.local_fallback(req.message),
            "model":    "local",
            "error":    str(e),
        }

@app.post("/task")
async def run_task(req: TaskRequest):
    try:
        return await _planner.run_task_sync(req.task, req.context)
    except Exception as e:
        return {"error": str(e), "steps": []}

@app.post("/stream")
async def stream_task(req: TaskRequest):
    async def event_stream() -> AsyncGenerator[str, None]:
        async for event in _planner.run_task(req.task, req.context):
            yield f"data: {json.dumps(event)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )

@app.post("/sync")
async def sync_context(req: SyncRequest):
    lifeos_data = {
        "crm":      req.crm,
        "tasks":    req.tasks,
        "goals":    req.goals,
        "calendar": req.calendar,
        "contacts": req.contacts,
    }
    _memory.sync_context(goals=req.goals, leads=req.crm)
    _planner.set_lifeos_data(lifeos_data)
    return {"status": "synced", "counts": {k: len(v) for k, v in lifeos_data.items()}}

@app.get("/memory")
async def get_memory():
    return {
        "stats":   _memory.stats(),
        "facts":   _memory.get_facts(50),
        "session": _memory.get_session(20),
        "goals":   _memory.get_goals(),
        "leads":   _memory.get_leads(),
    }

@app.post("/memory/learn")
async def learn_fact(req: MemoryRequest):
    _memory.learn(req.key, req.value)
    return {"status": "learned", "key": req.key}

@app.delete("/memory/session")
async def clear_session():
    _memory.clear_session()
    return {"status": "cleared"}

@app.post("/execute")
async def execute(req: ExecuteRequest):
    try:
        path = req.path or ""
        url = req.url or ""
        cmd = req.cmd or ""

        if req.action == "write_file":
            if not path:
                return {"result": "Error: path is required for write_file"}
            parent = os.path.dirname(path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(req.content or "")
            return {"result": f"Written: {path} ({len(req.content or '')} chars)"}

        elif req.action == "read_file":
            if not path:
                return {"result": "Error: path is required for read_file"}
            if not os.path.exists(path):
                return {"result": f"Error: {path} not found"}
            with open(path, "r", encoding="utf-8") as f:
                return {"result": f.read()}

        elif req.action == "run_command":
            if not cmd:
                return {"result": "Error: cmd is required for run_command"}
            result = subprocess.run(
                cmd, shell=True, capture_output=True,
                text=True, timeout=30, cwd=os.path.expanduser("~"),
            )
            return {"result": result.stdout or result.stderr or "(no output)"}

        elif req.action == "open_browser":
            if not url:
                return {"result": "Error: url is required for open_browser"}
            webbrowser.open(url)
            return {"result": f"Opened: {url}"}

        elif req.action == "list_dir":
            list_path = path or os.path.expanduser("~")
            return {"result": "\n".join(sorted(os.listdir(list_path)))}

        else:
            raise HTTPException(400, f"Unknown action: {req.action}")

    except Exception as e:
        return {"result": f"Error: {e}"}

# ── Autonomy endpoints ───────────────────────────────────────────────────────

@app.get("/events")
async def events(request: Request):
    q = _proactive_queue.subscribe()

    async def gen():
        try:
            for item in _proactive_queue.drain():
                yield f"data: {json.dumps(item)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    item = await asyncio.wait_for(q.get(), timeout=20)
                    yield f"data: {json.dumps(item)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            _proactive_queue.unsubscribe(q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )

@app.post("/activity")
async def mark_activity():
    _autonomy.state.record_user_activity()
    return {"status": "ok"}

@app.get("/autonomy/state")
async def autonomy_state():
    s = _autonomy.state
    return {
        "last_activity":        s.last_user_activity.isoformat(),
        "last_idle_fire":       s.last_idle_fire.isoformat() if s.last_idle_fire else None,
        "last_cold_lead_fire":  s.last_cold_lead_fire.isoformat() if s.last_cold_lead_fire else None,
        "unprompted_last_hour": len(s.unprompted_timestamps),
        "can_fire":             s.can_fire(),
    }

# ── Tools (every Python module) ──────────────────────────────────────────────

class ToolRequest(BaseModel):
    name: str
    arg: str = ""

@app.get("/tools")
async def list_tools():
    mod = _import_module("agent.tools.registry")
    return {"tools": mod.TOOLS, "models": _router.available_models()}

@app.post("/tools/run")
async def run_named_tool(req: ToolRequest):
    mod = _import_module("agent.tools.registry")
    try:
        result = await mod.run_tool(req.name, req.arg)
        return {"ok": True, "result": result}
    except Exception as e:
        return {"ok": False, "result": str(e)}

# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("FASTAPI_PORT", 8000))
    print(f"\n  Erebus v2.1 starting on port {port}")
    print(f"  Model: {_router.get_active_model()}")
    print(f"  Available: {_router.available_models()}")
    print(f"  Memory: {_memory.stats()}\n")
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)