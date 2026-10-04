import { useCallback, useRef, type MouseEvent, type ReactNode } from "react";
import { motion } from "motion/react";

function useModuleTilt() {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;

    const bounds = element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    element.style.transform = `perspective(1000px) rotateX(${-y * 4}deg) rotateY(${x * 4}deg)`;
  }, []);

  const onMouseLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = "";
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}

type ModuleProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
  accent?: boolean;
};

export default function Module({
  title,
  icon,
  children,
  className = "",
  headerRight,
  accent,
}: ModuleProps) {
  const { ref, onMouseMove, onMouseLeave } = useModuleTilt();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`module-card flex flex-col overflow-hidden ${className}`}
      style={{ willChange: "transform" }}
    >
      {/* Module header */}
            <div
              className={`flex items-center justify-between px-4 py-3 border-b shrink-0
              ${accent ? "border-primary/25 bg-primary/6" : "border-white/6"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-primary">{icon}</span>
                <span className="font-display text-base tracking-wider uppercase text-white/90">
                  {title}
                </span>
              </div>
              {headerRight && <div>{headerRight}</div>}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden p-4 text-white/85">{children}</div>
    </motion.div>
  );
}