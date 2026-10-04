import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  size?: string;
}> = ({ className, variant, size, ...props }) => (
  <button
    {...props}
    className={cn(
      "rounded-lg transition-colors",
      variant === "ghost" && "text-white/60 hover:text-white hover:bg-white/10",
      size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2",
      className
    )}
  />
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} {...props} className={className} />
);
Input.displayName = "Input";

const Empty: React.FC<{
  size?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
}> = ({ icon, title, description }) => (
  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-white/50">
    {icon}
    {title && <p className="text-sm text-white/70">{title}</p>}
    {description && <p className="text-xs">{description}</p>}
  </div>
);

interface TopbarProps {
  className?: string;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  enableNotifications?: boolean;
  notificationCount?: number;
  user?: { name: string; email: string; avatar?: string };
  onProfileClick?: () => void;
  onNotificationsClick?: () => void;
  sidebarCollapsed?: boolean;
  onMenuClick?: () => void;
  isMobile?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  className,
  title,
  breadcrumbs,
  actions,
  searchPlaceholder = "Search LifeOS...",
  onSearch,
  enableNotifications = true,
  notificationCount = 0,
  user,
  onProfileClick,
  onNotificationsClick,
  sidebarCollapsed = false,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setShowUserMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const handleClickOutside = (ref: React.RefObject<HTMLElement | null>, setter: (v: boolean) => void) => {
    return (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setter(false);
      }
    };
  };

  useEffect(() => {
    const handleClick = handleClickOutside(userMenuRef, setShowUserMenu);
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleClick = handleClickOutside(notificationsRef, setShowNotifications);
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const renderIcon = (name: string): React.ReactElement => {
    const icons: Record<string, React.ReactElement> = {
      Search: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
      Bell: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      User: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      ChevronDown: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      ),
      Command: (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
        </svg>
      ),
    };
    return icons[name] || icons.Search;
  };

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-14 glass border-b border-white/10 z-30 flex items-center",
        "transition-all duration-300",
        className
      )}
      style={{ left: "var(--sidebar-width, 256px)" }}
      role="banner"
    >
      <div className="flex items-center justify-between w-full px-4 h-full gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg glass",
              "text-white/40 hover:text-white hover:bg-white/10",
              "transition-all w-full max-w-xs",
              searchOpen && "max-w-md shadow-glow-crimson border-primary/30"
            )}
            aria-label="Search"
          >
            {renderIcon("Search")}
            <Input
              ref={searchRef}
              type="search"
              placeholder={searchPlaceholder}
              className="bg-transparent border-0 focus:ring-0 focus:shadow-none p-0 text-sm text-white placeholder:text-white/30 w-full"
              onChange={e => onSearch?.(e.target.value)}
              onKeyDown={e => e.key === "Escape" && setSearchOpen(false)}
              autoComplete="off"
            />
            <kbd className="px-1.5 py-0.5 text-[8px] bg-white/10 rounded text-white/40 font-mono">
              ⌘K
            </kbd>
          </button>

          {(title || breadcrumbs) && !searchOpen && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="flex items-center gap-1.5" aria-label="Breadcrumb">
                  {breadcrumbs.map((crumb, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <span className="text-white/20 text-sm">/</span>
                      )}
                      {crumb.href ? (
                        <a
                          href={crumb.href}
                          className="font-display tracking-widest uppercase text-[9px] text-white/50 hover:text-white transition-colors"
                        >
                          {crumb.label}
                        </a>
                      ) : (
                        <span className="font-display tracking-widest uppercase text-[9px] text-white">
                          {crumb.label}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </nav>
              )}
              {title && !breadcrumbs && (
                <h1 className="font-display tracking-widest uppercase text-white text-[11px] truncate">
                  {title}
                </h1>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}

          {enableNotifications && (
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={cn(
                  "p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10",
                  "relative transition-colors",
                  showNotifications && "bg-white/10"
                )}
                aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
                aria-expanded={showNotifications}
              >
                {renderIcon("Bell")}
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[8px] font-display tracking-widest uppercase rounded-full flex items-center justify-center">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-80 glass-elevated rounded-xl shadow-glow-crimson border border-white/10 py-2 z-50"
                    role="menu"
                  >
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <h3 className="font-display tracking-widest uppercase text-white text-[10px]">Notifications</h3>
                      <Button variant="ghost" size="sm">Mark all read</Button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <Empty
                        size="sm"
                        icon={renderIcon("Bell")}
                        title="No notifications"
                        description="You're all caught up!"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {user && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="User menu"
                aria-expanded={showUserMenu}
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full rounded-full" />
                  ) : (
                    <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <span className="font-display tracking-widest uppercase text-[10px] text-white hidden sm:block">
                    {user.name}
                  </span>
                )}
                {renderIcon("ChevronDown")}
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 glass-elevated rounded-xl shadow-glow-crimson border border-white/10 py-2 z-50"
                    role="menu"
                  >
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="font-display tracking-widest uppercase text-white text-[10px]">{user.name}</p>
                      <p className="text-[10px] text-white/40 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={onProfileClick}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                      role="menuitem"
                    >
                      {renderIcon("User")}
                      <span className="font-display tracking-widest uppercase text-[10px]">Profile</span>
                    </button>
                    <hr className="border-white/10 mx-2 my-1" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

Topbar.displayName = "Topbar";