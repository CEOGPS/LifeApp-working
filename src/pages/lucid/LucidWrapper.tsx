// Embeds Lucid inside the LifeOS router. No second router. No login.
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { Zap, LayoutGrid, Rocket, Activity, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const StrategyHub = lazy(() => import("./StrategyHub").then(m => ({ default: m.default })));
const CampaignDashboard = lazy(() => import("./CampaignDashboard").then(m => ({ default: m.default })));
const ActivityLog = lazy(() => import("./ActivityLog").then(m => ({ default: m.default })));
const FinancialAccounts = lazy(() => import("./FinancialAccounts").then(m => ({ default: m.default })));
const PageNotFound = lazy(() => import("./PageNotFound").then(m => ({ default: m.default })));

const NAV = [
  { label: "Strategy Hub", path: "/lucid/strategies", icon: LayoutGrid },
  { label: "Campaigns", path: "/lucid/campaigns", icon: Rocket },
  { label: "Activity Log", path: "/lucid/activity", icon: Activity },
  { label: "Financial", path: "/lucid/accounts", icon: Wallet },
];

function LucidLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-[70vh] bg-[#050505] text-white">
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-white/5">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Lucid Systems</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  on ? "bg-primary/20 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function LucidWrapper() {
  return (
    <PanelLayout
      title="Lucid Systems"
      subtitle="AI Marketing Strategy & Campaign Management"
      icon={<Zap className="text-primary" />}
    >
      <QueryClientProvider client={queryClientInstance}>
        <Suspense fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }>
          <Routes>
            <Route path="/lucid" element={<LucidLayout />}>
              <Route index element={<Navigate to="/lucid/strategies" replace />} />
              <Route path="strategies" element={<StrategyHub />} />
              <Route path="campaigns" element={<CampaignDashboard />} />
              <Route path="activity" element={<ActivityLog />} />
              <Route path="accounts" element={<FinancialAccounts />} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </QueryClientProvider>
    </PanelLayout>
  );
}
