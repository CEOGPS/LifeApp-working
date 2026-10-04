import { useState } from "react";
import { Cpu, LayoutGrid } from "lucide-react";
import Module from "@/pages/dashboard/_components/Module";
import AlternateLifeExplorer from "./AlternateLifeExplorer";
import DarkCardGame from "./DarkCardGame";
import DreamForgeSimulator from "./DreamForgeSimulator";
import EchoPersonaWeaver from "./EchoPersonaWeaver";
import FantasyFriendSimulator from "./FantasyFriendSimulator";
import NarrativeConflictEngine from "./NarrativeConflictEngine";
import ShadowBudgetOracle from "./ShadowBudgetOracle";

type SimulatorConfig = {
  id: string;
  name: string;
  icon: typeof LayoutGrid;
  component: React.ComponentType<any>;
  needsBack?: boolean;
};

const SIMULATORS: SimulatorConfig[] = [
  { id: "alternate-life", name: "AlternateLifeExplorer", icon: LayoutGrid, component: AlternateLifeExplorer },
  { id: "dark-card-game", name: "DarkCardGame", icon: LayoutGrid, component: DarkCardGame },
  { id: "dream-forge", name: "DreamForgeSimulator", icon: LayoutGrid, component: DreamForgeSimulator },
  { id: "echo-persona", name: "EchoPersonaWeaver", icon: LayoutGrid, component: EchoPersonaWeaver },
  { id: "fantasy-friend", name: "FantasyFriendSimulator", icon: LayoutGrid, component: FantasyFriendSimulator },
  { id: "narrative-conflict", name: "NarrativeConflictEngine", icon: LayoutGrid, component: NarrativeConflictEngine, needsBack: true },
  { id: "shadow-budget", name: "ShadowBudgetOracle", icon: LayoutGrid, component: ShadowBudgetOracle, needsBack: true },
];

export default function SimulatorsPage() {
  const [activeSim, setActiveSim] = useState("alternate-life");
  const simConfig = SIMULATORS.find(s => s.id === activeSim) || SIMULATORS[0];
  const ActiveComponent = simConfig.component;

  return (
    <div className="p-4 min-h-full">
      <h1 className="text-xl font-semibold mb-4">Simulators</h1>
      <Module title="Life Simulators" icon={<Cpu size={14} />} className="h-[700px]">
        <div className="flex gap-4 h-full">
          {/* Sidebar with simulator list */}
          <aside className="w-56 shrink-0 flex flex-col gap-1 overflow-y-auto">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-white/30 font-display tracking-wider border-b border-white/5">
              <Cpu size={12} />
              SIMULATORS
            </div>
            {SIMULATORS.map((sim) => (
              <button
                key={sim.id}
                onClick={() => setActiveSim(sim.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  activeSim === sim.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-white/60 hover:bg-white/5 hover:text-white/90"
                }`}
              >
                <sim.icon size={12} className="inline-block mr-2" />
                {sim.name}
              </button>
            ))}
          </aside>

          {/* Active simulator content */}
          <div className="flex-1 overflow-auto">
            {simConfig.needsBack ? (
              <ActiveComponent onBack={() => setActiveSim("alternate-life")} />
            ) : (
              <ActiveComponent />
            )}
          </div>
        </div>
      </Module>
    </div>
  );
}