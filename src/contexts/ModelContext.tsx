import { createContext, useContext, useState, type ReactNode } from "react";

export type ModelName = "hermes" | "moondream" | "llama3" | string;

export interface ModelContextValue {
  selectedModel: ModelName;
  models: ModelName[];
  switchModel: (modelName: ModelName) => void;
}

const ModelContext = createContext<ModelContextValue | null>(null);

interface ModelProviderProps {
  children: ReactNode;
}

export const ModelProvider = ({ children }: ModelProviderProps) => {
  const [selectedModel, setSelectedModel] = useState<ModelName>("hermes");
  const [models] = useState<ModelName[]>(["hermes", "moondream", "llama3"]);

  const switchModel = (modelName: ModelName) => setSelectedModel(modelName);

  return (
    <ModelContext.Provider value={{ selectedModel, models, switchModel }}>
      {children}
    </ModelContext.Provider>
  );
};

export const useModel = (): ModelContextValue => {
  const ctx = useContext(ModelContext);
  if (!ctx) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return ctx;
};