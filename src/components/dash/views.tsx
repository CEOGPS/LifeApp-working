import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis } from "recharts";
import { band, insights, LIFE_HACKS, lifeHacks, moneyTips } from "@/lib/lifeos/board";
import { newId, useMemory, type Memory } from "./memory";
import { WiredPanel } from "./panels";
import { WeatherClock } from "./weather";
import { ErebusDock } from "./dock";
import { MonthCalendar, syncGoogleEvent } from "./calendar";
import { fmtMoney, fmtTime } from "./format";
import { YoutubeBox } from "./media-desk";
import { playCut, stopCut, togglePause, usePlayer } from "./player";
import { NAV } from "./shell";

function PageHead({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <h1 className="accent-purple brand-script text-xl">{title}</h1>
      <div className="ml-auto flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green" />
        <span className="accent-orange font-display text-[10px] tracking-widest">LIFEOS ONLINE</span>
      </div>
    </div>
  );
}

function Card({ title, to, children }: { title: string; to?: string; children: ReactNode }) {
  return (
    <section className="module-card flex flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <h2 className="module-title">{title}</h2>
        {to ? <Link to="/panel/$slug" params={{ slug: to }} className="accent-orange ml-auto text-sm">Open</Link> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  area,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  area?: boolean;
}) {
  const className = "mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-fg outline-none";
  const style = { caretColor: "transparent" } as const;
  return (
    <label className="block text-sm text-muted">
      {label}
      {area ? (
        <textarea className={`${className} min-h-24`} style={style} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} style={style} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function QuickLinks({
  links,
  onAdd,
  onRemove,
}: {
  links: { id: string; label: string; href: string }[];
  onAdd: (label: string, href: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  return (
    <>
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const label = name.trim();
          let href = url.trim();
          if (!label || !href) return;
          if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
          onAdd(label.slice(0, 60), href);
          setName("");
          setUrl("");
        }}
      >
        <input className="min-h-11 rounded-lg border border-line bg-ink px-3 text-sm" style={{ caretColor: "transparent" }} placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="min-h-11 rounded-lg border border-line bg-ink px-3 text-sm" style={{ caretColor: "transparent" }} placeholder="URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <button type="submit" className="min-h-11 bg-blue text-sm">Save</button>
      </form>
      {links.map((row) => (
        <div key={row.id} className="mt-2 flex items-center gap-2">
          <a className="min-h-11 flex-1 truncate text-sm text-blue-2" href={row.href} target="_blank" rel="noreferrer">{row.label}</a>
          <button type="button" className="link-remove" onClick={() => onRemove(row.id)}>Remove</button>
        </div>
      ))}
    </>
  );
}

function Add({ label, onAdd }: { label: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        if (!next) return;
        onAdd(next);
        setValue("");
      }}
    >
      <input
        className="min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm text-fg outline-none"
        style={{ caretColor: "transparent" }}
        value={value}
        placeholder={label}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className="min-h-11 rounded-lg bg-blue px-3 text-sm text-ink">
        Save
      </button>
    </form>
  );
}

function clock() {
  return `${fmtTime()} · ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`;
}

function answer(text: string, data: Memory) {
  const q = text.toLowerCase();
  const openTasks = data.tasks.filter((row) => !row.done);
  const net = data.accounts.reduce((sum, row) => sum + row.balance, 0);
  if (q.includes("task")) return openTasks.length ? openTasks.map((row) => row.title).join(". ") : "No open tasks on the board.";
  if (q.includes("lead") || q.includes("contact")) {
    const names = [...data.leads.map((row) => row.name), ...data.contacts.map((row) => row.name)].filter(Boolean);
    return names.length ? names.join(", ") : "No leads or contacts saved.";
  }
  if (q.includes("money") || q.includes("balance") || q.includes("pay")) {
    const unpaid = data.expenses.filter((row) => !row.paid).map((row) => row.name);
    return `Net on the board is $${net.toLocaleString()}.${unpaid.length ? ` Unpaid: ${unpaid.join(", ")}.` : ""}`;
  }
  if (q.includes("note")) return data.notes[0]?.body || data.notes[0]?.title || "No notes saved.";
  return "I only use saved notes, tasks, leads, contacts, and balances. Ask about one of those.";
}


function listen(onText: (value: string) => void) {
  const host = window as unknown as { webkitSpeechRecognition?: new () => { start: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null } };
  const Rec = host.webkitSpeechRecognition;
  if (!Rec) return;
  const rec = new Rec();
  rec.onresult = (event) => onText(event.results[0][0].transcript);
  rec.start();
}

const GLOW = ["rgba(176, 107, 255, 0.45)", "rgba(45, 212, 191, 0.42)", "rgba(52, 211, 153, 0.4)", "rgba(176, 107, 255, 0.28)"];

function GlowBars({ rows }: { rows: { name: string; value: number }[] }) {
  return (
    <div className="chart-glow h-32 min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fill: "#9aa0a6", fontSize: 11 }} interval={0} />
          <Bar dataKey="value" radius={4}>
            {rows.map((row, index) => <Cell key={row.name} fill={GLOW[index % GLOW.length]} />)}
            <LabelList dataKey="value" position="top" fill="#f7f7f7" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GlowArea({ rows, color, purple = false }: { rows: { name: string; value: number }[]; color: string; purple?: boolean }) {
  return (
    <div className={`chart-glow h-28 min-w-0 overflow-hidden ${purple ? "chart-purple" : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.16} strokeOpacity={0.7}>
            <LabelList dataKey="value" position="top" fill="#f7f7f7" fontSize={11} />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Dashboard() {
  const { data, update } = useMemory();
  const playing = usePlayer();
  const [now, setNow] = useState("Atlanta");
  const [weather, setWeather] = useState("Atlanta");
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState("Calendar uses the Google connection when this app is opened from Grok.");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [billName, setBillName] = useState("");
  const [bill, setBill] = useState("");
  const [spotLists, setSpotLists] = useState<{ id: string; name: string; url: string }[]>([]);
  const playlists = [...new Set(data.tracks.map((row) => row.playlist || "Library"))];
  const money = data.accounts.map((row) => ({ name: row.name, value: row.balance }));
  const budget = data.expenses.map((row) => ({ name: row.name, value: row.paid ? row.amount : -row.amount }));

  useEffect(() => {
    const timer = setInterval(() => setNow(clock()), 30_000);
    setNow(clock());
    fetch("https://api.open-meteo.com/v1/forecast?latitude=33.75&longitude=-84.39&current=temperature_2m,weather_code")
      .then((response) => response.json())
      .then((payload) => {
        const temp = payload?.current?.temperature_2m;
        if (typeof temp === "number") setWeather(`${Math.round(temp)}° Atlanta`);
      })
      .catch(() => setWeather("Atlanta"));
    void import("@/lib/lifeos/sync").then(({ pullCalendar }) => pullCalendar()).then((day) => {
      if (day.events.length) {
        update((prev) => ({
          ...prev,
          events: day.events.map((event, index) => ({ id: `cal-${index}`, day: new Date().getDay(), title: `${event.when.slice(11, 16) || "Today"} ${event.title}` })),
        }));
      }
      setLive(day.note);
    }).catch(() => setLive("Calendar is not connected."));
    return () => clearInterval(timer);
  }, [update]);

  useEffect(() => {
    void import("@/lib/lifeos/oauth").then(({ readOauth }) => {
      const token = readOauth().find((row) => row.provider === "spotify")?.token || "";
      return import("@/lib/lifeos/env-keys").then(({ spotifyHub }) => spotifyHub({ data: { token, action: "home", query: "" } }));
    }).then((result) => setSpotLists(result.playlists || [])).catch(() => setSpotLists([]));
  }, []);

  function facts() {
    const net = data.accounts.reduce((sum, row) => sum + row.balance, 0);
    return [
      `Time ${now}. Weather ${weather}.`,
      `Open tasks: ${data.tasks.filter((row) => !row.done).map((row) => row.title).join(", ") || "none"}.`,
      `Leads: ${data.leads.map((row) => `${row.name} (${row.status})`).join(", ") || "none"}.`,
      `Net balance ${net}. Unpaid: ${data.expenses.filter((row) => !row.paid).map((row) => row.name).join(", ") || "none"}.`,
      `Notes: ${data.notes.map((row) => row.title).join(", ") || "none"}.`,
    ].join("\n");
  }

  return (
    <div className="grid gap-4">
      <PageHead title="Cagednreality" />
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem_minmax(0,1.15fr)]">
      <div className="order-2 flex flex-col gap-4 xl:order-1">
        <Card title="Time & Weather">
          <WeatherClock />
        </Card>
        <Card title="Quick Links">
          <QuickLinks
            links={data.links.filter((row) => !/^(Listing|Spotify|Image) ·/.test(row.label))}
            onAdd={(label, href) => update((prev) => ({ ...prev, links: [{ id: newId(), label, href }, ...prev.links] }))}
            onRemove={(id) => update((prev) => ({ ...prev, links: prev.links.filter((row) => row.id !== id) }))}
          />
        </Card>
        <Card title="Notes" to="office">
          <div className="mb-2 flex flex-col gap-1">
            {data.notes.map((row) => (
              <button key={row.id} type="button" className="min-h-11 truncate text-left text-sm text-blue-2" onClick={() => { setNoteTitle(row.title); setNoteBody(row.body); }}>{row.title || "Untitled"}</button>
            ))}
          </div>
          <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); update((prev) => ({ ...prev, notes: [{ id: newId(), title: noteTitle, body: noteBody }, ...prev.notes.filter((row) => row.title !== noteTitle)] })); setNoteTitle(""); setNoteBody(""); }}>
            <Field label="Title" value={noteTitle} onChange={setNoteTitle} />
            <Field label="Note" value={noteBody} onChange={setNoteBody} area />
            <button type="submit" className="min-h-11 bg-blue text-sm">Save note</button>
          </form>
        </Card>
        <Card title="Tasks" to="projects">
          <Add label="New task" onAdd={(title) => update((prev) => ({ ...prev, tasks: [{ id: newId(), title, done: false }, ...prev.tasks] }))} />
          <ul className="mt-2">{data.tasks.map((row) => (
            <li key={row.id}><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={row.done} onChange={() => update((prev) => ({ ...prev, tasks: prev.tasks.map((item) => item.id === row.id ? { ...item, done: !item.done } : item) }))} /><span className={row.done ? "text-muted line-through" : ""}>{row.title}</span></label></li>
          ))}</ul>
        </Card>
        <Card title="Calendar" to="calendar">
          <p className="mb-2 text-xs text-muted">{live}</p>
          <MonthCalendar events={data.events} onAdd={(date, day, title, start) => {
            const id = newId();
            update((prev) => ({ ...prev, events: [...prev.events, { id, day, date, title, start }] }));
            void syncGoogleEvent("create", { date, title, start, end: "10:00" }).then((result) => {
              if (result.ok && result.id) update((prev) => ({ ...prev, events: prev.events.map((item) => item.id === id ? { ...item, id: result.id } : item) }));
            });
          }} />
        </Card>
        <Card title="Budget & Expenses" to="finance">
          <div className="chart-purple"><GlowArea rows={budget.map((row) => ({ name: row.name, value: Math.abs(row.value) }))} color="rgba(192, 132, 252, 0.9)" purple /></div>
          {data.expenses.map((row) => (
            <button key={row.id} type="button" className="flex w-full items-center justify-between gap-2 text-sm" onClick={() => update((prev) => ({ ...prev, expenses: prev.expenses.map((item) => item.id === row.id ? { ...item, paid: !item.paid } : item) }))}>
              <span>{row.name}</span>
              <span className="accent-purple text-xs">{fmtMoney(row.amount)}</span>
              <input className="w-20 rounded-full border border-line bg-ink px-2 py-1 text-right text-sm" style={{ caretColor: "transparent" }} value={row.amount} onClick={(event) => event.stopPropagation()} onChange={(event) => {
                const amount = Number(event.target.value);
                if (!Number.isFinite(amount)) return;
                update((prev) => ({ ...prev, expenses: prev.expenses.map((item) => item.id === row.id ? { ...item, amount } : item) }));
              }} />
              <span className={row.paid ? "text-green" : "accent-orange"}>{row.paid ? "Paid" : "Due"}</span>
            </button>
          ))}
          <form className="mt-3 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); const amount = Number(bill); if (!billName.trim() || !Number.isFinite(amount)) return; update((prev) => ({ ...prev, expenses: [{ id: newId(), name: billName.trim(), amount, paid: false, fixed: true }, ...prev.expenses] })); setBillName(""); setBill(""); }}>
            <input className="min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm" style={{ caretColor: "transparent" }} placeholder="Bill" value={billName} onChange={(event) => setBillName(event.target.value)} />
            <input className="min-h-11 w-24 rounded-lg border border-line bg-ink px-3 text-sm" style={{ caretColor: "transparent" }} placeholder="Amount" value={bill} onChange={(event) => setBill(event.target.value)} />
            <button type="submit" className="min-h-11 bg-blue px-3 text-sm">Add</button>
          </form>
        </Card>
        <Card title="AI Money Tips" to="finance">{moneyTips(data).map((tip) => <p key={tip} className="text-sm">{tip}</p>)}</Card>
        <Card title="Life Hacks">{[...lifeHacks(data), ...LIFE_HACKS.map((row) => `${row.title}. ${row.body}`)].map((tip) => <p key={tip} className="text-sm">{tip}</p>)}</Card>
        <Card title="Leads" to="leads">
          {data.leads.map((row) => <p key={row.id} className="min-h-11 text-sm">{row.name} <span className="text-ember">{row.status}</span></p>)}
        </Card>
        <Card title="Social Analytics" to="social">
          {(data.socialAccounts.length ? data.socialAccounts : []).map((row) => (
            <p key={row.id} className="min-h-11 text-sm">{row.name} <span className="accent-purple">{row.followers.toLocaleString()}</span> <span className="text-muted">followers{row.views ? ` · ` : ""}</span>{row.views ? <span className="accent-purple">{row.views.toLocaleString()}</span> : null}{row.views ? <span className="text-muted"> views</span> : null}</p>
          ))}
          {data.socialPosts[0] ? <p className="text-sm text-muted">{data.socialPosts[0].sent ? `Sent · ${data.socialPosts[0].sent}` : "Draft"} · {data.socialPosts[0].text.slice(0, 80)}</p> : null}
          {!data.socialAccounts.length ? data.social.map((row) => <p key={row.id} className="min-h-11 text-sm">{row.label} <span className="accent-purple">{row.points.at(-1)}</span></p>) : null}
        </Card>
      </div>

      <div className="order-1 xl:sticky xl:top-2 xl:order-2 xl:self-start">
        <ErebusDock data={data} update={update} agent="Kranos" />
      </div>

      <div className="order-3 flex min-w-0 flex-col gap-4">
        <Card title="Notifications">
          {data.notifs.map((row) => (
            <button key={row.id} type="button" className="flex min-h-11 w-full items-start gap-2 py-1 text-left text-sm" onClick={() => update((prev) => ({ ...prev, notifs: prev.notifs.map((item) => item.id === row.id ? { ...item, seen: true } : item) }))}>
              <span className={row.seen ? "mt-1 h-2 w-2 rounded-full bg-muted" : "blink light-amber mt-1 h-2 w-2 rounded-full"} />
              <span>{row.text}<span className="accent-purple block">{row.source}</span></span>
            </button>
          ))}
        </Card>
        <Card title="YouTube Player">
          <YoutubeBox apiKey={data.keys.find((row) => row.name === "YouTube")?.value || ""} />
        </Card>
        <Card title="AI Insights" to="finance">{insights(data).map((tip) => <p key={tip} className="text-sm">{tip}</p>)}</Card>
        <Card title="Music Player" to="music">
          <p className="truncate text-sm">{playing.track?.title || data.tracks[0]?.title || "Nothing playing"}</p>
          <p className="truncate text-[11px] text-white/40">{playing.track?.artist || data.tracks[0]?.artist || "Music keeps playing when you leave this page."}</p>
          <div className="mt-2 flex gap-3">
            <button type="button" className="quiet is-on" onClick={() => {
              if (playing.track) { togglePause(); return; }
              const row = data.tracks.find((item) => item.url || item.page);
              if (!row) return;
              playCut({ id: row.id, title: row.title, artist: row.artist, album: row.album, url: row.url, page: row.page, art: row.art }, data.tracks.map((item) => ({ id: item.id, title: item.title, artist: item.artist, album: item.album, url: item.url, page: item.page, art: item.art })));
            }}>{playing.track && !playing.paused ? "Pause" : "Play"}</button>
            {playing.track ? <button type="button" className="link-remove" onClick={stopCut}>Stop</button> : null}
          </div>
          {playlists.length ? <p className="accent-purple mt-3 text-[10px] tracking-widest">MUSIC</p> : null}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {playlists.map((name) => (
              <button key={name} type="button" className="quiet accent-purple" onClick={() => {
                const rows = data.tracks.filter((item) => (item.playlist || "Library") === name && (item.url || item.page));
                const first = rows[0];
                if (!first) return;
                playCut({ id: first.id, title: first.title, artist: first.artist, album: first.album, url: first.url, page: first.page, art: first.art }, rows.map((item) => ({ id: item.id, title: item.title, artist: item.artist, album: item.album, url: item.url, page: item.page, art: item.art })));
              }}>{name}</button>
            ))}
          </div>
          {spotLists.length ? <p className="accent-orange mt-3 text-[10px] tracking-widest">SPOTIFY</p> : null}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {spotLists.map((row) => <a key={row.id} className="accent-orange text-sm" href={row.url || "https://open.spotify.com"} target="_blank" rel="noreferrer">{row.name}</a>)}
          </div>
        </Card>
        <Card title="Financial Stats" to="finance">
          <GlowBars rows={money} />
          {data.accounts.map((row) => (
            <label key={row.id} className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span>{row.name}<span className="accent-purple block text-xs">{fmtMoney(row.balance)}</span></span>
              <input className="w-28 rounded-full border border-line bg-ink px-3 py-1 text-right text-sm" style={{ caretColor: "transparent" }} value={row.balance} onChange={(event) => {
                const balance = Number(event.target.value);
                if (!Number.isFinite(balance)) return;
                update((prev) => ({ ...prev, accounts: prev.accounts.map((item) => item.id === row.id ? { ...item, prior: item.balance, balance } : item) }));
              }} />
            </label>
          ))}
          <div className="mt-2"><Add label="New account" onAdd={(name) => update((prev) => ({ ...prev, accounts: [...prev.accounts, { id: newId(), name, balance: 0, prior: 0 }] }))} /></div>
        </Card>
        <Card title="ROI & Volume" to="finance">
          <GlowBars rows={data.products.map((row) => ({ name: row.name, value: row.revenue - row.cost }))} />
          {data.products.map((row) => (
            <div key={row.id} className="mt-2 grid grid-cols-[1fr_5rem_5rem] items-center gap-2 text-sm">
              <span>{row.name}</span>
              <input className="rounded-full border border-line bg-ink px-2 py-1 text-sm" style={{ caretColor: "transparent" }} value={row.cost} aria-label={`${row.name} cost`} onChange={(event) => {
                const cost = Number(event.target.value);
                if (!Number.isFinite(cost)) return;
                update((prev) => ({ ...prev, products: prev.products.map((item) => item.id === row.id ? { ...item, cost } : item) }));
              }} />
              <input className="rounded-full border border-line bg-ink px-2 py-1 text-sm" style={{ caretColor: "transparent" }} value={row.revenue} aria-label={`${row.name} revenue`} onChange={(event) => {
                const revenue = Number(event.target.value);
                if (!Number.isFinite(revenue)) return;
                update((prev) => ({ ...prev, products: prev.products.map((item) => item.id === row.id ? { ...item, revenue } : item) }));
              }} />
            </div>
          ))}
          <div className="mt-2"><Add label="New product" onAdd={(name) => update((prev) => ({ ...prev, products: [...prev.products, { id: newId(), name, cost: 0, revenue: 0 }] }))} /></div>
        </Card>
        <Card title="Credit Scores" to="finance">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-sm text-muted">FICO
              <input className="mt-1 w-full rounded-full border border-line bg-ink px-3 py-1 text-sm text-fg" style={{ caretColor: "transparent" }} value={data.fico} onChange={(event) => { const fico = Number(event.target.value); if (Number.isFinite(fico)) update((prev) => ({ ...prev, fico })); }} />
            </label>
            <label className="text-sm text-muted">Vantage
              <input className="mt-1 w-full rounded-full border border-line bg-ink px-3 py-1 text-sm text-fg" style={{ caretColor: "transparent" }} value={data.vantage} onChange={(event) => { const vantage = Number(event.target.value); if (Number.isFinite(vantage)) update((prev) => ({ ...prev, vantage })); }} />
            </label>
          </div>
          <div className="flex justify-around gap-3">
            <CreditRing label="FICO Score" score={data.fico} bureau="Experian" />
            <CreditRing label="VantageScore" score={data.vantage} bureau="Credit Karma" />
          </div>
          <div className="mt-4 flex h-7 overflow-hidden rounded-lg">
            {CREDIT_LEVELS.map((level) => (
              <div key={level.label} className="flex flex-1 items-center justify-center text-[11px]" style={{ background: `${level.color}30`, color: level.color }}>{level.label}</div>
            ))}
          </div>
        </Card>
        <Card title="Marketing & Web Analytics" to="analytics">
          {data.stats.length ? data.stats.map((row) => (
            <div key={row.id} className="mb-3">
              <p className="text-sm">{row.label} <span className="text-muted">{row.value.toLocaleString()}</span></p>
              <GlowArea rows={(row.points.length ? row.points : [row.value]).map((value, index) => ({ name: String(index + 1), value }))} color="rgba(176, 107, 255, 0.55)" />
            </div>
          )) : data.marketing.map((row) => (
            <div key={row.id} className="mb-3">
              <p className="text-sm">{row.label}</p>
              <GlowArea rows={row.points.map((value, index) => ({ name: String(index + 1), value }))} color="rgba(176, 107, 255, 0.55)" />
            </div>
          ))}
        </Card>
        <Card title="Browser" to="omnisearch">
          <Add label="Search the web" onAdd={(query) => update((prev) => ({ ...prev, query }))} />
          {data.query ? <a className="mt-2 inline-flex min-h-11 items-center text-sm text-blue-2" href={`https://duckduckgo.com/?q=${encodeURIComponent(data.query)}`} target="_blank" rel="noreferrer">Open {data.query}</a> : <p className="text-sm text-muted">Search opens in the browser.</p>}
        </Card>
      </div>
    </div>
    <Card title="AI Task Monitor" to="ai-hub">
      {data.jobs.map((row) => (
        <button key={row.id} type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm" onClick={() => update((prev) => ({ ...prev, jobs: prev.jobs.map((item) => item.id === row.id ? { ...item, active: !item.active } : item) }))}>
          <span><span className="accent-purple">{row.agent}</span>: {row.task}</span>
          <span className={row.active ? "text-green" : "accent-orange"}>{row.active ? "Active" : "Off"}</span>
        </button>
      ))}
      <div className="mt-2"><Add label="New assignment" onAdd={(task) => update((prev) => ({ ...prev, jobs: [{ id: newId(), agent: "Erebus", task, active: true }, ...prev.jobs] }))} /></div>
    </Card>
    <Card title="Activity Feed">
      {data.notifs.map((row) => <p key={row.id} className="min-h-11 text-sm">{row.text} <span className="accent-purple">{row.source}</span></p>)}
    </Card>
    </div>
  );
}

const CREDIT_LEVELS = [
  { label: "Poor", color: "#f43f5e", min: 300, max: 579 },
  { label: "Fair", color: "#fb923c", min: 580, max: 669 },
  { label: "Good", color: "#2dd4bf", min: 670, max: 739 },
  { label: "Great", color: "#34d399", min: 740, max: 850 },
];

function CreditRing({ label, score, bureau }: { label: string; score: number; bureau: string }) {
  const level = CREDIT_LEVELS.find((row) => score >= row.min && score <= row.max);
  const pct = Math.min(100, Math.max(0, ((score - 300) / 550) * 100));
  const length = 2 * Math.PI * 32;
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          <circle cx="40" cy="40" r="32" fill="none" stroke={level?.color ?? "#4fd2ff"} strokeWidth="6" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - pct / 100)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-sm">{score}</span>
          <span className="text-[11px]" style={{ color: level?.color }}>{level?.label ?? band(score)}</span>
        </div>
      </div>
      <p className="text-center text-xs text-muted">{label}<span className="text-ember block">{bureau}</span></p>
    </div>
  );
}


export function Panel({ slug }: { slug: string }) {
  const { data, update } = useMemory();
  const title = NAV.find((item) => item.slug === slug)?.label || "LifeOS";
  return (
    <div className="grid gap-4">
      <PageHead title={title} />
      <WiredPanel slug={slug} data={data} update={update} />
    </div>
  );
}

