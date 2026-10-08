import { useEffect, useRef, useState } from "react";
import type { WeekEvent } from "@/lib/lifeos/board";
import { newId, type Memory } from "./memory";
import { fmtDate } from "./format";
import { pushNotice } from "./app-settings";

const HEADS = ["S", "M", "T", "W", "T", "F", "S"];

function iso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function onDate(event: WeekEvent, date: string) {
  if (event.date) return event.date === date;
  const day = new Date(`${date}T12:00:00`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return day >= start && day <= end && day.getDay() === event.day;
}

export function MonthCalendar({ events, onAdd, onRemove, onPick, page = false, plain = false }: { events: WeekEvent[]; onAdd: (date: string, day: number, title: string, start?: string) => void; onRemove?: (id: string) => void; onPick?: (date: string) => void; page?: boolean; plain?: boolean }) {
  const [cursor, setCursor] = useState(() => { const date = new Date(); date.setDate(1); return date; });
  const [picked, setPicked] = useState(() => iso(new Date()));
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("09:00");
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const today = iso(new Date());
  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  const pickedEvents = events.filter((event) => onDate(event, picked));
  function choose(date: string) {
    setPicked(date);
    onPick?.(date);
  }
  function add() {
    const next = title.trim();
    if (!next) return;
    onAdd(picked, new Date(`${picked}T12:00:00`).getDay(), next, when);
    setTitle("");
  }

  if (!page) return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <button type="button" className="quiet" onClick={() => setCursor(new Date(year, month - 1, 1))}>Prev</button>
        <span>{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <button type="button" className="quiet" onClick={() => setCursor(new Date(year, month + 1, 1))}>Next</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-white/35">
        {HEADS.map((label, index) => <span key={`${label}-${index}`} className="accent-purple">{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-xs">
        {cells.map((day, index) => {
          if (!day) return <span key={`e-${index}`} />;
          const date = iso(new Date(year, month, day));
          const marked = events.some((event) => onDate(event, date));
          const on = date === picked;
          return (
            <button key={date} type="button" className={`cal-day ${on ? "is-on" : ""} ${date === today ? "is-today" : ""}`} onClick={() => choose(date)}>
              {day}
              {marked ? <i /> : null}
            </button>
          );
        })}
      </div>
      <ul className="mt-3">
        {pickedEvents.map((event) => <li key={event.id} className="text-sm">{event.start ? `${clock(event.start)} ` : ""}{event.title}</li>)}
        {pickedEvents.length === 0 ? <li className="text-sm text-white/40">Nothing on this day.</li> : null}
      </ul>
      <form className="mt-2 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); add(); }}>
        <input className="h-8 w-24 rounded-full border border-line bg-black/40 px-3 text-sm" type="time" value={when} aria-label="Time" onChange={(event) => setWhen(event.target.value)} />
        <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={title} placeholder="Add to this day" onChange={(event) => setTitle(event.target.value)} />
        <button type="submit" className="quiet is-on">Add</button>
      </form>
    </div>
  );

  const weeks = Math.ceil(cells.length / 7);
  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button type="button" className="quiet" onClick={() => setCursor(new Date(year, month - 1, 1))}>Prev</button>
        <span className="text-lg">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <button type="button" className="quiet" onClick={() => setCursor(new Date(year, month + 1, 1))}>Next</button>
        <form className={`ml-auto flex min-w-64 flex-1 items-center gap-2 ${plain ? "hidden" : ""}`} onSubmit={(event) => { event.preventDefault(); add(); }}>
          <input className="h-8 w-28 rounded-full border border-line bg-black/40 px-3 text-sm" type="time" value={when} aria-label="Time" onChange={(event) => setWhen(event.target.value)} />
          <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={title} placeholder={`Add on ${picked}`} onChange={(event) => setTitle(event.target.value)} />
          <button type="submit" className="quiet is-on">Add</button>
        </form>
      </div>
      <div className="grid grid-cols-7 text-[10px] tracking-widest text-white/35">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <span key={label} className="px-2 pb-1"><span className="accent-purple">{label[0]}</span><span className="text-white/35">{label.slice(1)}</span></span>)}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-1" style={{ gridTemplateRows: `repeat(${weeks}, minmax(7.5rem, 1fr))` }}>
        {cells.map((day, index) => {
          if (!day) return <div key={`e-${index}`} className="rounded-lg border border-white/5" />;
          const date = iso(new Date(year, month, day));
          const rows = events.filter((event) => onDate(event, date));
          return (
            <button key={date} type="button" className={`cal-cell ${date === picked ? "is-on" : ""} ${date === today ? "is-today" : ""}`} onClick={() => choose(date)}>
              <span className="text-[11px] text-white/70">{day}</span>
              <span className="mt-1 grid gap-1">
                {rows.slice(0, 4).map((event) => (
                  <span key={event.id} className="flex items-start gap-1 truncate rounded bg-white/5 px-1 py-0.5 text-left text-[11px] text-white/80">
                    <span className="min-w-0 flex-1 truncate">{event.start ? `${clock(event.start)} ` : ""}{event.title}</span>
                    {onRemove ? <span className="text-white/35" onClick={(click) => { click.stopPropagation(); onRemove(event.id); }}>×</span> : null}
                  </span>
                ))}
                {rows.length > 4 ? <span className="text-[10px] text-white/40">+{rows.length - 4} more</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function clock(value: string) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return value;
  return `${String((hour % 12) || 12).padStart(2, "0")}:${minute || "00"} ${hour >= 12 ? "PM" : "AM"}`;
}

type Update = (recipe: (prev: Memory) => Memory) => void;

export async function syncGoogleEvent(action: "list" | "create" | "update" | "delete", row: Partial<WeekEvent> = {}) {
  const { readOauth } = await import("@/lib/lifeos/oauth");
  const { googleCalendar } = await import("@/lib/lifeos/sync");
  const token = readOauth().find((item) => item.provider === "google")?.token || "";
  return googleCalendar({
    data: {
      token,
      action,
      id: row.id,
      title: row.title,
      date: row.date,
      start: row.start,
      end: row.end,
      where: row.where,
      who: row.who,
      remind: row.remind,
    },
  });
}

export function CalendarDesk({ data, update }: { data: Memory; update: Update }) {
  const [date, setDate] = useState(() => iso(new Date()));
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [where, setWhere] = useState("");
  const [who, setWho] = useState("");
  const [remind, setRemind] = useState(true);
  const [editId, setEditId] = useState("");
  const [note, setNote] = useState("");
  const once = useRef(false);
  const upcoming = [...data.events].filter((row) => row.date).sort((a, b) => `${a.date} ${a.start || ""}`.localeCompare(`${b.date} ${b.start || ""}`));

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    void syncGoogleEvent("list").then((result) => {
      if (!result.ok) { setNote(result.error); return; }
      update((prev) => {
        const have = new Set(prev.events.map((row) => row.id));
        const fresh = result.events.filter((row) => !have.has(row.id)).map((row) => ({
          id: row.id,
          day: new Date(`${row.date}T12:00:00`).getDay(),
          date: row.date,
          title: row.title,
          start: row.start,
          end: row.end,
          where: row.where,
          who: row.who,
          remind: false,
        }));
        return fresh.length ? { ...prev, events: [...prev.events, ...fresh] } : prev;
      });
      setNote(result.events.length ? "Google Calendar" : "No Google events in this range.");
    }).catch(() => setNote("Google Calendar did not answer."));
  }, [update]);

  function clear() {
    setTitle("");
    setStart("09:00");
    setEnd("10:00");
    setWhere("");
    setWho("");
    setRemind(true);
    setEditId("");
  }

  function load(row: WeekEvent) {
    setEditId(row.id);
    setDate(row.date || date);
    setTitle(row.title);
    setStart(row.start || "09:00");
    setEnd(row.end || "10:00");
    setWhere(row.where || "");
    setWho(row.who || "");
    setRemind(Boolean(row.remind));
  }

  function save(event: { preventDefault: () => void }) {
    event.preventDefault();
    const name = title.trim();
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const localId = editId || newId();
    const row: WeekEvent = {
      id: localId,
      day: new Date(`${date}T12:00:00`).getDay(),
      date,
      title: name,
      start,
      end,
      where: where.trim(),
      who: who.trim(),
      remind,
    };
    update((prev) => ({
      ...prev,
      events: editId ? prev.events.map((item) => item.id === editId ? row : item) : [...prev.events, row],
      notifs: remind ? [{ id: newId(), text: `${name} on ${fmtDate(date)} at ${clock(start)}`, source: "Calendar", seen: false }, ...prev.notifs] : prev.notifs,
    }));
    if (remind) pushNotice("calendar", name, `${fmtDate(date)} ${clock(start)}`);
    void syncGoogleEvent(localId.startsWith("gcal:") ? "update" : "create", row).then((result) => {
      if (!result.ok) { setNote(result.error); return; }
      if (result.id && result.id !== localId) update((prev) => ({ ...prev, events: prev.events.map((item) => item.id === localId ? { ...item, id: result.id } : item) }));
      setNote(localId.startsWith("gcal:") ? "Updated on Google Calendar." : "Saved on Google Calendar.");
    });
    clear();
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <MonthCalendar
        page
        plain
        events={data.events}
        onPick={setDate}
        onRemove={(id) => {
          update((prev) => ({ ...prev, events: prev.events.filter((row) => row.id !== id) }));
          if (id.startsWith("gcal:")) void syncGoogleEvent("delete", { id }).then((result) => { if (!result.ok) setNote(result.error); });
        }}
        onAdd={() => undefined}
      />
      <section className="module-card p-4">
        <h2 className="text-lg">Schedule</h2>
        <p className="mt-1 text-sm text-white/50">Pick a day on the grid, then set the time. Saves on chrisgr33ninc@gmail.com.{note ? ` ${note}` : ""}</p>
        <form className="mt-3 grid gap-2" onSubmit={save}>
          <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" value={title} placeholder="Event" onChange={(event) => setTitle(event.target.value)} />
          <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" type="date" value={date} aria-label="Date" onChange={(event) => setDate(event.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" type="time" value={start} aria-label="Start" onChange={(event) => setStart(event.target.value)} />
            <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" type="time" value={end} aria-label="End" onChange={(event) => setEnd(event.target.value)} />
          </div>
          <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" value={where} placeholder="Where" onChange={(event) => setWhere(event.target.value)} />
          <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" list="calendar-people" value={who} placeholder="Who" onChange={(event) => setWho(event.target.value)} />
          <datalist id="calendar-people">{data.contacts.slice(0, 40).map((row) => <option key={row.id} value={row.name} />)}</datalist>
          <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={remind} onChange={(event) => setRemind(event.target.checked)} /> Remind me</label>
          <div className="flex gap-4">
            <button type="submit" className="quiet is-on">{editId ? "Update" : "Save event"}</button>
            {editId ? <button type="button" className="quiet" onClick={clear}>Cancel</button> : null}
          </div>
        </form>
        <div className="mt-4 grid gap-2">
          {upcoming.map((row) => (
            <button key={row.id} type="button" className="menu" onClick={() => load(row)}>
              <span className="block">{row.title}</span>
              <span className="block text-white/45">{fmtDate(row.date || "")} · {row.start ? clock(row.start) : "No time"}{row.end ? `–${clock(row.end)}` : ""}{row.where ? ` · ${row.where}` : ""}{row.who ? ` · ${row.who}` : ""}</span>
            </button>
          ))}
          {!upcoming.length ? <p className="text-sm text-white/40">No dated events yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
