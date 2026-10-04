import React from "react";
import TiltCard from "./TiltCard";

export default function GlowChip({
  label,
  selected,
  onClick,
  icon: Icon,
  className = "",
}) {
  return (
    <div onClick={onClick} className="inline-block">
      <div
        className={`
          glass px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer
          flex items-center gap-2 select-none
          ${selected ? "border-crimson/50 text-white" : "text-gray-400 hover:text-white hover:border-white/20"}
          ${selected ? "glow-pulse" : ""}
          ${className}
        `}
      >
        {Icon && (
          <Icon className={`w-4 h-4 ${selected ? "text-crimson" : ""}`} />
        )}
        {label}
      </div>
    </div>
  );
}
