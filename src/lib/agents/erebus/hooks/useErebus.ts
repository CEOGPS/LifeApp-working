// PATCH NOTES (erebus-voice, 2026-09-29)
//   - new InitiationEngine(getErebusCore()) instead of new InitiationEngine({})
//     so unprompted lines can come from ErebusCore.reason().
//   - say(text) is NOT exposed: this hook does not use useErebusVoice.
// ─── useErebus Hook ──────────────────────────────────────────────────────
// React hook for accessing Erebus state and functions

import { useState, useEffect, useCallback, useRef } from "react";
import { InitiationEngine } from "../initiation/InitiationEngine";
import { getErebusCore } from "../ErebusCore";
import type { InitiationState, InitiationMessage } from "../types/initiation.types";

export function useErebus() {
  // Store engine in ref — stable across renders
  const engineRef = useRef<InitiationEngine | null>(null);
  const mountedRef = useRef(true);

  // State
  const [state, setState] = useState<InitiationState>(() => {
    // Initialize engine if needed
    if (!engineRef.current) {
      engineRef.current = new InitiationEngine(getErebusCore());
    }
    return engineRef.current.getState();
  });
  
  const [pendingMessage, setPendingMessage] = useState<InitiationMessage | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Get engine safely
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new InitiationEngine(getErebusCore());
    }
    return engineRef.current;
  }, []);

  // ─── Setup engine events ─────────────────────────────────────────────────
  useEffect(() => {
    const engine = getEngine();
    mountedRef.current = true;

    engine.setEvents({
      onStateChange: (newState) => {
        if (mountedRef.current) {
          setState(newState);
        }
      },
      onInitiation: (message) => {
        if (mountedRef.current) {
          setPendingMessage(message);
          setIsSpeaking(true);
          setTimeout(() => {
            if (mountedRef.current) {
              setIsSpeaking(false);
              setPendingMessage(null);
            }
          }, 30000);
        }
      },
      onPresenceChange: (presence) => {
        if (mountedRef.current) {
          setIsThinking(presence === "THINKING");
          setIsSpeaking(presence === "SPEAKING");
        }
      },
      onEmotionChange: (emotion) => {
        // Optional: log or handle emotion changes
        console.log(`[Erebus] Emotion: ${emotion}`);
      },
    });

    engine.start();

    return () => {
      mountedRef.current = false;
      engine.stop();
    };
  }, [getEngine]);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const triggerNow = useCallback(async () => {
    const engine = getEngine();
    const message = await engine.triggerNow();
    if (message) {
      setPendingMessage(message);
    }
    return message;
  }, [getEngine]);

  const toggleDND = useCallback(() => {
    return getEngine().toggleDND();
  }, [getEngine]);

  const updatePersonality = useCallback((trait: any, value: number) => {
    getEngine().updatePersonality(trait, value);
  }, [getEngine]);

  const updateTrigger = useCallback((trigger: any, value: boolean) => {
    getEngine().updateTrigger(trigger, value);
  }, [getEngine]);

  const updateCooldown = useCallback((seconds: number) => {
    getEngine().updateCooldown(seconds);
  }, [getEngine]);

  const clearLog = useCallback(() => {
    getEngine().clearLog();
  }, [getEngine]);

  const dismissPending = useCallback(() => {
    setPendingMessage(null);
    setIsSpeaking(false);
  }, [getEngine]);

  return {
    state,
    pendingMessage,
    isSpeaking,
    isThinking,
    triggerNow,
    toggleDND,
    updatePersonality,
    updateTrigger,
    updateCooldown,
    clearLog,
    dismissPending,
  };
}