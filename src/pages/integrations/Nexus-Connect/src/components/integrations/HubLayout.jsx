import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Zap, Plug, CalendarClock, KeyRound, ShieldCheck } from "lucide-react";
import NotificationCenter from "@/components/integrations/NotificationCenter";

const navItems = [
  { to: "/", label: "Integrations", icon: Plug, end: true },
  { to: "/rotation", label: "Rotation Schedule", icon: CalendarClock },
  { to: "/accounts", label: "Account Vault", icon: KeyRound },
  { to: "/oauth-providers", label: "OAuth Providers", icon: ShieldCheck },
];

export default function HubLayout() {
  return (
    <div className="min-h-screen bg-slate-50/60">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-slate-900">Integrations Hub</h1>
                <p className="text-[11px] text-slate-500">Connect, secure, and rotate everything</p>
              </div>
            </div>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <NotificationCenter />
        </div>
      </header>

      {/* Mobile nav */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}