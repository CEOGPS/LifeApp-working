import { create } from 'zustand';

interface AIState {
  currentModel: string;
  voiceEnabled: boolean;
  setModel: (model: string) => void;
  toggleVoice: () => void;
}

export const useAIStore = create<AIState>((set) => ({
  currentModel: 'grok-4',
  voiceEnabled: true,
  setModel: (model) => set({ currentModel: model }),
  toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
}));