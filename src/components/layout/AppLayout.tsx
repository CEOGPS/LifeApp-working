import React, { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/platform/utils/cn";
import { PanelLayout, Sidebar, Topbar, PlaceholderPanel } from "./index";
import AppBanner from "./AppBanner";
import { ErebusDock } from "@/components/ErebusDock";
// PATCH (erebus-dock-redesign): center AI stage (shared live Erebus avatar) on every page.
import AIStage from "@/lib/agents/erebus/dock/AIStage";
import { SIDEBAR_SECTIONS, SIDEBAR_ITEMS, type SidebarItem } from "./sidebar-items";
import CalendarPanel from "@/pages/calendar/CalendarPanel";
import MarketingPanel from "@/pages/marketing/MarketingPanel";
import CommunityPanel from "@/pages/community/CommunityPanel";

interface AppLayoutProps {
  user?: { name: string; email: string; avatar?: string } | null;
  onSignOut?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ user, onSignOut }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const activeItem = SIDEBAR_ITEMS.find((item) => {
    if (!item.href) return false;
    if (item.href === location.pathname) return true;
    if (item.href !== "/" && location.pathname.startsWith(item.href + "/")) return true;
    return false;
  })?.id;

  const handleItemClick = (itemId: string) => {
    const item = SIDEBAR_ITEMS.find(i => i.id === itemId);
    if (item?.href) {
      navigate(item.href);
    }
    if (item?.onClick) {
      item.onClick();
    }
    setMobileSidebarOpen(false);
  };

  const sidebar = (
    <Sidebar
      collapsed={sidebarCollapsed}
      onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      activeItem={activeItem}
      onItemClick={handleItemClick}
    />
  );

  const topbar = (
    <Topbar
      title={getPageTitle(location.pathname)}
      breadcrumbs={getBreadcrumbs(location.pathname)}
      enableNotifications={true}
      notificationCount={0} /* PATCH (erebus-dock-redesign): was a hard-coded 3 while the dropdown has no feed; 0 until a real feed is wired */
      user={user || undefined}
      onProfileClick={() => navigate("/preferences")}
      sidebarCollapsed={sidebarCollapsed}
    />
  );

  return (
    <>
    <PanelLayout
      sidebar={sidebar}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      topbar={topbar}
      headerBanner={<AppBanner />}
      padding="md"
      maxWidth="none"
      gridBackground={true}
    >
      {/* PATCH (home-page2): no wide stage strip on the home page; Erebus lives in its centre column there. */}
      {location.pathname !== "/dashboard" && <AIStage />}
      <Outlet />
    </PanelLayout>
    {/* Erebus AI dock (✦, bottom-right) on every page. /ai-dock already renders it as its page. */}
    {location.pathname !== "/ai-dock" && <ErebusDock />}
    </>
  );
};

function getPageTitle(pathname: string): string {
  const item = SIDEBAR_ITEMS.find(i => i.href === pathname);
  return item?.label || "Dashboard";
}

function getBreadcrumbs(pathname: string): Array<{ label: string; href?: string }> {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard", href: "/" }];

  const breadcrumbs: Array<{ label: string; href?: string }> = [{ label: "Dashboard", href: "/" }];
  let currentPath = "";

  for (const segment of segments) {
    currentPath += `/${segment}`;
    const item = SIDEBAR_ITEMS.find(i => i.href === currentPath);
    if (item) {
      breadcrumbs.push({ label: item.label, href: currentPath });
    } else {
      breadcrumbs.push({ label: segment.charAt(0).toUpperCase() + segment.slice(1) });
    }
  }

  return breadcrumbs;
}

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Dashboard"
        description="Your unified command center is coming together. Panels will appear here once modules are wired."
        variant="coming-soon"
      />
    </div>
  );
};

export const AIDockPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="AI Dock"
        description="Erebus autonomous agent dock with proactive speech, avatar, and sub-agent orchestration."
        variant="coming-soon"
      />
    </div>
  );
};

export const CalendarPage: React.FC = () => <CalendarPanel />;

export const TasksPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Tasks"
        description="Kanban + list hybrid with AI prioritization, recurring tasks, and project rollups."
        variant="coming-soon"
      />
    </div>
  );
};

export const NotesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Notes"
        description="Rich text notes with bidirectional linking, tags, and AI summarization."
        variant="coming-soon"
      />
    </div>
  );
};

export const LeadsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Leads CRM"
        description="Pipeline management with email sequences, enrichment, and AI scoring."
        variant="coming-soon"
      />
    </div>
  );
};

export const FinancePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Finance"
        description="Net worth tracking, budgeting, investments, credit monitoring, and AI money tips."
        variant="coming-soon"
      />
    </div>
  );
};

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Analytics"
        description="Unified analytics across web, social, email, and business metrics."
        variant="coming-soon"
      />
    </div>
  );
};

export const MarketingPage: React.FC = () => <MarketingPanel />;

export const CommunityPage: React.FC = () => <CommunityPanel />;

export const SocialPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Social"
        description="Multi-platform publishing, engagement tracking, and content calendar."
        variant="coming-soon"
      />
    </div>
  );
};

export const VeritonPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Veriton Music Creator"
        description="AI-powered music generation, stem separation, and DAW integration."
        variant="coming-soon"
      />
    </div>
  );
};

export const CreatorOSPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="CreatorOS"
        description="Content pipeline: ideation → creation → publishing → analytics."
        variant="coming-soon"
      />
    </div>
  );
};

export const OmniSearchPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="OmniSearch"
        description="Universal search across all your data, apps, and the web."
        variant="coming-soon"
      />
    </div>
  );
};

export const BrowserPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Browser"
        description="Embedded browser with session management, automation, and scraper."
        variant="coming-soon"
      />
    </div>
  );
};

export const TerminalPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Terminal"
        description="Full xterm.js terminal with SSH, local shell, and AI command assist."
        variant="coming-soon"
      />
    </div>
  );
};

export const SimulatorsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Simulators"
        description="Monte Carlo, scenario planning, financial modeling, and decision trees."
        variant="coming-soon"
      />
    </div>
  );
};

export const VaultPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Vault"
        description="Encrypted secrets, passwords, API keys, and secure notes."
        variant="coming-soon"
      />
    </div>
  );
};

export const IntegrationsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Integrations"
        description="OAuth connections for Google, Microsoft, Notion, Slack, GitHub, Stripe, and 50+ services."
        variant="coming-soon"
      />
    </div>
  );
};

export const AgentsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Agents"
        description="AgentZero orchestrator with Erebus, Kranos, Nova, Leo, Atlas, Iris, Echo, Aura sub-agents."
        variant="coming-soon"
      />
    </div>
  );
};

export const PreferencesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PlaceholderPanel
        title="Preferences"
        description="Theme, notifications, AI behavior, privacy, and advanced settings."
        variant="coming-soon"
      />
    </div>
  );
};