import { Terminal, Monitor, Code, Database, Zap } from "lucide-react";
import Module from "@/pages/dashboard/_components/Module";

const TERMINALS = [
  { id: "powershell", name: "PowerShell", icon: Terminal, desc: "Windows system administration" },
  { id: "cmd", name: "Command Prompt", icon: Monitor, desc: "Legacy Windows shell" },
  { id: "wsl", name: "WSL Ubuntu", icon: Database, desc: "Linux subsystem on Windows" },
  { id: "bash", name: "Git Bash", icon: Code, desc: "Bash emulation for Git" },
  { id: "python", name: "Python REPL", icon: Zap, desc: "Interactive Python interpreter" },
];

export default function TerminalPage() {
  return (
    <div className="p-4 min-h-full">
      <h1 className="text-xl font-semibold mb-4">Terminals</h1>
      <Module title="Terminal Emulators" icon={<Terminal size={14} />} className="h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TERMINALS.map((t) => (
            <div
              key={t.id}
              className="glass rounded-lg p-4 border border-white/5 hover:border-primary/30 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/40 transition-colors">
                  <t.icon size={18} className="text-primary" />
                </div>
                <div>
                  <div className="font-medium text-white/90">{t.name}</div>
                  <div className="text-xs text-white/40">{t.desc}</div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-xs text-white/30">Not connected</span>
                <button className="text-xs text-primary/70 hover:text-primary px-2 py-1 rounded border border-primary/30">
                  Launch
                </button>
              </div>
            </div>
          ))}
        </div>
      </Module>
    </div>
  );
}