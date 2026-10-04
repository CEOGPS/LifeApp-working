import { useCallback, useEffect, useState } from "react";
import { loadBoard, saveBoard } from "@/lib/lifeos/api";
import type { Board } from "@/lib/lifeos/board";

export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadBoard()
      .then((next) => {
        if (live) setBoard(next);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "Could not load the board");
      });
    return () => {
      live = false;
    };
  }, []);

  const update = useCallback((recipe: (prev: Board) => Board) => {
    setBoard((prev) => {
      if (!prev) return prev;
      const next = recipe(prev);
      void saveBoard({ data: next }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Save failed");
      });
      return next;
    });
  }, []);

  return { board, update, error };
}
