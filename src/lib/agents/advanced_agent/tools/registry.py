"""Every Erebus Python tool, one dispatcher."""
from .audio_generation import generate as generate_audio
from .clickup_integration import list_tasks
from .cowork_integration import note as cowork_note
from .make_integration import trigger as make_trigger
from .vscode_integration import open_path
from .workshop_integration import train as workshop_train
from ..utils.code_executor import run as run_code
from ..utils.web_search import search as search_web

TOOLS = [
    "search",
    "code",
    "audio",
    "clickup",
    "make",
    "vscode",
    "cowork",
    "workshop",
]


async def run_tool(name: str, arg: str = "") -> str:
    name = (name or "").strip().lower()
    if name == "search":
        return await search_web(arg)
    if name == "code":
        return run_code(arg)
    if name == "audio":
        return await generate_audio(arg)
    if name == "clickup":
        return await list_tasks(arg)
    if name == "make":
        return await make_trigger(arg)
    if name == "vscode":
        return open_path(arg)
    if name == "cowork":
        return cowork_note(arg)
    if name == "workshop":
        return workshop_train(arg)
    return f"[Unknown tool] {name}"


async def run_line(line: str):
    line = (line or "").strip()
    mapping = (
        ("RUN_CODE:", "code"),
        ("GENERATE_AUDIO:", "audio"),
        ("CLICKUP:", "clickup"),
        ("MAKE:", "make"),
        ("VSCODE:", "vscode"),
        ("COWORK:", "cowork"),
        ("WORKSHOP:", "workshop"),
    )
    for prefix, name in mapping:
        if line.startswith(prefix):
            return await run_tool(name, line[len(prefix):].strip())
    return None
