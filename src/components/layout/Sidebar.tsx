import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SIDEBAR_SECTIONS, type SidebarSection } from "./sidebar-items";
import { SidebarLogo, useSidebarLogo } from "./SidebarLogo";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  activeItem?: string;
  onItemClick?: (itemId: string) => void;
  routes?: Array<{ path: string; label: string; icon: string }>;
  isActive?: (path: string) => boolean;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  className,
  collapsed = false,
  onToggle,
  activeItem,
  onItemClick,
  routes = [],
  isActive,
  onNavigate,
}) => {
  const logo = useSidebarLogo();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(
      SIDEBAR_SECTIONS
        .filter(s => s.collapsible)
        .map(s => [s.id, s.defaultOpen ?? true])
    )
  );

  const sidebarRef = useRef<HTMLDivElement>(null);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleItemClick = (itemId: string) => {
    onItemClick?.(itemId);
  };

  const renderIcon = (iconName: string): React.ReactElement => {
    const icons: Record<string, React.ReactElement> = {
      LayoutDashboard: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
      Bot: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="4" />
          <path d="M6 10h12" />
          <path d="M6 14h12" />
          <circle cx="9" cy="6" r="1" />
          <circle cx="15" cy="6" r="1" />
        </svg>
      ),
      Calendar: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      CheckSquare: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
      FileText: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      Users: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      DollarSign: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      BarChart3: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      Megaphone: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" />
          <path d="M6 19v-2.5A4.5 4.5 0 0 1 10.5 14.5H17a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      Share2: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.58" y2="10.49" />
        </svg>
      ),
      Music: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      ),
      PenTool: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      ),
      Search: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      Globe: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      Terminal: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
      Cpu: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="1" y1="9" x2="4" y2="9" />
          <line x1="1" y1="15" x2="4" y2="15" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="15" x2="23" y2="15" />
        </svg>
      ),
      Lock: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      Plug: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
          <path d="m2 2 20 20" />
          <path d="M18 16a4 4 0 0 0-8 0" />
          <path d="M22 10a10 10 0 0 0-20 0" />
        </svg>
      ),
      Network: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2" />
          <path d="M6 12h12" />
          <path d="M12 6v12" />
        </svg>
      ),
      Settings: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      BookOpen: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      Contact: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <circle cx="12" cy="10" r="3" />
          <line x1="8" y1="2" x2="8" y2="4" />
          <line x1="16" y1="2" x2="16" y2="4" />
        </svg>
      ),
      Briefcase: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <line x1="12" y1="12" x2="12" y2="12.01" />
        </svg>
      ),
      Mail: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 7L2 7" />
        </svg>
      ),
      MessageSquare: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      UsersRound: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 21a8 8 0 0 0-12 0" />
          <circle cx="12" cy="11" r="4" />
          <path d="M22 20c0-3.3-2-6-5-6" />
          <path d="M2 20c0-3.3 2-6 5-6" />
        </svg>
      ),
      FolderKanban: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 8.1 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          <path d="M8 10v4" />
          <path d="M12 10v2" />
          <path d="M16 10v6" />
        </svg>
      ),
      Building2: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
          <path d="M10 6h4" />
          <path d="M10 10h4" />
          <path d="M10 14h4" />
          <path d="M10 18h4" />
        </svg>
      ),
      Map: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
      ),
      Scale: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      ),
      Sparkles: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 1.9 5.8L20 10.5l-5.8 1.9L12 18l-1.9-5.8L4 10.5l5.8-1.9L12 3Z" />
          <path d="M5 3v4" />
          <path d="M19 17v4" />
          <path d="M3 5h4" />
          <path d="M17 19h4" />
        </svg>
      ),
      Image: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      ),
      Headphones: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 14v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" />
          <path d="M15 14v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2Z" />
          <path d="M3 14a9 9 0 0 1 18 0" />
        </svg>
      ),
      ChevronDown: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      ),
      ChevronRight: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ),
    };
    return icons[iconName] || icons.LayoutDashboard;
  };

  return (
    <motion.aside
      ref={sidebarRef}
      className={cn(
        "fixed left-0 top-0 h-full glass border-r border-white/10 z-40 flex flex-col",
        "transition-all duration-300 ease-out",
        collapsed ? "w-16" : "w-64",
        className
      )}
      initial={false}
      animate={{ width: collapsed ? 64 : 256 }}
      style={{ width: collapsed ? 64 : 256 }}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div
          className={cn(
            "flex items-center justify-between h-16 px-4 border-b border-white/10",
            // Collapsed with a custom logo: stack logo above the chevron to fit 64px.
            collapsed && logo.url && "flex-col justify-center gap-1 px-2"
          )}
        >
          {(!collapsed || logo.url) && <SidebarLogo logo={logo} collapsed={collapsed} />}
          <button
            onClick={onToggle}
            className={cn(
              "p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors",
              collapsed && !logo.url && "ml-auto"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-4 space-y-1" role="navigation" aria-label="Main navigation">
          {SIDEBAR_SECTIONS.map(section => (
            <SidebarSectionComponent
              key={section.id}
              section={section}
              collapsed={collapsed}
              activeItem={activeItem}
              openSections={openSections}
              onToggleSection={toggleSection}
              onItemClick={handleItemClick}
              renderIcon={renderIcon}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-display tracking-widest uppercase text-white text-[10px] truncate">User</p>
                  <p className="text-[9px] text-white/40 truncate">user@lifeos.app</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

interface SidebarSectionComponentProps {
  section: SidebarSection;
  collapsed: boolean;
  activeItem?: string;
  openSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  onItemClick: (itemId: string) => void;
  renderIcon: (name: string) => React.ReactElement;
}

const SidebarSectionComponent: React.FC<SidebarSectionComponentProps> = ({
  section,
  collapsed,
  activeItem,
  openSections,
  onToggleSection,
  onItemClick,
  renderIcon,
}) => {
  const isOpen = openSections[section.id] ?? true;
  const hasActive = section.items.some(item => item.id === activeItem);

  if (collapsed) {
    return (
      <div className="space-y-1">
        {section.items.map(item => (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={cn(
              "w-full flex items-center justify-center p-2 rounded-lg",
              "text-white/50 hover:text-white hover:bg-white/10",
              activeItem === item.id && "bg-primary/20 text-primary",
              "transition-colors relative"
            )}
            title={item.label}
            aria-label={item.label}
            aria-current={activeItem === item.id ? "page" : undefined}
          >
            {renderIcon(item.icon as string)}
            {item.badge && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[7px] bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-2">
        <span className="font-display tracking-widest uppercase text-[9px] text-white/40 px-2">
          {section.label}
        </span>
        {section.collapsible && (
          <button
            onClick={() => onToggleSection(section.id)}
            className="p-1 text-white/40 hover:text-white transition-colors"
            aria-label={isOpen ? `Collapse ${section.label}` : `Expand ${section.label}`}
            aria-expanded={isOpen}
          >
            {renderIcon(isOpen ? "ChevronDown" : "ChevronRight")}
          </button>
        )}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden pl-2"
          >
            {section.items.map(item => (
              <button
                key={item.id}
                onClick={() => onItemClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                  "text-white/70 hover:text-white hover:bg-white/10",
                  activeItem === item.id && "bg-primary/20 text-primary",
                  "transition-colors"
                )}
                aria-current={activeItem === item.id ? "page" : undefined}
              >
                {renderIcon(item.icon as string)}
                <span className="font-display tracking-widest uppercase text-[10px] flex-1 truncate">
                  {item.label}
                </span>
                {item.badge && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[8px] font-display tracking-widest uppercase",
                    item.badgeVariant === "primary" && "bg-primary/20 text-primary",
                    item.badgeVariant === "success" && "bg-emerald-500/20 text-emerald-400",
                    item.badgeVariant === "warning" && "bg-amber-500/20 text-amber-400",
                    item.badgeVariant === "danger" && "bg-red-500/20 text-red-400",
                    item.badgeVariant === "default" && "bg-white/10 text-white/60"
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

Sidebar.displayName = "Sidebar";