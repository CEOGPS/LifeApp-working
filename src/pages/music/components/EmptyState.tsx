// src/pages/music/components/EmptyState.tsx
import type { ComponentType } from "react";

interface Props {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  hint?: string;
}

export function EmptyState({ icon: Icon, title, hint }: Props) {
  return (
    <div className="flex items-center justify-center h-full text-center">
      <div>
        <Icon size={32} className="mx-auto text-white-10 mb-2" />
        <div className="text-sm text-white-30">{title}</div>
        {hint && <div className="text-[11px] text-white-20 mt-1">{hint}</div>}
      </div>
    </div>
  );
}