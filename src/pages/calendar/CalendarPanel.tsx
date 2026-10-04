// src/panels/CalendarPanel.tsx
// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR PANEL — Single-file TSX bundle
// Month view · Event manager · AI promote/plan/invite · Persistent
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Clock, MapPin, Users,
  Trash2, Loader2, X, AlertCircle, Check, Sparkles, Download, Copy,
  Filter, Ticket, Wand2, RefreshCw,
} from "lucide-react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { invokeLLM } from "@/lib/ai.js";

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ TYPES ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

type EventType = "Business" | "Community" | "Personal" | "Family";
type EventStatus = "Idea" | "Planning" | "Confirmed";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;            // YYYY-MM-DD
  time?: string;
  location?: string;
  type: EventType;
  status: EventStatus;
  emoji: string;
  attendees?: number;
  revenue?: number;
  notes?: string;
}

interface Toast { id: string; message: string; kind: "info" | "success" | "error" }
type AIAction = "promote" | "plan" | "email";

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ CONSTANTS ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPES: EventType[] = ["Business", "Community", "Personal", "Family"];
const STATUSES: EventStatus[] = ["Idea", "Planning", "Confirmed"];

const STATUS_COLORS: Record<EventStatus, string> = {
  Confirmed: "#00c896",
  Planning: "#ff8c42",
  Idea: "#8b7fff",
};

const TYPE_COLORS: Record<EventType, string> = {
  Business: "#4ab3f4",
  Community: "#ff6b9d",
  Personal: "#ff8c42",
  Family: "#00c896",
};

const EMOJI_OPTIONS = ["🎟️", "🎉", "💼", "🏠", "🍽️", "🎤", "🎬", "📊", "🎓", "🏋️"];

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ HELPERS ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseISO = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const prettyDate = (s: string): string => {
  try {
    return parseISO(s).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  } catch { return s; }
};

const uid = (): string => `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/* ── Storage ── */

const LS_KEY = "lifeos_calendar_events_v1";

function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CalendarEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveEvents(events: CalendarEvent[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(events)); } catch { /* quota */ }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ TOASTS ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

const toastListeners = new Set<(t: Toast) => void>();
let toastSeq = 0;
function toast(message: string, kind: Toast["kind"] = "info"): void {
  const t: Toast = { id: `t${++toastSeq}`, message, kind };
  toastListeners.forEach((l) => l(t));
}
function useToasts() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const push = (t: Toast) => {
      setItems((p) => [...p, t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 4200);
    };
    toastListeners.add(push);
    return () => { toastListeners.delete(push); };
  }, []);
  const dismiss = useCallback((id: string) => setItems((p) => p.filter((x) => x.id !== id)), []);
  return { items, dismiss };
}

function Toasts() {
  const { items, dismiss } = useToasts();
  if (!items.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 max-w-sm pointer-events-none">
      {items.map((t) => (
        <div key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg text-xs backdrop-blur-xl border
            ${t.kind === "success" ? "border-teal-400/40 text-teal-300 bg-black/85" :
              t.kind === "error" ? "border-red-400/50 text-red-300 bg-black/85" :
              "border-white/15 text-white-80 bg-black/85"}`}>
          {t.kind === "success" && <Check size={12} />}
          {t.kind === "error" && <AlertCircle size={12} />}
          {t.kind === "info" && <Sparkles size={12} />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100">
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ EVENT FORM (modal) ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

interface EventFormProps {
  initial: Partial<CalendarEvent> & { date: string };
  onSave: (e: CalendarEvent) => void;
  onCancel: () => void;
}

function EventForm({ initial, onSave, onCancel }: EventFormProps) {
  const [form, setForm] = useState<CalendarEvent>({
    id: initial.id ?? uid(),
    title: initial.title ?? "",
    date: initial.date ?? iso(new Date()),
    time: initial.time ?? "",
    location: initial.location ?? "",
    type: initial.type ?? "Business",
    status: initial.status ?? "Idea",
    emoji: initial.emoji ?? "🎟️",
    attendees: initial.attendees,
    revenue: initial.revenue,
    notes: initial.notes,
  });

  const set = <K extends keyof CalendarEvent>(k: K, v: CalendarEvent[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast("Title required.", "error"); return; }
    onSave({ ...form, title: form.title.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="col-span-2 block">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">EVENT NAME *</div>
          <input
            autoFocus
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Team planning session"
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/50"
          />
        </label>

        <label className="block">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">DATE</div>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 focus:outline-none focus:border-[#4ab3f4]/50"
          />
        </label>

        <label className="block">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">TIME</div>
          <input
            value={form.time}
            onChange={(e) => set("time", e.target.value)}
            placeholder="2:00 PM"
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/50"
          />
        </label>

        <label className="col-span-2 block">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">LOCATION</div>
          <input
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Zoom / address / venue"
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/50"
          />
        </label>

        <label className="block">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">TYPE</div>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value as EventType)}
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 focus:outline-none focus:border-[#4ab3f4]/50"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">STATUS</div>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as EventStatus)}
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 focus:outline-none focus:border-[#4ab3f4]/50"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">ATTENDEES</div>
          <input
            type="number"
            min={0}
            value={form.attendees ?? ""}
            onChange={(e) => set("attendees", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/50"
          />
        </label>

        <label className="block">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">REVENUE ($)</div>
          <input
            type="number"
            min={0}
            value={form.revenue ?? ""}
            onChange={(e) => set("revenue", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/50"
          />
        </label>

        <div className="col-span-2">
          <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">EMOJI</div>
          <div className="flex flex-wrap gap-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set("emoji", e)}
                className={`w-8 h-8 rounded-lg text-base transition-all
                  ${form.emoji === e ? "bg-[#4ab3f4]/20 border border-[#4ab3f4]" : "bg-white/[0.03] border border-white/8 hover:bg-white/8"}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white-60 hover:bg-white/8 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-3 py-2 rounded-lg glass-crimson border border-[#ff4f5e]/40 text-[#ff4f5e] text-[11px] font-bold hover:glow-crimson-sm transition-all"
        >
          Save Event
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ MAIN PANEL ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CalendarPanel() {
  const today = useMemo(() => new Date(), []);
  const [cur, setCur] = useState<Date>(today);
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadEvents());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventType | "All">("All");
  const [addingFor, setAddingFor] = useState<string | null>(null); // ISO date of new event being created
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiState, setAiState] = useState<{ eventId: string | null; action: AIAction | null; loading: boolean; result: string; error: string | null }>({
    eventId: null, action: null, loading: false, result: "", error: null,
  });

  const formRef = useRef<HTMLDivElement | null>(null);

  /* Persist */
  useEffect(() => { saveEvents(events); }, [events]);

  /* Grid math */
  const year = cur.getFullYear();
  const month = cur.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  /* Group events by date for quick lookup */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  /* Filtered for stats + upcoming */
  const filteredEvents = useMemo(() => {
    return filter === "All" ? events : events.filter((e) => e.type === filter);
  }, [events, filter]);

  const todayIso = iso(today);

  const upcoming = useMemo(() => {
    return [...filteredEvents]
      .filter((e) => e.date >= todayIso)
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return (a.time ?? "").localeCompare(b.time ?? "");
      });
  }, [filteredEvents, todayIso]);

  const stats = useMemo(() => {
    const totalAttendees = filteredEvents.reduce((s, e) => s + (e.attendees ?? 0), 0);
    const totalRevenue = filteredEvents.reduce((s, e) => s + (e.revenue ?? 0), 0);
    return {
      upcoming: upcoming.length,
      attendees: totalAttendees,
      revenue: totalRevenue,
    };
  }, [filteredEvents, upcoming]);

  /* Selected day events */
  const selectedDayEvents = selectedDate
    ? (eventsByDate.get(selectedDate) ?? []).filter((e) => filter === "All" || e.type === filter)
    : [];

  /* Add / edit */
  const saveEvent = useCallback((ev: CalendarEvent) => {
    setEvents((prev) => {
      const idx = prev.findIndex((x) => x.id === ev.id);
      if (idx === -1) return [ev, ...prev];
      const next = [...prev];
      next[idx] = ev;
      return next;
    });
    setAddingFor(null);
    setEditingId(null);
    toast(editingId ? "Event updated." : "Event created.", "success");
  }, [editingId]);

  const deleteEvent = useCallback((id: string) => {
    const target = events.find((e) => e.id === id);
    if (!target) return;
    if (!confirm(`Delete "${target.title}"?`)) return;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEditingId(null);
    toast("Event deleted.", "success");
  }, [events]);

  /* AI */
  const runAI = useCallback(async (event: CalendarEvent, action: AIAction) => {
    setAiState({ eventId: event.id, action, loading: true, result: "", error: null });
    const dateLabel = prettyDate(event.date);
    const prompts: Record<AIAction, string> = {
      promote: `Write a compelling social media promo post for this event.
Event: ${event.title}
Date: ${dateLabel}${event.time ? ` at ${event.time}` : ""}
Location: ${event.location || "TBD"}
Type: ${event.type}

Make it energetic and shareable. Include 3 relevant hashtags. Under 120 words.`,
      plan: `Create a concise event planning checklist for this event.
Event: ${event.title}
Date: ${dateLabel}${event.time ? ` at ${event.time}` : ""}
Location: ${event.location || "TBD"}
Type: ${event.type}
Status: ${event.status}

Include: venue prep, marketing, day-of tasks, follow-up. Bullet points. Actionable only.`,
      email: `Write a professional event invitation email.
Event: ${event.title}
Date: ${dateLabel}${event.time ? ` at ${event.time}` : ""}
Location: ${event.location || "TBD"}
Type: ${event.type}

From Chris Green. Engaging, concise, one clear CTA. Include a subject line.`,
    };
    try {
      const out = await invokeLLM({ prompt: prompts[action] } as never);
      const text = typeof out === "string" ? out : String(out ?? "");
      setAiState({ eventId: event.id, action, loading: false, result: text, error: null });
    } catch (e) {
      setAiState({ eventId: event.id, action, loading: false, result: "", error: (e as Error).message });
    }
  }, []);

  const clearAI = useCallback(() => {
    setAiState({ eventId: null, action: null, loading: false, result: "", error: null });
  }, []);

  /* Export */
  const exportCsv = useCallback(() => {
    const headers = ["title", "date", "time", "location", "type", "status", "attendees", "revenue"];
    const rows = filteredEvents.map((e) => [
      e.title, e.date, e.time ?? "", e.location ?? "", e.type, e.status,
      String(e.attendees ?? ""), String(e.revenue ?? ""),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `calendar-events-${Date.now()}.csv`;
    a.click();
    toast(`Exported ${rows.length} events.`, "success");
  }, [filteredEvents]);

  /* Quick date helpers */
  const quickAdd = useCallback((offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    setAddingFor(iso(d));
    setEditingId(null);
    setSelectedDate(iso(d));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [today]);

  return (
    <PanelLayout
      title="Calendar"
      subtitle="Scheduling and events"
      icon={<CalendarDays size={18} />}
      actions={
        <div className="flex gap-1.5">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-white-60 hover:text-white-90 text-xs transition-colors"
            disabled={filteredEvents.length === 0}
          >
            <Download size={12} /> EXPORT
          </button>
          <button
            onClick={() => { setAddingFor(selectedDate ?? todayIso); setEditingId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm transition-all"
          >
            <Plus size={12} /> NEW EVENT
          </button>
        </div>
      }
    >
      <Toasts />
      <div className="h-full flex gap-4 overflow-hidden">
        {/* ══════════ CALENDAR GRID ══════════ */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Upcoming", val: stats.upcoming, color: "#4ab3f4" },
              { label: "Attendees", val: stats.attendees, color: "#ff8c42" },
              { label: "Est. Revenue", val: `$${stats.revenue.toLocaleString()}`, color: "#00c896" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl border border-white/8 p-3 text-center">
                <div className="text-xl font-extrabold" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[10px] text-[#6aaedd] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="glass rounded-xl border border-white/8 p-4 flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCur(new Date(year, month - 1, 1))}
                className="p-1 text-white-30 hover:text-white-70 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="text-center">
                <div className="text-sm text-white-60 font-display tracking-wider">
                  {MONTHS[month]} {year}
                </div>
                <button
                  onClick={() => setCur(new Date(today.getFullYear(), today.getMonth(), 1))}
                  className="text-[10px] text-[#4ab3f4] hover:text-[#4ab3f4]/80 mt-0.5"
                >
                  Today
                </button>
              </div>
              <button
                onClick={() => setCur(new Date(year, month + 1, 1))}
                className="p-1 text-white-30 hover:text-white-70 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center">
              {DAYS.map((d) => (
                <div key={d} className="text-[9px] text-white-20 font-display py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const cellIso = iso(new Date(year, month, day));
                const isToday = cellIso === todayIso;
                const isSelected = cellIso === selectedDate;
                const dayEvents = (eventsByDate.get(cellIso) ?? []).filter((e) => filter === "All" || e.type === filter);
                const hasEvents = dayEvents.length > 0;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(cellIso)}
                    onDoubleClick={() => { setAddingFor(cellIso); setEditingId(null); }}
                    className={`relative flex flex-col items-center justify-center rounded-lg text-xs transition-all aspect-square
                      hover:bg-white/5
                      ${isSelected && !isToday ? "border border-[#4ab3f4]/40 bg-[#4ab3f4]/8" : ""}
                      ${isToday ? "glass-crimson text-primary font-bold glow-crimson-sm" : "text-white-40"}`}
                  >
                    <span>{day}</span>
                    {hasEvents && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((e, j) => (
                          <span
                            key={j}
                            className="w-1 h-1 rounded-full"
                            style={{ background: STATUS_COLORS[e.status] }}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[7px] text-white-40 ml-0.5">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick schedule row — real actions */}
          <div className="glass rounded-xl border border-white/8 p-3">
            <div className="text-[9px] text-white-20 font-display tracking-widest mb-2">QUICK SCHEDULE</div>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "Today", offset: 0, icon: <Clock size={11} /> },
                { label: "Tomorrow", offset: 1, icon: <Clock size={11} /> },
                { label: "Next week", offset: 7, icon: <CalendarDays size={11} /> },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() => quickAdd(q.offset)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white-70 hover:bg-white/8 hover:text-white-95 transition-colors"
                >
                  {q.icon} {q.label}
                </button>
              ))}
              <button
                onClick={() => { setAddingFor(selectedDate ?? todayIso); setEditingId(null); }}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-crimson border border-[#ff4f5e]/40 text-[11px] text-[#ff4f5e] font-bold hover:glow-crimson-sm transition-all"
              >
                <Plus size={11} /> Custom
              </button>
            </div>
          </div>
        </div>

        {/* ══════════ RIGHT PANEL ══════════ */}
        <aside className="w-80 shrink-0 flex flex-col gap-3 min-h-0">
          {/* Add/edit form */}
          {(addingFor || editingId) && (
            <div ref={formRef} className="glass rounded-xl border border-[#4ab3f4]/25 p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs font-display tracking-wider text-[#4ab3f4]">
                  {editingId ? "EDIT EVENT" : "NEW EVENT"}
                </div>
                <button
                  onClick={() => { setAddingFor(null); setEditingId(null); }}
                  className="text-white-30 hover:text-white-70"
                >
                  <X size={14} />
                </button>
              </div>
              <EventForm
                initial={
                  editingId
                    ? events.find((e) => e.id === editingId) ?? { date: todayIso }
                    : { date: addingFor ?? todayIso }
                }
                onSave={saveEvent}
                onCancel={() => { setAddingFor(null); setEditingId(null); }}
              />
            </div>
          )}

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1">
            {(["All", ...TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t as EventType | "All")}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer border transition-colors"
                style={{
                  background: filter === t ? "rgba(74,179,244,0.15)" : "rgba(255,255,255,0.03)",
                  borderColor: filter === t ? "#4ab3f4" : "rgba(255,255,255,0.08)",
                  color: filter === t ? "#4ab3f4" : "rgba(255,255,255,0.45)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Events list — selected day or upcoming */}
          <div className="glass rounded-xl border border-white/8 p-3 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] text-white-30 font-display tracking-wider">
                {selectedDate ? `${prettyDate(selectedDate).toUpperCase()} (${selectedDayEvents.length})` : `UPCOMING (${upcoming.length})`}
              </div>
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-[9px] text-[#4ab3f4] hover:text-[#4ab3f4]/80"
                >
                  show upcoming
                </button>
              )}
            </div>

            {(selectedDate ? selectedDayEvents : upcoming).length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Ticket size={22} className="mx-auto text-white-15 mb-2" />
                  <div className="text-xs text-white-40">
                    {selectedDate ? "No events this day" : "No upcoming events"}
                  </div>
                  <div className="text-[10px] text-white-25 mt-1">
                    {selectedDate ? "Double-click the day or click New Event" : "Add events to plan your schedule"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {(selectedDate ? selectedDayEvents : upcoming).map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    onEdit={() => { setEditingId(e.id); setAddingFor(null); }}
                    onDelete={() => deleteEvent(e.id)}
                    onRunAI={(action) => runAI(e, action)}
                    aiState={aiState}
                    onClearAI={clearAI}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </PanelLayout>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ EVENT CARD ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

function EventCard({
  event, onEdit, onDelete, onRunAI, aiState, onClearAI,
}: {
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
  onRunAI: (action: AIAction) => void;
  aiState: { eventId: string | null; action: AIAction | null; loading: boolean; result: string; error: string | null };
  onClearAI: () => void;
}) {
  const isThisOne = aiState.eventId === event.id;
  return (
    <div className="glass rounded-lg border border-white/8 p-3 group">
      <div className="flex items-start gap-2.5 mb-2">
        <span className="text-xl shrink-0">{event.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-white-90 font-semibold truncate">{event.title}</span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: `${STATUS_COLORS[event.status]}22`,
                color: STATUS_COLORS[event.status],
                border: `1px solid ${STATUS_COLORS[event.status]}44`,
              }}
            >
              {event.status}
            </span>
          </div>
          <div className="text-[10px] text-white-40 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>📅 {prettyDate(event.date)}{event.time ? ` · ${event.time}` : ""}</span>
            {event.location && (
              <span className="flex items-center gap-0.5"><MapPin size={8} /> {event.location}</span>
            )}
          </div>
          <div className="flex gap-2 mt-1 text-[10px] text-white-30">
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ background: `${TYPE_COLORS[event.type]}18`, color: TYPE_COLORS[event.type] }}
            >
              {event.type}
            </span>
            {typeof event.attendees === "number" && event.attendees > 0 && (
              <span className="flex items-center gap-0.5"><Users size={8} /> {event.attendees}</span>
            )}
            {typeof event.revenue === "number" && event.revenue > 0 && (
              <span>${event.revenue.toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-0.5 text-white-30 hover:text-[#4ab3f4]" title="Edit">
            <Wand2 size={11} />
          </button>
          <button onClick={onDelete} className="p-0.5 text-white-30 hover:text-[#ff4f5e]" title="Delete">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* AI actions */}
      <div className="flex gap-1 flex-wrap">
        {([
          { key: "promote", label: "📣 Promote" },
          { key: "plan",    label: "📋 Plan" },
          { key: "email",   label: "✉️ Invite" },
        ] as { key: AIAction; label: string }[]).map((a) => (
          <button
            key={a.key}
            onClick={() => onRunAI(a.key)}
            disabled={isThisOne && aiState.loading}
            className="px-2 py-1 rounded-full bg-[#4ab3f4]/8 border border-[#4ab3f4]/25 text-[9px] text-[#4ab3f4] font-semibold hover:bg-[#4ab3f4]/15 disabled:opacity-50 transition-colors"
          >
            {isThisOne && aiState.loading && aiState.action === a.key ? (
              <Loader2 size={9} className="inline animate-spin" />
            ) : a.label}
          </button>
        ))}
      </div>

      {/* AI result */}
      {isThisOne && (aiState.result || aiState.error) && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-[#4ab3f4]/6 border border-[#4ab3f4]/20">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] font-display tracking-wider text-[#4ab3f4]">
              {aiState.action?.toUpperCase()}
            </span>
            <div className="flex gap-1">
              {aiState.result && (
                <button
                  onClick={() => { navigator.clipboard.writeText(aiState.result); toast("Copied.", "success"); }}
                  className="p-0.5 text-white-30 hover:text-white-70"
                  title="Copy"
                >
                  <Copy size={10} />
                </button>
              )}
              {aiState.action && (
                <button
                  onClick={() => onRunAI(aiState.action as AIAction)}
                  disabled={aiState.loading}
                  className="p-0.5 text-white-30 hover:text-white-70 disabled:opacity-50"
                  title="Regenerate"
                >
                  <RefreshCw size={10} />
                </button>
              )}
              <button onClick={onClearAI} className="p-0.5 text-white-30 hover:text-white-70" title="Clear">
                <X size={10} />
              </button>
            </div>
          </div>
          {aiState.error ? (
            <div className="text-[10px] text-red-400 flex items-center gap-1">
              <AlertCircle size={10} /> {aiState.error}
            </div>
          ) : (
            <pre className="text-[11px] text-white-75 whitespace-pre-wrap leading-relaxed font-sans m-0">{aiState.result}</pre>
          )}
        </div>
      )}
    </div>
  );
}