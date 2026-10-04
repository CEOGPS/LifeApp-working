import { useState } from "react";
import type { WeekEvent } from "@/lib/lifeos/board";

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

export function MonthCalendar({ events, onAdd }: { events: WeekEvent[]; onAdd: (date: string, day: number, title: string) => void }) {
  const [cursor, setCursor] = useState(() => { const date = new Date(); date.setDate(1); return date; });
  const [picked, setPicked] = useState(() => iso(new Date()));
  const [title, setTitle] = useState("");
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const today = iso(new Date());
  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  const pickedEvents = events.filter((event) => onDate(event, picked));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <button type="button" className="px-2 text-white/50" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
        <span>{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <button type="button" className="px-2 text-white/50" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-white/35">
        {HEADS.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-xs">
        {cells.map((day, index) => {
          if (!day) return <span key={`e-${index}`} />;
          const date = iso(new Date(year, month, day));
          const marked = events.some((event) => onDate(event, date));
          const on = date === picked;
          return (
            <button key={date} type="button" className={`cal-day ${on ? "is-on" : ""} ${date === today ? "is-today" : ""}`} onClick={() => setPicked(date)}>
              {day}
              {marked ? <i /> : null}
            </button>
          );
        })}
      </div>
      <ul className="mt-3">
        {pickedEvents.map((event) => <li key={event.id} className="text-sm">{event.title}</li>)}
        {pickedEvents.length === 0 ? <li className="text-sm text-white/40">Nothing on this day.</li> : null}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        const next = title.trim();
        if (!next) return;
        onAdd(picked, new Date(`${picked}T12:00:00`).getDay(), next);
        setTitle("");
      }}>
        <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" style={{ caretColor: "transparent" }} value={title} placeholder="Add to this day" onChange={(event) => setTitle(event.target.value)} />
        <button type="submit" className="bg-blue">Add</button>
      </form>
    </div>
  );
}
