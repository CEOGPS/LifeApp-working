// src/pages/music/hooks/useGenerationPoll.ts
// Cancellable polling loop. The old inline `for (…) await sleep(2000)` kept
// running after unmount and set state on dead components. This uses an
// AbortController tied to the caller's lifetime.

import { useCallback, useEffect, useRef } from "react";
import { pollSongStatus } from "../api/music";
import type { GeneratedSong } from "../types";

interface Options {
  intervalMs?: number;
  maxAttempts?: number;
  onUpdate?: (song: GeneratedSong, attempt: number) => void;
}

export function useGenerationPoll({ intervalMs = 2000, maxAttempts = 60, onUpdate }: Options = {}) {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const poll = useCallback(
    async (id: string): Promise<GeneratedSong | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (controller.signal.aborted) return null;
        try {
          await sleep(intervalMs, controller.signal);
        } catch {
          return null;
        }
        if (controller.signal.aborted) return null;
        let song: GeneratedSong;
        try {
          song = await pollSongStatus(id, controller.signal);
        } catch {
          continue;
        }
        onUpdate?.(song, attempt);
        if (song.status !== "generating") return song;
      }
      return null;
    },
    [intervalMs, maxAttempts, onUpdate],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  return { poll, cancel };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}