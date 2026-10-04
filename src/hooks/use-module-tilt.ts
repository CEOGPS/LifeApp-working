import { useCallback, useRef } from "react";

/**
 * Returns mouse event handlers that apply a 3D tilt + cursor-position CSS vars
 * to any element. Attach onMouseMove / onMouseLeave to the element.
 */
export function useModuleTilt() {
  const ref = useRef<HTMLDivElement | null>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateX = ((y - cy) / cy) * -6;
    const rotateY = ((x - cx) / cx) * 6;
    const pctX = ((x / rect.width) * 100).toFixed(1);
    const pctY = ((y / rect.height) * 100).toFixed(1);
    el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(6px)`;
    el.style.boxShadow = `0 12px 40px oklch(0 0 0 / 60%), 0 0 24px oklch(0.55 0.22 20 / 20%)`;
    el.style.setProperty("--mouse-x", `${pctX}%`);
    el.style.setProperty("--mouse-y", `${pctY}%`);
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.boxShadow = "";
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}