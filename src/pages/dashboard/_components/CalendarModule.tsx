import { ChevronLeft, ChevronRight, Plus, CalendarClock } from "lucide-react";
import { useState } from "react";
import { usePersistentState } from "@/lib/usePersistentState.ts";
import { emitHomeActivity } from "../_lib/homeActivity";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Bright alternating appointment chip colors so labels stand out on the grid. */
const EVENT_CHIP_COLORS = [
  { bg: "rgba(239,68,68,0.92)", text: "#fff", border: "rgba(252,165,165,0.95)" },   // red
  { bg: "rgba(234,179,8,0.95)", text: "#1a1200", border: "rgba(253,224,71,0.95)" }, // yellow
  { bg: "rgba(249,115,22,0.95)", text: "#fff", border: "rgba(253,186,116,0.95)" },  // orange
  { bg: "rgba(34,197,94,0.92)", text: "#fff", border: "rgba(134,239,172,0.95)" },   // green
  { bg: "rgba(59,130,246,0.95)", text: "#fff", border: "rgba(147,197,253,0.95)" },  // blue
  { bg: "rgba(168,85,247,0.92)", text: "#fff", border: "rgba(216,180,254,0.95)" },  // purple
  { bg: "rgba(236,72,153,0.92)", text: "#fff", border: "rgba(249,168,212,0.95)" },  // pink
  { bg: "rgba(20,184,166,0.95)", text: "#fff", border: "rgba(94,234,212,0.95)" },   // teal
];

function chipColor(seed: string, idx: number) {
  let h = idx * 17;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return EVENT_CHIP_COLORS[h % EVENT_CHIP_COLORS.length];
}

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
};

function todayIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarModule() {
  const today = new Date();
  const [current, setCurrent] = useState(today);
  const [events, setEvents] = usePersistentState<CalendarEvent[]>("calendar_events", []);
  const [showAdd, setShowAdd] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState(todayIso(today));
  const [newEventTime, setNewEventTime] = useState("");
  const [newEventType, setNewEventType] = useState("home");
  const [saveError, setSaveError] = useState<string | null>(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prev = () => setCurrent(new Date(year, month - 1, 1));
  const next = () => setCurrent(new Date(year, month + 1, 1));

  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const eventsOn = (d: number) =>
    events.filter((e) => e.date === iso(year, month, d));

  const todayEvents = events.filter(
    (e) =>
      e.date === iso(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const openAdd = (prefillDate?: string) => {
    setNewEventTitle("");
    setNewEventDate(prefillDate || todayIso(today));
    setNewEventTime("");
    setNewEventType("home");
    setSaveError(null);
    setShowAdd(true);
  };

  const addEvent = () => {
    const title = newEventTitle.trim();
    if (!title) {
      setSaveError("Title is required");
      return;
    }
    const date = (newEventDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSaveError("Pick a valid date");
      return;
    }
    const ev: CalendarEvent = {
      id: `ev-${Date.now()}`,
      title,
      date,
      time: newEventTime || "All day",
      type: newEventType || "home",
      created_at: new Date().toISOString(),
    };
    setEvents([...events, ev]);
    emitHomeActivity({
      source: "calendar",
      event_type: "event.saved",
      title: `Calendar: ${ev.title}`,
      body: [ev.date, ev.time].filter(Boolean).join(" · "),
      payload: { id: ev.id, date: ev.date, time: ev.time, type: ev.type },
      id: `cal-${ev.id}`,
    });
    setNewEventTitle("");
    setNewEventTime("");
    setSaveError(null);
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="p-1.5 text-white-40 hover:text-white-80 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-display text-white-80 tracking-wider">
          {MONTHS[month]} {year}
        </span>
        <button onClick={next} className="p-1.5 text-white-40 hover:text-white-80 transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center">
        {DAYS.map((d) => (
          <div key={d} className="text-xs font-medium text-white-60 font-display py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid — click a day to schedule on that date */}
      <div className="grid grid-cols-7 gap-0.5 flex-1">
        {cells.map((day, i) => {
          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
          const dayEvents = day ? eventsOn(day) : [];
          return (
            <div
              key={i}
              role={day ? "button" : undefined}
              tabIndex={day ? 0 : undefined}
              onClick={() => day && openAdd(iso(year, month, day))}
              onKeyDown={(e) => {
                if (day && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  openAdd(iso(year, month, day));
                }
              }}
              className={`relative aspect-square flex flex-col items-center justify-start rounded cursor-pointer transition-colors
                ${day ? "hover:bg-white/5 text-white-70" : ""}
                ${isToday ? "glass-crimson text-primary font-bold glow-crimson-sm" : ""}`}
            >
              {day && <span className="z-10 mt-1 text-white-90 font-medium text-sm">{day}</span>}
<div className="absolute inset-x-0.5 bottom-0.5 flex flex-col gap-0.5 pointer-events-none">
                {dayEvents.slice(0, 2).map((e, idx) => {
                  const c = chipColor(e.id || e.title, idx);
                  return (
                    <div
                      key={e.id || idx}
                      className="text-[9px] font-semibold truncate px-1 rounded leading-tight shadow-sm"
                      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, textShadow: "0 1px 1px rgba(0,0,0,0.25)" }}
                      title={`${e.time || ""} ${e.title}`.trim()}
                    >
                      {e.time && e.time !== "All day" ? `${e.time} ` : ""}{e.title}
                    </div>
                  );
                })}
              </div>
              {dayEvents.length > 2 && (
                <div className="text-[8px] text-center font-bold text-amber-200 drop-shadow">
                  +{dayEvents.length - 2}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Schedule Event button */}
      <button
        onClick={() => openAdd()}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg glass-crimson text-primary text-sm font-display font-medium hover:glow-crimson-sm transition-all"
      >
        <Plus size={13} /> SCHEDULE EVENT
      </button>

      {/* Today's events highlight box */}
      <div className="glass rounded-xl border border-primary/20 p-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <CalendarClock size={12} className="text-primary/80" />
            <span className="text-xs font-display tracking-widest text-primary/90">
              TODAY
            </span>
          </div>
          <button
            onClick={() => openAdd()}
            className="text-xs text-primary/70 hover:text-primary transition-colors"
          >
            add event
          </button>
        </div>
        {todayEvents.length === 0 ? (
          <div className="text-xs text-white-40 text-center py-1.5">
            No events today
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {todayEvents.map((e, idx) => {
              const c = chipColor(e.id || e.title, idx);
              return (
              <div
                key={e.id}
                className="flex items-center gap-2 text-sm text-white-90"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.bg, boxShadow: `0 0 6px ${c.bg}` }} />
                <span className="truncate font-medium">{e.title}</span>
                {e.time && (
                  <span className="ml-auto text-xs shrink-0 px-1.5 py-0.5 rounded" style={{ background: c.bg, color: c.text }}>
                    {e.time}
                  </span>
                )}
              </div>
              );
            })}
          </div>
        )}

        {/* Add event form — date + time */}
        {showAdd && (
          <div className="space-y-2 border-t border-white/5 pt-2 mt-2">
            <input
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEvent()}
              placeholder="Event title..."
              autoFocus
              className="w-full h-8 px-3 text-sm bg-white/4 border border-white/6 rounded text-white-90 placeholder:text-white-30 focus:outline-none focus:border-primary/40"
            />
            <div className="flex gap-2">
              <input
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                type="date"
                aria-label="Event date"
                className="flex-1 h-8 px-2 text-sm bg-white/4 border border-white/6 rounded text-white-90 focus:outline-none focus:border-primary/40"
              />
              <input
                value={newEventTime}
                onChange={(e) => setNewEventTime(e.target.value)}
                placeholder="Time"
                type="time"
                aria-label="Event time"
                className="flex-1 h-8 px-2 text-sm bg-white/4 border border-white/6 rounded text-white-90 placeholder:text-white-30 focus:outline-none focus:border-primary/40"
              />
            </div>
            <select
              value={newEventType}
              onChange={(e) => setNewEventType(e.target.value)}
              className="w-full h-8 px-2 text-sm bg-white/4 border border-white/6 rounded text-white-70 focus:outline-none focus:border-primary/40 appearance-none"
            >
              <option value="home">Home</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
            </select>
            {saveError && (
              <div className="text-[11px] text-red-400" role="alert">{saveError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={addEvent}
                className="flex-1 h-8 text-sm rounded glass-crimson text-primary font-display font-medium tracking-wider"
              >
                ADD
              </button>
              <button
                onClick={() => { setShowAdd(false); setSaveError(null); }}
                className="flex-1 h-8 text-sm rounded bg-white/5 text-white-50 font-display font-medium"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
