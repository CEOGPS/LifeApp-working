import { useState } from "react";
import { newId, type Memory } from "./memory";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Status = "To do" | "Doing" | "Done";
type Task = { id: string; title: string; done: boolean };
type Project = { status: Status; notes: string; due: string; tasks: Task[] };

const STATUSES: Status[] = ["To do", "Doing", "Done"];

function read(body: string): Project {
  if (body === "To do" || body === "Doing" || body === "Done") return { status: body, notes: "", due: "", tasks: [] };
  try {
    const raw = JSON.parse(body) as Partial<Project>;
    const status = STATUSES.includes(raw.status as Status) ? raw.status as Status : "To do";
    const tasks = Array.isArray(raw.tasks) ? raw.tasks.filter((row) => row && row.title).map((row) => ({ id: String(row.id || newId()), title: String(row.title), done: Boolean(row.done) })) : [];
    return { status, notes: String(raw.notes || ""), due: String(raw.due || ""), tasks };
  } catch {
    return { status: "To do", notes: body, due: "", tasks: [] };
  }
}

export function ProjectsDesk({ data, update }: { data: Memory; update: Update }) {
  const [name, setName] = useState("");
  const [filter, setFilter] = useState<Status | "All">("All");
  const [openId, setOpenId] = useState<string | null>(data.projects[0]?.id || null);
  const [task, setTask] = useState("");
  const open = data.projects.find((row) => row.id === openId) || null;
  const detail = open ? read(open.body) : null;
  const shown = data.projects.filter((row) => filter === "All" || read(row.body).status === filter);

  function write(id: string, next: Partial<Project> & { title?: string }) {
    update((prev) => ({
      ...prev,
      projects: prev.projects.map((row) => {
        if (row.id !== id) return row;
        const current = read(row.body);
        return { ...row, title: next.title ?? row.title, body: JSON.stringify({ ...current, ...next, title: undefined }) };
      }),
    }));
  }

  return (
    <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[16rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">Projects</p>
        <form className="mt-3 flex gap-2" onSubmit={(event) => {
          event.preventDefault();
          const title = name.trim();
          if (!title) return;
          const id = newId();
          update((prev) => ({ ...prev, projects: [{ id, title, body: JSON.stringify({ status: "To do", notes: "", due: "", tasks: [] }), at: new Date().toISOString() }, ...prev.projects] }));
          setOpenId(id);
          setName("");
        }}>
          <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={name} placeholder="Project name" onChange={(event) => setName(event.target.value)} />
          <button type="submit" className="bg-blue">Add</button>
        </form>
        <div className="mt-3 flex gap-3">
          {(["All", ...STATUSES] as const).map((item) => <button key={item} type="button" className={`quiet ${filter === item ? "is-on" : ""}`} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <div className="mt-3">
          {shown.map((row) => (
            <button key={row.id} type="button" className={`menu ${openId === row.id ? "is-on" : ""}`} onClick={() => setOpenId(row.id)}>
              {row.title}<span className="ml-2 text-[11px] text-white/35">{read(row.body).status}</span>
            </button>
          ))}
          {!shown.length ? <p className="text-[11px] text-white/35">No projects in this list.</p> : null}
        </div>
        <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">BOARD TASKS</p>
        {data.tasks.map((row) => (
          <button key={row.id} type="button" className={`menu ${row.done ? "text-white/35" : ""}`} onClick={() => update((prev) => ({ ...prev, tasks: prev.tasks.map((item) => item.id === row.id ? { ...item, done: !item.done } : item) }))}>{row.done ? "Done" : "Open"} · {row.title}</button>
        ))}
        {!data.tasks.length ? <p className="text-[11px] text-white/35">Tasks you add on the dashboard show up here.</p> : null}
      </aside>
      <section className="module-card p-4">
        {!open || !detail ? <p className="text-sm text-white/40">Add a project. It stays in the list and opens here.</p> : (
          <div>
            <input className="h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={open.title} onChange={(event) => write(open.id, { title: event.target.value })} />
            <div className="mt-3 flex flex-wrap gap-3">
              {STATUSES.map((status) => <button key={status} type="button" className={`quiet ${detail.status === status ? "is-on" : ""}`} onClick={() => write(open.id, { status })}>{status}</button>)}
            </div>
            <label className="mt-3 block text-[11px] uppercase tracking-wider text-white/40">Due
              <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm normal-case" placeholder="MM/DD/YYYY" value={detail.due} onChange={(event) => write(open.id, { due: event.target.value })} />
            </label>
            <label className="mt-3 block text-[11px] uppercase tracking-wider text-white/40">Notes
              <textarea className="mt-1 min-h-24 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm normal-case" value={detail.notes} onChange={(event) => write(open.id, { notes: event.target.value })} />
            </label>
            <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">TASKS</p>
            {detail.tasks.map((row) => (
              <div key={row.id} className="flex items-center gap-3 border-b border-white/10 py-2 text-sm">
                <button type="button" className={`quiet ${row.done ? "is-on" : ""}`} onClick={() => write(open.id, { tasks: detail.tasks.map((item) => item.id === row.id ? { ...item, done: !item.done } : item) })}>{row.done ? "Done" : "Open"}</button>
                <span className={row.done ? "text-white/35 line-through" : ""}>{row.title}</span>
                <button type="button" className="link-remove ml-auto" onClick={() => write(open.id, { tasks: detail.tasks.filter((item) => item.id !== row.id) })}>Remove</button>
              </div>
            ))}
            <form className="mt-3 flex gap-2" onSubmit={(event) => {
              event.preventDefault();
              if (!task.trim()) return;
              write(open.id, { tasks: [...detail.tasks, { id: newId(), title: task.trim(), done: false }] });
              setTask("");
            }}>
              <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={task} placeholder="Add a task" onChange={(event) => setTask(event.target.value)} />
              <button type="submit" className="quiet is-on">Add task</button>
            </form>
            <button type="button" className="link-remove mt-4" onClick={() => { update((prev) => ({ ...prev, projects: prev.projects.filter((row) => row.id !== open.id) })); setOpenId(null); }}>Remove project</button>
          </div>
        )}
      </section>
    </div>
  );
}
