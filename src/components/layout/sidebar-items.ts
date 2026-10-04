export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
  badgeVariant?: "default" | "primary" | "success" | "warning" | "danger";
  children?: SidebarItem[];
  href?: string;
  onClick?: () => void;
}

export interface SidebarSection {
  id: string;
  label: string;
  items: SidebarItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

/** Flat menu. No category headers. Order is the product list. */
export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: "lifeos",
    label: "",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", href: "/dashboard" },
      { id: "email", label: "Email", icon: "Mail", href: "/email" },
      { id: "communications", label: "Messages", icon: "MessageSquare", href: "/communications" },
      { id: "calendar", label: "Calendar", icon: "Calendar", href: "/calendar" },
      { id: "crm", label: "CRM", icon: "Briefcase", href: "/crm" },
      { id: "contacts", label: "Contacts", icon: "Contact", href: "/contacts" },
      { id: "omni-search", label: "OmniSearch", icon: "Search", href: "/omni" },
      { id: "social", label: "Social", icon: "Share2", href: "/social" },
      { id: "marketing", label: "Marketing", icon: "Megaphone", href: "/marketing" },
      { id: "leads", label: "Leads", icon: "Users", href: "/leads" },
      { id: "creator", label: "Creator", icon: "PenTool", href: "/creator" },
      { id: "music-einstein", label: "Music Einstein", icon: "Music", href: "/music-einstein" },
      { id: "lucid", label: "Lucid", icon: "Sparkles", href: "/lucid" },
      { id: "music", label: "Music", icon: "Headphones", href: "/music" },
      { id: "media", label: "Media", icon: "Image", href: "/media" },
      { id: "office", label: "Office", icon: "Building2", href: "/office" },
      { id: "projects", label: "Projects", icon: "FolderKanban", href: "/projects" },
      { id: "maps", label: "Maps", icon: "Map", href: "/maps" },
      { id: "legal", label: "Legal", icon: "Scale", href: "/legal" },
      { id: "journal", label: "Journal", icon: "BookOpen", href: "/journal" },
      { id: "simulators", label: "Simulators", icon: "Cpu", href: "/simulators" },
      { id: "vault", label: "Vault", icon: "Lock", href: "/vault" },
      { id: "agents", label: "AI Hub", icon: "Network", href: "/agents" },
      { id: "integrations", label: "Integrations", icon: "Plug", href: "/integrations" },
      { id: "preferences", label: "Settings", icon: "Settings", href: "/preferences" },
    ],
  },
];

export const SIDEBAR_ITEMS = SIDEBAR_SECTIONS.flatMap((s) => s.items);
