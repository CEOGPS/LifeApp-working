import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export interface WorkerState {
  agentOrchestrator: unknown | null;
  apiGateway: unknown | null;
  emailHandler: unknown | null;
  searchAggregator: unknown | null;
}

export interface WorkerContextValue {
  workers: WorkerState;
  active: boolean;
  sendToWorker: (workerName: string, payload: unknown) => Promise<void>;
}

const WorkerContext = createContext<WorkerContextValue | null>(null);

interface WorkerProviderProps {
  children: ReactNode;
}

export const WorkerProvider = ({ children }: WorkerProviderProps) => {
  const [workers] = useState<WorkerState>({
    agentOrchestrator: null,
    apiGateway: null,
    emailHandler: null,
    searchAggregator: null,
  });
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Placeholder: connect to actual Cloudflare Workers or background workers
    setActive(true);
  }, []);

  const sendToWorker = async (
    workerName: string,
    payload: unknown,
  ): Promise<void> => {
    // Stub: will route messages to the correct worker
    console.log(`Sending to ${workerName}:`, payload);
  };

  return (
    <WorkerContext.Provider value={{ workers, active, sendToWorker }}>
      {children}
    </WorkerContext.Provider>
  );
};

export const useWorker = (): WorkerContextValue => {
  const ctx = useContext(WorkerContext);
  if (!ctx) {
    throw new Error("useWorker must be used within a WorkerProvider");
  }
  return ctx;
};