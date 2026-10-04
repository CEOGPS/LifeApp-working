import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";

interface AgentDockContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openDock: ({ agentId }?: { agentId?: string }) => void;
  closeDock: () => void;
  requestedAgentId: string | null;
  clearRequestedAgent: () => void;
}

const AgentDockContext = createContext<AgentDockContextType | null>(null);

export function AgentDockProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [requestedAgentId, setRequestedAgentId] = useState<string | null>(null);

  const openDock = useCallback(({ agentId }: { agentId?: string } = {}) => {
    if (agentId) setRequestedAgentId(agentId);
    setOpen(true);
  }, []);

  const closeDock = useCallback(() => setOpen(false), []);
  const clearRequestedAgent = useCallback(() => setRequestedAgentId(null), []);

  return (
    <AgentDockContext.Provider
      value={{
        open,
        setOpen,
        openDock,
        closeDock,
        requestedAgentId,
        clearRequestedAgent,
      }}
    >
      {children}
    </AgentDockContext.Provider>
  );
}

export function useAgentDock() {
  const context = useContext(AgentDockContext);
  if (!context) {
    throw new Error("useAgentDock must be used within an AgentDockProvider");
  }
  return context;
}