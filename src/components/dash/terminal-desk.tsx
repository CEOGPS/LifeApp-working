import { useState } from "react";
import type { Memory } from "./memory";
import { runCommand } from "./sims";

const SHELLS = ["Terminal", "Command Prompt", "WSL", "Ubuntu", "PowerShell", "Windows PowerShell", "Conda", "Python"] as const;
type Shell = (typeof SHELLS)[number];

function prompt(shell: Shell) {
  if (shell === "Command Prompt") return "C:\\Users\\ceogps>";
  if (shell === "PowerShell") return "PS C:\\Users\\ceogps>";
  if (shell === "Windows PowerShell") return "PS C:\\Windows\\System32>";
  if (shell === "Conda") return "(base) C:\\Users\\ceogps>";
  if (shell === "Python") return ">>>";
  if (shell === "WSL") return "ceogps@lifeos:~$";
  if (shell === "Ubuntu") return "ceogps@ubuntu:~$";
  return "lifeos:~$";
}

function unix(line: string, data: Memory) {
  const [head, ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(" ");
  if (head === "ls") return "notes  tasks  contacts  leads  mail";
  if (head === "pwd") return "/home/ceogps";
  if (head === "whoami") return "ceogps";
  if (head === "uname") return "Linux lifeos 6.8 x86_64";
  if (head === "clear") return "__clear__";
  if (head === "echo") return arg;
  if (head === "help") return "ls, pwd, whoami, uname, echo, clear, plus board commands: notes, tasks, contacts, leads, money, events";
  return runCommand(line, data);
}

function cmd(line: string, data: Memory) {
  const [head, ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(" ");
  const name = head.toLowerCase();
  if (name === "dir") return "notes\ntasks\ncontacts\nleads\nmail";
  if (name === "cls") return "__clear__";
  if (name === "ver") return "LifeOS Command Prompt";
  if (name === "echo") return arg;
  if (name === "cd") return arg ? `C:\\Users\\ceogps\\${arg}` : "C:\\Users\\ceogps";
  if (name === "help") return "DIR, CLS, VER, ECHO, CD, plus NOTES, TASKS, CONTACTS, LEADS, MONEY, EVENTS";
  return runCommand(line, data);
}

function ps(line: string, data: Memory) {
  const text = line.trim();
  const lower = text.toLowerCase();
  if (lower === "cls" || lower === "clear-host") return "__clear__";
  if (lower === "get-location" || lower === "pwd") return "Path\n----\nC:\\Users\\ceogps";
  if (lower === "get-childitem" || lower === "ls" || lower === "dir") return "notes\ntasks\ncontacts\nleads\nmail";
  if (lower.startsWith("echo ") || lower.startsWith("write-host ")) return text.split(/\s+/).slice(1).join(" ");
  if (lower === "help") return "Get-ChildItem, Get-Location, Write-Host, cls, plus notes, tasks, contacts, leads, money, events";
  return runCommand(line, data);
}

function conda(line: string, data: Memory) {
  const text = line.trim().toLowerCase();
  if (text === "conda env list" || text === "conda info --envs") return "# conda environments:\nbase                  *  C:\\Users\\ceogps\\miniconda3";
  if (text === "conda info") return "active environment : base\nplatform : win-64\nthis is the dashboard session, not the Conda install on the PC";
  if (text === "python" || text === "python3") return "Open the Python shell for the prompt.";
  if (text === "cls" || text === "clear") return "__clear__";
  if (text === "help") return "conda info, conda env list, python, cls";
  return runCommand(line, data);
}

function python(line: string, data: Memory) {
  const text = line.trim();
  if (!text) return "";
  if (text === "help()" || text === "help") return "print(\"text\"), math such as 2 + 2, board(), exit()";
  if (text === "exit()" || text === "quit()") return "Use the shell list to leave Python.";
  if (text === "board()") return `${data.notes.length} notes, ${data.tasks.length} tasks, ${data.contacts.length} contacts`;
  const printed = text.match(/^print\((.*)\)\s*$/);
  if (printed) {
    const inner = printed[1].trim();
    if ((inner.startsWith("\"") && inner.endsWith("\"")) || (inner.startsWith("'") && inner.endsWith("'"))) return inner.slice(1, -1);
    if (/^[\d\s+\-*/().]+$/.test(inner)) return String(Function(`"use strict"; return (${inner})`)());
  }
  if (/^[\d\s+\-*/().]+$/.test(text)) return String(Function(`"use strict"; return (${text})`)());
  return "This Python prompt only runs print, math, and board(). It is not the Python install on this PC.";
}

function exec(shell: Shell, line: string, data: Memory) {
  if (shell === "Command Prompt") return cmd(line, data);
  if (shell === "PowerShell" || shell === "Windows PowerShell") return ps(line, data);
  if (shell === "Conda") return conda(line, data);
  if (shell === "Python") return python(line, data);
  return unix(line, data);
}

export function TerminalDesk({ data }: { data: Memory }) {
  const [shell, setShell] = useState<Shell>("Terminal");
  const [logs, setLogs] = useState<Record<Shell, string[]>>(() => Object.fromEntries(SHELLS.map((name) => [name, [`${name}. Type help.`]])) as Record<Shell, string[]>);
  const [line, setLine] = useState("");
  const view = logs[shell];

  return (
    <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[14rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">Shells</p>
        <div className="mt-3">
          {SHELLS.map((name) => <button key={name} type="button" className={`menu ${shell === name ? "is-on" : ""}`} onClick={() => setShell(name)}>{name}</button>)}
        </div>
      </aside>
      <section className="module-card flex min-h-[36rem] flex-col p-4">
        <p className="text-[11px] text-white/40">{shell} session in the dashboard. It is not the {shell} installed on this PC.</p>
        <pre className="mt-3 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap font-mono text-sm text-green">{view.join("\n")}</pre>
        <form className="mt-3 flex gap-2 font-mono text-sm" onSubmit={(event) => {
          event.preventDefault();
          const text = line;
          if (!text.trim()) return;
          const result = exec(shell, text, data);
          setLine("");
          setLogs((prev) => ({ ...prev, [shell]: result === "__clear__" ? [`${shell}. Type help.`] : [...prev[shell], `${prompt(shell)} ${text}`, result].filter((row) => row !== "") }));
        }}>
          <span className="text-green">{prompt(shell)}</span>
          <input className="h-8 min-w-0 flex-1 bg-transparent outline-none" value={line} onChange={(event) => setLine(event.target.value)} />
        </form>
      </section>
    </div>
  );
}
