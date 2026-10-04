// src/pages/music/components/PanelLayout.tsx
import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PanelLayout({ title, subtitle, icon, actions, children }: Props) {
  return (
    <section className="h-full flex flex-col min-h-0">
      <header className="shrink-0 flex items-center gap-3 pb-3">
        {icon && <div className="text-primary">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-sm font-display tracking-wider text-white-85">{title}</h1>
          {subtitle && <p className="text-[10px] text-white-30">{subtitle}</p>}
        </div>
        {actions && <div className="ml-auto">{actions}</div>}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}