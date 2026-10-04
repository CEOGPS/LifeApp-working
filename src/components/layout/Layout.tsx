import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ErebusDock } from "@/components/ErebusDock";
import { cn } from "@/lib/utils";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location]);

  const routes = [
    { path: "/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/contacts", label: "Contacts", icon: "👥" },
    { path: "/crm", label: "CRM", icon: "🎯" },
    { path: "/email", label: "Email", icon: "📧" },
    { path: "/communications", label: "Communications", icon: "💬" },
    { path: "/calendar", label: "Calendar", icon: "📅" },
    { path: "/journal", label: "Journal", icon: "📓" },
    { path: "/finance", label: "Finance", icon: "💰" },
    { path: "/business", label: "Business", icon: "🏢" },
    { path: "/maps", label: "Maps", icon: "🗺️" },
    { path: "/projects", label: "Projects", icon: "📁" },
    { path: "/office", label: "Office", icon: "🏢" },
    { path: "/marketing", label: "Marketing", icon: "📈" },
    { path: "/social", label: "Social", icon: "📱" },
    { path: "/integrations", label: "Integrations", icon: "🔌" },
    { path: "/terminals", label: "Terminals", icon: "⌨️" },
    { path: "/omnisearch", label: "Omnisearch", icon: "🔍" },
    { path: "/simulators", label: "Simulators", icon: "🎮" },
    { path: "/legal", label: "Legal", icon: "⚖️" },
    { path: "/vault", label: "Vault", icon: "🔒" },
    { path: "/music", label: "Music", icon: "🎵" },
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        className={cn(
          "fixed left-0 top-0 z-50 h-screen transition-transform duration-300 ease-in-out lg:translate-x-0",
          isMobile
            ? sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
            : "translate-x-0"
        )}
        routes={routes}
        isActive={isActive}
        onNavigate={() => {
          if (isMobile) setSidebarOpen(false);
        }}
      />

      {/* Main content */}
      <div
        className={cn(
          "transition-all duration-300 min-h-screen",
          isMobile ? "lg:pl-0" : "lg:pl-64"
        )}
      >
        <Topbar onMenuClick={() => setSidebarOpen(true)} isMobile={isMobile} />
        
        <main className="pt-16 lg:pt-20 pb-24 px-4 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Erebus Dock - always at bottom */}
      <ErebusDock />
    </div>
  );
}