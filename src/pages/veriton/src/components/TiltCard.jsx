import React, { useRef, useState } from "react";

export default function TiltCard({
  children,
  className = "",
  glowOnHover = true,
  onClick,
  selected = false,
}) {
  const ref = useRef(null);
  const [transform, setTransform] = useState("");
  const [shadow, setShadow] = useState("");

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    setTransform(
      `perspective(1000px) translateY(-6px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
    );
    setShadow(
      `${rotateY * -2}px ${rotateX * -2 + 8}px 30px rgba(220,20,60,0.2)`,
    );
  };

  const handleMouseLeave = () => {
    setTransform("");
    setShadow("");
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`glass ${glowOnHover ? "glass-hover" : ""} ${selected ? "glow-pulse border-crimson/40" : ""} transition-transform duration-200 ease-out cursor-pointer ${className}`}
      style={{
        transform,
        boxShadow: shadow || undefined,
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
