import React, { useMemo } from "react";

export default function WaveformVisualizer({
  progress = 0,
  height = 120,
  bars = 80,
  onSeek,
}) {
  const barHeights = useMemo(
    () =>
      Array.from(
        { length: bars },
        () =>
          15 + Math.abs(Math.sin(Math.random() * 10)) * 40 + Math.random() * 45,
      ),
    [bars],
  );

  return (
    <div className="w-full flex items-center gap-[2px]" style={{ height }}>
      {barHeights.map((h, i) => {
        const active = (i / bars) * 100 < progress;
        return (
          <div
            key={i}
            onClick={() => onSeek?.((i / bars) * 100)}
            className="flex-1 rounded-full cursor-pointer transition-all duration-150 hover:opacity-80"
            style={{
              height: `${h}%`,
              background: active
                ? "linear-gradient(180deg, #FF1A40, #DC143C)"
                : "rgba(255,255,255,0.12)",
              boxShadow: active ? "0 0 6px rgba(220,20,60,0.4)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}
