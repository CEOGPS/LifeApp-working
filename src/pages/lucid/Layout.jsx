// src/components/Layout.jsx
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { UserPlus, LayoutGrid, Rocket, Activity, Wallet, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Onboarding', path: '/onboarding', icon: UserPlus },
  { label: 'Strategy Hub', path: '/strategies', icon: LayoutGrid },
  { label: 'Campaigns', path: '/campaigns', icon: Rocket },
  { label: 'Activity Log', path: '/activity', icon: Activity },
  { label: 'Financial', path: '/accounts', icon: Wallet },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-56 shrink-0 border-r border-border bg-card/40 flex flex-col">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-heading font-semibold tracking-tight text-sm">CEO GPS</span>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">Agent online</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}