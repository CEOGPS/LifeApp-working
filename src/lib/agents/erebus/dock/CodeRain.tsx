// src/lib/agents/erebus/dock/CodeRain.tsx
// Matrix code-rain canvas for hologram skins. Fills its parent (the ErebusFace
// wrapper) and reads the parent's live --open level each frame, so the rain
// brightens and speeds up while Erebus talks. Uses the requestAnimationFrame of
// whatever window currently owns the node, so it keeps running inside the
// Picture-in-Picture window when the main tab is in the background.
import { useEffect, useRef } from "react";

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789ABCDEF<>/\\|=+*";

export default function CodeRain({
  rgb = "60,255,140",
  density = 1,
  baseOpacity = 0.55,
}: {
  rgb?: string;
  density?: number;
  /** PATCH (home-page2): resting opacity (the voice level adds on top). */
  baseOpacity?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    let cols: number[] = [];
    let w = 0;
    let h = 0;
    let fontSize = 10;
    let last = 0;
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, (canvas.ownerDocument.defaultView || window).devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fontSize = Math.max(8, Math.round(w / 22));
      const n = Math.ceil((w / fontSize) * density);
      cols = Array.from({ length: n }, () => Math.random() * -h);
    };

    const level = () => {
      const host = canvas.parentElement;
      const v = host ? parseFloat(host.style.getPropertyValue("--open") || "0") : 0;
      return Number.isFinite(v) ? v : 0;
    };

    const frame = (t: number) => {
      if (!alive) return;
      const view = canvas.ownerDocument.defaultView || window;
      raf = view.requestAnimationFrame(frame);
      if (t - last < (reduce ? 120 : 33)) return;
      last = t;
      if (canvas.clientWidth !== w || canvas.clientHeight !== h) resize();
      const lv = level();
      ctx.fillStyle = `rgba(0,0,0,${0.16 - lv * 0.06})`;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.font = `${fontSize}px monospace`;
      const step = w / cols.length;
      for (let i = 0; i < cols.length; i++) {
        const y = cols[i];
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        const head = Math.random() < 0.08 + lv * 0.3;
        ctx.fillStyle = head ? `rgba(220,255,235,${0.85})` : `rgba(${rgb},${0.45 + lv * 0.5})`;
        ctx.fillText(ch, i * step, y);
        cols[i] = y > h + Math.random() * 400 ? Math.random() * -60 : y + fontSize * (0.55 + lv * 1.2);
      }
    };

    resize();
    const view = canvas.ownerDocument.defaultView || window;
    raf = view.requestAnimationFrame(frame);
    return () => {
      alive = false;
      try {
        (canvas.ownerDocument.defaultView || window).cancelAnimationFrame(raf);
      } catch {
        /* ignore */
      }
      cancelAnimationFrame(raf);
    };
  }, [rgb, density]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: `calc(${baseOpacity} + var(--open) * ${Math.max(0, 1 - baseOpacity).toFixed(2)})` as unknown as number,
      }}
    />
  );
}
