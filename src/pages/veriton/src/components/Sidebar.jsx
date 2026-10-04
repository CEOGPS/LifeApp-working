import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Library,
  ListMusic,
  Sparkles,
  Clapperboard,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = pathname.startsWith("/music-einstein") ? "/music-einstein" : "/veriton";
  const navItems = [
    { to: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { to: `${base}/library`, label: "Library", icon: Library },
    { to: `${base}/playlists`, label: "Playlists", icon: ListMusic },
    { to: `${base}/video-studio`, label: "Video Studio", icon: Clapperboard },
  ];

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 220 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="glass-strong relative flex h-full shrink-0 flex-col p-3"
      style={{ borderRadius: 20 }}
    >
      <div className="flex items-center gap-3 px-2 py-3 mb-4">
        <div className="w-9 h-9 rounded-xl crimson-gradient flex items-center justify-center shrink-0 glow-pulse">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <div className="font-display font-bold text-sm leading-none crimson-text-gradient">
                Music Einstein
              </div>
              <div className="text-[10px] text-gray-500 leading-none mt-1">
                Music & Video Studio
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                isActive
                  ? "text-white bg-crimson/20 border border-crimson/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-crimson" : ""}`} />
                {!collapsed && <span className="whitespace-nowrap font-medium">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <button
          onClick={() => navigate(`${base}/create`)}
          className="w-full crimson-gradient rounded-2xl flex items-center gap-3 px-3 py-3.5 text-white font-semibold text-sm transition-all duration-200 hover:scale-[1.03] glow-pulse"
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Create</span>}
        </button>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-10 w-6 h-6 glass-strong rounded-full flex items-center justify-center text-gray-400 hover:text-crimson transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
}
