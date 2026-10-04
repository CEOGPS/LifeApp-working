import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ExplodingButton({
  children,
  onClick,
  className = "",
  icon: Icon,
  ...props
}) {
  const [particles, setParticles] = useState([]);
  const [exploding, setExploding] = useState(false);

  const handleExplode = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newParticles = Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2;
      const dist = 40 + Math.random() * 30;
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        delay: Math.random() * 0.05,
      };
    });
    setParticles(newParticles);
    setExploding(true);
    setTimeout(() => setExploding(false), 600);
    if (onClick) onClick(e);
  };

  return (
    <button
      onClick={handleExplode}
      className={`relative overflow-visible ${className}`}
      {...props}
    >
      <div className="relative flex items-center justify-center gap-2 z-10">
        {Icon && (
          <div className="relative">
            <AnimatePresence>
              {!exploding && <Icon className="w-5 h-5" />}
            </AnimatePresence>
            <AnimatePresence>
              {exploding &&
                particles.map((p) => (
                  <motion.span
                    key={p.id}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: p.delay,
                      ease: "easeOut",
                    }}
                    className="absolute top-0 left-0 w-2 h-2 rounded-full bg-crimson pointer-events-none"
                    style={{ boxShadow: "0 0 8px rgba(220,20,60,0.8)" }}
                  />
                ))}
            </AnimatePresence>
          </div>
        )}
        {children}
      </div>
    </button>
  );
}
