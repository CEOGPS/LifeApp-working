"""Open a file in VS Code for Erebus."""
import shutil
import subprocess


def open_path(path: str) -> str:
    path = (path or "").strip()
    if not path:
        return "[VSCODE] path required"
    exe = shutil.which("code") or shutil.which("code.cmd")
    if not exe:
        return "[VSCODE] the code command is not on PATH"
    subprocess.Popen([exe, path])
    return f"[VSCODE] opened {path}"
