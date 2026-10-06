import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PageKeep } from "./page-keep";
import { onSoundChange, playTone, setMuted, setVolume, soundPrefs } from "./sound";
import { applyMotion } from "./app-settings";
import { AgentFloat } from "./dock";
import { stopCut, togglePause, usePlayer } from "./player";
import {
  Bell,
  BarChart3,
  Bot,
  Briefcase,
  CalendarDays,
  Clapperboard,
  Dices,
  FileText,
  FolderKanban,
  Images,
  Landmark,
  LayoutDashboard,
  Library,
  Lock,
  Mail,
  Map,
  Megaphone,
  MessageSquare,
  Music,
  NotebookPen,
  Plug,
  Search,
  Settings,
  Share2,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

export const NAV = [
  { slug: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { slug: "email", label: "Email", icon: Mail },
  { slug: "messages", label: "Messages", icon: MessageSquare },
  { slug: "calendar", label: "Calendar", icon: CalendarDays },
  { slug: "crm", label: "CRM", icon: Briefcase },
  { slug: "contacts", label: "Contacts", icon: Users },
  { slug: "omnisearch", label: "OmniSearch", icon: Search },
  { slug: "social", label: "Social", icon: Share2 },
  { slug: "marketing", label: "Marketing", icon: Megaphone },
  { slug: "analytics", label: "Analytics", icon: BarChart3 },
  { slug: "leads", label: "Leads", icon: Target },
  { slug: "creator", label: "Creator", icon: Clapperboard },
  { slug: "music-einstein", label: "Music Einstein", icon: Music },
  { slug: "lucid", label: "Lucid", icon: Sparkles },
  { slug: "music", label: "Music", icon: Library },
  { slug: "media", label: "Media", icon: Images },
  { slug: "office", label: "Office", icon: FileText },
  { slug: "finance", label: "Finance", icon: Landmark },
  { slug: "projects", label: "Projects", icon: FolderKanban },
  { slug: "maps", label: "Maps", icon: Map },
  { slug: "journal", label: "Journal", icon: NotebookPen },
  { slug: "simulators", label: "Simulators", icon: Dices },
  { slug: "vault", label: "Vault", icon: Lock },
  { slug: "ai-hub", label: "AI Hub", icon: Bot },
  { slug: "integrations", label: "Integrations", icon: Plug },
  { slug: "settings", label: "Settings", icon: Settings },
] as const;

export type PanelSlug = (typeof NAV)[number]["slug"];

export function isPanel(slug: string): slug is Exclude<PanelSlug, "dashboard"> {
  return NAV.some((item) => item.slug === slug && item.slug !== "dashboard");
}

function readImage(file: File, onDone: (value: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const width = Math.max(1, Math.min(img.width, 1600));
      const height = Math.max(1, Math.round(img.height * (width / img.width)));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.72;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 160_000 && quality > 0.42) {
        quality -= 0.08;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      onDone(data);
    };
    img.src = String(reader.result || "");
  };
  reader.readAsDataURL(file);
}

export function Shell({
  active,
  banner,
  logo,
  onBanner,
  onLogo,
  status,
  children,
}: {
  active: string;
  banner: string;
  logo: string;
  onBanner: (value: string) => void;
  onLogo: (value: string) => void;
  status: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [spot, setSpot] = useState({ x: -200, y: -200 });
  const [sound, setSound] = useState({ muted: false, volume: 0.7 });
  const page = NAV.find((item) => item.slug === active)?.label || "Dashboard";
  const playing = usePlayer();

  useEffect(() => {
    setCollapsed(localStorage.getItem("lifeos.nav") === "1");
    setSound(soundPrefs());
    applyMotion();
    return onSoundChange(() => setSound(soundPrefs()));
  }, []);

  useEffect(() => {
    localStorage.setItem("lifeos.nav", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div
      className="dot-field relative min-h-dvh text-fg"
      suppressHydrationWarning
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setSpot({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }}
      onMouseLeave={() => setSpot({ x: -200, y: -200 })}
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-sound='off']")) return;
        if (target.closest("button, a")) playTone("tap");
      }}
      onSubmit={() => playTone("save")}
    >
      <div className="dot-spot" style={{ ["--mx" as string]: `${spot.x}px`, ["--my" as string]: `${spot.y}px` }} />
      <div className={`relative md:grid ${collapsed ? "md:grid-cols-[4rem_1fr]" : "md:grid-cols-[16rem_1fr]"}`}>
        <aside className={`${open ? "block" : "hidden"} glass border-white/10 md:block md:min-h-dvh md:border-r`}>
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            {logo ? <img src={logo} alt="" className="h-8 w-8 rounded-md object-cover" /> : null}
            {!collapsed ? <p className="font-display text-[11px] tracking-widest text-primary">LIFEOS</p> : null}
            <button type="button" className="text-white/50" aria-label="Collapse sidebar" onClick={() => setCollapsed((value) => !value)}>
              <span className="text-lg">{collapsed ? ">" : "<"}</span>
            </button>
          </div>
          <nav className="flex h-[calc(100dvh-9rem)] flex-col gap-1 overflow-y-auto px-2 py-4">
            {NAV.map((item) => {
              const on = item.slug === active;
              return (
                <Link
                  key={item.slug}
                  to={item.slug === "dashboard" ? "/" : "/panel/$slug"}
                  params={item.slug === "dashboard" ? undefined : { slug: item.slug }}
                  onClick={() => setOpen(false)}
                  className={`nav-link flex min-h-10 items-center gap-3 px-3 ${on ? "is-on" : "hover:bg-white/10 hover:text-white"}`}
                >
                  <item.icon size={16} aria-hidden />
                  {!collapsed ? item.label : null}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="glass flex items-center gap-3 rounded-lg p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Users size={16} />
              </span>
              {!collapsed ? (
                <span>
                  <span className="block font-display text-[10px] tracking-widest text-white">USER</span>
                  <span className="block text-[11px] text-white/40">user@lifeos.app</span>
                </span>
              ) : null}
            </div>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="glass flex h-14 items-center gap-4 border-b border-white/10 px-4">
            <button type="button" className="text-sm text-primary md:hidden" onClick={() => setOpen((value) => !value)}>
              {open ? "Close" : "Menu"}
            </button>
            <label className="glass flex min-h-9 max-w-xs flex-1 items-center gap-2 rounded-lg px-3 text-white/40">
              <Search size={14} />
              <input className="w-full bg-transparent text-sm text-white outline-none" style={{ caretColor: "transparent" }} placeholder="Search LifeOS..." />
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[8px]">⌘K</kbd>
            </label>
            <p className="hidden font-display text-[9px] tracking-widest text-white/50 md:block">DASHBOARD / {page}</p>
            <div className="ml-auto flex items-center gap-2" data-sound="off">
              <button type="button" className="dock-bar" onClick={() => { setMuted(!sound.muted); if (!sound.muted) window.speechSynthesis?.cancel(); else playTone("tap"); }}>{sound.muted ? "Muted" : "Sound"}</button>
              <input className="h-1 w-16 accent-violet-400" type="range" min={0} max={1} step={0.05} value={sound.volume} aria-label="Volume" onChange={(event) => setVolume(Number(event.target.value))} />
            </div>
            <span className="text-white/50"><Bell size={16} /></span>
            <label className="cursor-pointer text-[10px] tracking-widest text-white/40">
              LOGO
              <input type="file" accept="image/*" className="sr-only" style={{ caretColor: "transparent" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) readImage(file, onLogo); }} />
            </label>
          </header>
          <div className="relative h-28 overflow-hidden border-b border-white/5">
            <img src={banner || "/banner.png"} alt="" className="h-full w-full object-cover" />
            <label className="absolute inset-0 cursor-pointer">
              <input type="file" accept="image/*" className="sr-only" style={{ caretColor: "transparent" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) readImage(file, onBanner); }} />
            </label>
            <p className="pointer-events-none absolute top-3 right-4 hidden font-mono text-[10px] text-green md:block">{status}</p>
          </div>
          <div className={`px-4 py-4 ${playing.track ? "pb-24" : ""}`}><PageKeep page={active}>{children}</PageKeep></div>
        </div>
      </div>
      {playing.track ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 px-4 py-2 backdrop-blur" data-sound="off">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            {playing.track.art ? <img src={playing.track.art} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white/40">♪</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{playing.track.title}</p>
              <p className="truncate text-[11px] text-white/40">{playing.track.artist}</p>
            </div>
            <button type="button" className="quiet is-on" onClick={togglePause}>{playing.paused ? "Play" : "Pause"}</button>
            <button type="button" className="link-remove" onClick={stopCut}>Stop</button>
          </div>
          {!playing.track.url && playing.track.page.includes("open.spotify.com/") ? (
            <iframe title={playing.track.title} className="mx-auto mt-2 h-20 w-full max-w-5xl rounded-xl" src={`${playing.track.page.replace("open.spotify.com/", "open.spotify.com/embed/")}?autoplay=1`} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
          ) : null}
        </div>
      ) : null}
      <AgentFloat />
    </div>
  );
}
