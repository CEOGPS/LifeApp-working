import { useEffect, useMemo, useState, type ReactNode } from "react";
import { adoptDevice, deviceId, newId, sanitizeMemory, type Contact, type Memory } from "./memory";
import { moneyTips } from "@/lib/lifeos/board";
import { MonthCalendar } from "./calendar";
import { EmailDesk } from "./email";
import { fmtDate, fmtMoney, fmtPhone } from "./format";
import { CrmDesk, HubDesk, JournalDesk, LegalDesk, MapsDesk, MediaDesk, MessagesDesk, MusicDesk, OfficeDesk, ProjectsDesk, SearchDesk, SimDesk, TerminalDesk, VaultDesk } from "./suite";

type Update = (recipe: (prev: Memory) => Memory) => void;

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="module-card">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <h2 className="module-title">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (value: string) => void; area?: boolean }) {
  const className = "mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-fg outline-none";
  return (
    <label className="block text-sm text-muted">
      {label}
      {area ? (
        <textarea className={`${className} min-h-24`} style={{ caretColor: "transparent" }} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} style={{ caretColor: "transparent" }} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function Add({ label, onAdd }: { label: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const next = value.trim(); if (!next) return; onAdd(next); setValue(""); }}>
      <input className="min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm" style={{ caretColor: "transparent" }} value={value} placeholder={label} onChange={(event) => setValue(event.target.value)} />
      <button type="submit" className="min-h-11 rounded-lg bg-blue px-3 text-sm">Save</button>
    </form>
  );
}

function people(kind: "personal" | "crm", data: Memory, update: Update) {
  const rows = data.contacts.filter((row) => row.kind === kind);
  return {
    rows,
    add: (row: Contact) => update((prev) => ({ ...prev, contacts: [row, ...prev.contacts] })),
    removeAll: () => update((prev) => ({ ...prev, contacts: prev.contacts.filter((row) => row.kind !== kind) })),
    remove: (id: string) => update((prev) => ({ ...prev, contacts: prev.contacts.filter((row) => row.id !== id) })),
  };
}

function parseCsv(text: string, kind: "personal" | "crm"): Contact[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((cell) => cell.trim().toLowerCase().replace(/["']/g, ""));
  const pick = (cells: string[], names: string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    return index >= 0 ? (cells[index] || "").replace(/^"|"$/g, "").trim() : "";
  };
  return lines.slice(1, 201).map((line) => {
    const cells = line.split(",");
    const first = pick(cells, ["first_name", "firstname"]);
    const last = pick(cells, ["last_name", "lastname"]);
    const named = pick(cells, ["name", "full_name", "fullname"]);
    return {
      id: newId(),
      name: named || `${first} ${last}`.trim(),
      company: pick(cells, ["company", "organization"]),
      email: pick(cells, ["email", "e-mail"]),
      phone: pick(cells, ["phone", "phone_number", "mobile"]),
      city: pick(cells, ["city", "address"]),
      avatar: pick(cells, ["avatar", "avatar_url", "image", "photo"]),
      stage: pick(cells, ["stage", "status"]) || "New",
      kind,
    };
  }).filter((row) => row.name);
}

function Contacts({ kind, data, update }: { kind: "personal" | "crm"; data: Memory; update: Update }) {
  const book = people(kind, data, update);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", city: "", avatar: "", stage: "New" });
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const rows = book.rows.filter((row) => `${row.name} ${row.company} ${row.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="grid gap-4">
      <Card title={kind === "crm" ? "CRM" : "Contacts"}>
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-h-11 min-w-40 flex-1 rounded-lg border border-line bg-ink px-3 text-sm" style={{ caretColor: "transparent" }} value={q} placeholder="Search" onChange={(event) => setQ(event.target.value)} />
          <label className="min-h-11 cursor-pointer rounded-lg border border-line px-3 py-2 text-sm text-blue-2">
            Import CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => update((prev) => ({ ...prev, contacts: [...parseCsv(text, kind), ...prev.contacts] })));
            }} />
          </label>
          <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm" onClick={() => {
            const header = "name,company,email,phone,city,avatar,stage\n";
            const body = rows.map((row) => [row.name, row.company, row.email, row.phone, row.city, row.avatar, row.stage].join(",")).join("\n");
            const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `${kind}.csv`;
            link.click();
            URL.revokeObjectURL(url);
          }}>Export</button>
          <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm text-muted" onClick={book.removeAll}>Delete all</button>
        </div>
        <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (!form.name.trim()) return; book.add({ ...form, id: newId(), kind }); setForm({ name: "", company: "", email: "", phone: "", city: "", avatar: "", stage: "New" }); }}>
          <Field label="Name" value={form.name} onChange={set("name")} />
          <Field label="Company" value={form.company} onChange={set("company")} />
          <Field label="Email" value={form.email} onChange={set("email")} />
          <Field label="Phone" value={form.phone} onChange={(value) => set("phone")(fmtPhone(value))} />
          <Field label="City" value={form.city} onChange={set("city")} />
          <Field label="Image URL" value={form.avatar} onChange={set("avatar")} />
          {kind === "crm" ? <Field label="Stage" value={form.stage} onChange={set("stage")} /> : null}
          <button type="submit" className="min-h-11 rounded-lg bg-blue text-sm">Save contact</button>
        </form>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className="module-card flex gap-3 p-4">
            {row.avatar ? <img src={row.avatar} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-full bg-ink text-blue-2">{row.name.slice(0, 1)}</div>}
            <div className="min-w-0 text-sm">
              <p>{row.name}</p>
              <p className="text-muted">{[row.company, row.email, fmtPhone(row.phone), row.city, kind === "crm" ? row.stage : ""].filter(Boolean).join(" · ")}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {row.phone ? <a className="min-h-11 text-green" href={`tel:${row.phone}`}>Call</a> : null}
                {row.phone ? <a className="min-h-11 text-blue-2" href={`sms:${row.phone}`}>Text</a> : null}
                {row.email ? <a className="min-h-11 text-blue-2" href={`mailto:${row.email}`}>Email</a> : null}
                <button type="button" className="min-h-11 text-muted" onClick={() => book.remove(row.id)}>Remove</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const TOOLS = ["SEO Tools", "Site Audit", "Rank Tracking", "Keyword Tool", "Competitor Analysis", "Marketing Automation", "Content Creation", "Customer Intelligence", "Digital Assets", "AI Lead Generator", "Lead Tracker", "Business Listings"];
const SIMS = ["Alternate Life", "Dream Forge", "Echo Persona", "Fantasy Friend", "Narrative Conflict", "Shadow Budget", "Life RPG", "Compliment Cannon", "Smart Browser", "Life Audit"];
const SERVICES = ["NVIDIA", "ElevenLabs", "Stripe", "Luma", "Nylas", "YouTube", "OpenAI", "Anthropic", "xAI", "Telegram", "Google Maps", "Supabase", "SendGrid", "Brevo", "Spotify", "Replicate"];
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "X", "LinkedIn", "YouTube"];
const JOURNAL_TEMPLATES = ["Morning pages", "Win and miss", "Decision log"];
const REPAIR = ["Bring card utilization under 30%", "Stop new late payments", "Dispute inaccurate collections", "Ask for a limit increase on a clean card"];

function Ticker() {
  const [rows, setRows] = useState<{ symbol: string; price: number; change: number }[]>([]);
  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,dogecoin&vs_currencies=usd&include_24hr_change=true")
      .then((response) => response.json())
      .then((data) => {
        const map: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", ripple: "XRP", dogecoin: "DOGE" };
        setRows(Object.entries(map).map(([id, symbol]) => ({ symbol, price: Number(data[id]?.usd) || 0, change: Number(data[id]?.usd_24h_change) || 0 })));
      })
      .catch(() => setRows([]));
  }, []);
  if (!rows.length) return <p className="text-sm text-muted">Live crypto prices load when the quote service answers.</p>;
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {rows.map((row) => (
        <span key={row.symbol}>{row.symbol} ${row.price.toLocaleString()} <span className={row.change >= 0 ? "text-green" : "glow-amber"}>{row.change.toFixed(1)}%</span></span>
      ))}
    </p>
  );
}

function facts(data: Memory) {
  return [
    `Tasks: ${data.tasks.map((row) => `${row.title}${row.done ? " done" : ""}`).join(", ") || "none"}.`,
    `Leads: ${data.leads.map((row) => `${row.name} ${row.status}`).join(", ") || "none"}.`,
    `Unpaid: ${data.expenses.filter((row) => !row.paid).map((row) => row.name).join(", ") || "none"}.`,
  ].join(" ");
}

async function grounded(question: string, data: Memory) {
  try {
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({ data: { question, facts: facts(data) } });
    if (result.ok && result.text) return result.text;
  } catch {
    /* board-only reply below */
  }
  return "No model reply. The note was saved from what you typed.";
}

export function WiredPanel({ slug, data, update }: { slug: string; data: Memory; update: Update }) {
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState("");
  const [place, setPlace] = useState("Atlanta");
  const [tool, setTool] = useState(TOOLS[0]);
  const [code, setCode] = useState("");
  const [playing, setPlaying] = useState(0);
  const [openVault, setOpenVault] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ provider: string; name: string; email: string }[]>([]);
  const [oauthNote, setOauthNote] = useState("");
  useEffect(() => setCode(deviceId()), []);
  useEffect(() => {
    void import("@/lib/lifeos/oauth").then(async ({ finishOAuth, readOauth }) => {
      await finishOAuth().catch(() => null);
      setAccounts(readOauth().map((row) => ({ provider: row.provider, name: row.name, email: row.email })));
    });
  }, []);

  const hits = useMemo(() => {
    const q = data.query.toLowerCase();
    if (!q) return [];
    return [
      ...data.notes.map((row) => `Note · ${row.title}`),
      ...data.contacts.map((row) => `Contact · ${row.name}`),
      ...data.leads.map((row) => `Lead · ${row.name}`),
      ...data.tasks.map((row) => `Task · ${row.title}`),
      ...data.mail.map((row) => `Email · ${row.title}`),
      ...data.projects.map((row) => `Project · ${row.title}`),
    ].filter((row) => row.toLowerCase().includes(q)).slice(0, 12);
  }, [data]);

  if (slug === "email") return <EmailDesk data={data} update={update} />;

  if (slug === "messages") return <MessagesDesk data={data} update={update} />;

  if (slug === "calendar") return (
    <Card title="Calendar">
      <MonthCalendar events={data.events} onAdd={(date, day, title) => {
        update((prev) => ({
          ...prev,
          events: [...prev.events, { id: newId(), day, date, title }],
          notifs: [{ id: newId(), text: `${title} on ${fmtDate(date)}`, source: "Calendar", seen: false }, ...prev.notifs],
        }));
        if (typeof Notification !== "undefined") {
          if (Notification.permission === "granted") new Notification(title, { body: fmtDate(date) });
          else if (Notification.permission === "default") void Notification.requestPermission();
        }
      }} />
    </Card>
  );

  if (slug === "crm") return <div className="grid gap-4"><CrmDesk data={data} update={update} /><Contacts kind="crm" data={data} update={update} /></div>;
  if (slug === "contacts") return <Contacts kind="personal" data={data} update={update} />;
  if (slug === "omnisearch") return <SearchDesk data={data} update={update} />;

  if (slug === "social") return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {PLATFORMS.map((name) => {
        const latest = data.social.find((row) => row.label === name)?.points.at(-1);
        return (
          <Card key={name} title={name}>
            <p className="text-3xl text-blue-2">{latest ?? "—"}</p>
            <p className="text-sm text-muted">One saved count. No chart on social.</p>
            <div className="mt-3"><Add label={`Log ${name}`} onAdd={(value) => {
              const point = Number(value);
              if (!Number.isFinite(point)) return;
              update((prev) => {
                const existing = prev.social.find((row) => row.label === name);
                if (!existing) return { ...prev, social: [...prev.social, { id: newId(), label: name, points: [point] }] };
                return { ...prev, social: prev.social.map((row) => row.label === name ? { ...row, points: [...row.points.slice(-6), point] } : row) };
              });
            }} /></div>
          </Card>
        );
      })}
    </div>
  );

  if (slug === "marketing") {
    const saved = data.notes.find((row) => row.title === `Marketing · ${tool}`);
    return (
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card title="Tools">
          {TOOLS.map((name) => (
            <button key={name} type="button" className={`block min-h-11 w-full text-left text-sm ${tool === name ? "text-blue-2" : ""}`} onClick={() => { setTool(name); setExtra(data.notes.find((row) => row.title === `Marketing · ${name}`)?.body || ""); }}>{name}</button>
          ))}
        </Card>
        <Card title={tool}>
          {tool === "AI Lead Generator" || tool === "Business Listings" ? (
            <Add label={tool === "Business Listings" ? "Business to list" : "Lead name"} onAdd={(name) => update((prev) => ({ ...prev, leads: [{ id: newId(), name, source: tool, status: "New" }, ...prev.leads] }))} />
          ) : tool === "Lead Tracker" ? (
            <ul>{data.leads.map((row) => <li key={row.id} className="min-h-11 text-sm">{row.name} <span className="text-muted">{row.status} · {row.source}</span></li>)}</ul>
          ) : (
            <form className="grid gap-2" onSubmit={(event) => {
              event.preventDefault();
              const title = `Marketing · ${tool}`;
              update((prev) => ({ ...prev, notes: [{ id: saved?.id || newId(), title, body: extra }, ...prev.notes.filter((row) => row.title !== title)] }));
            }}>
              <Field label="Notes" value={extra} onChange={setExtra} area />
              <button type="submit" className="min-h-11 rounded-lg bg-blue text-sm">Save {tool}</button>
            </form>
          )}
          {tool === "Rank Tracking" ? (
            <div className="mt-4">
              {data.marketing.map((row) => <p key={row.id} className="text-sm">{row.label}: {row.points.at(-1)}</p>)}
              <div className="mt-2"><Add label="Log site visits" onAdd={(value) => {
                const point = Number(value);
                if (!Number.isFinite(point)) return;
                update((prev) => ({ ...prev, marketing: prev.marketing.map((item) => item.label === "Site visits" ? { ...item, points: [...item.points.slice(1), point] } : item) }));
              }} /></div>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  if (slug === "leads") return (
    <div className="grid gap-4">
      <Card title="Leads">
        <Add label="New lead" onAdd={(name) => update((prev) => ({ ...prev, leads: [{ id: newId(), name, source: "Manual", status: "New" }, ...prev.leads] }))} />
        <ul className="mt-3">{data.leads.map((row) => (
          <li key={row.id} className="flex min-h-11 flex-wrap items-center gap-2 text-sm">
            <span>{row.name}</span>
            <span className="text-muted">{row.source}</span>
            {["New", "Warm", "Closed"].map((status) => (
              <button key={status} type="button" className={row.status === status ? "text-green" : "text-muted"} onClick={() => update((prev) => ({ ...prev, leads: prev.leads.map((item) => item.id === row.id ? { ...item, status } : item) }))}>{status}</button>
            ))}
          </li>
        ))}</ul>
      </Card>
      <Card title="Community">
        <p className="text-sm text-muted">Neighborhood asks and group recommendations live with the leads. Change the source when one comes from a community.</p>
        {data.leads.filter((row) => /community|nextdoor|group|facebook/i.test(row.source)).map((row) => <p key={row.id} className="min-h-11 text-sm">{row.name} <span className="text-muted">{row.source}</span></p>)}
      </Card>
      <Card title="Lucid">
        {data.ideas.map((row) => (
          <div key={row.id} className="border-b border-line py-3 text-sm">
            <p>{row.title}</p>
            <p className="text-muted">{row.note}</p>
            <button type="button" className="mt-2 min-h-11 text-blue-2" onClick={() => update((prev) => ({ ...prev, ideas: prev.ideas.map((item) => item.id === row.id ? { ...item, approved: !item.approved } : item) }))}>{row.approved ? "Approved — you set up the accounts, then it stays on this list" : "Approve"}</button>
          </div>
        ))}
        <Add label="Low-effort idea" onAdd={(title) => update((prev) => ({ ...prev, ideas: [{ id: newId(), title, note: "Approve it, then set up the accounts yourself. Lucid keeps the plan here.", approved: false }, ...prev.ideas] }))} />
      </Card>
    </div>
  );

  if (slug === "creator") return (
    <Card title="Creator">
      <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); if (!draft.trim()) return; update((prev) => ({ ...prev, media: [{ id: newId(), title: draft.trim(), body: extra.trim(), at: new Date().toISOString() }, ...prev.media] })); setDraft(""); setExtra(""); }}>
        <Field label="Title" value={draft} onChange={setDraft} />
        <Field label="Script, shot list, or edit notes" value={extra} onChange={setExtra} area />
        <button type="submit" className="min-h-11 rounded-lg bg-blue text-sm">Save piece</button>
      </form>
      <ul className="mt-4 grid gap-2">{data.media.map((row) => <li key={row.id} className="text-sm"><span className="text-blue-2">{row.title}</span><span className="mt-1 block text-muted">{row.body}</span></li>)}</ul>
    </Card>
  );

  if (slug === "music-einstein") return (
    <Card title="Music Einstein">
      <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); if (!draft.trim()) return; update((prev) => ({ ...prev, songs: [{ id: newId(), title: draft.trim(), note: extra.trim() || "Verse / chorus / hook" }, ...prev.songs] })); setDraft(""); setExtra(""); }}>
        <Field label="Title" value={draft} onChange={setDraft} />
        <Field label="Key, BPM, verse, chorus, hook" value={extra} onChange={setExtra} area />
        <button type="submit" className="min-h-11 rounded-lg bg-blue text-sm">Save song</button>
      </form>
      <ul className="mt-4">{data.songs.map((row) => <li key={row.id} className="min-h-11 text-sm"><span className="text-blue-2">{row.title}</span><span className="mt-1 block text-muted">{row.note}</span></li>)}</ul>
    </Card>
  );

  if (slug === "music") return <MusicDesk data={data} update={update} />;
  if (slug === "media") return <MediaDesk data={data} update={update} />;

  if (slug === "finance") return (
    <div className="grid gap-4">
      <Card title="Balances">
        {data.accounts.map((row) => (
          <label key={row.id} className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span>{row.name}</span>
            <input className="w-28 rounded-full border border-line bg-ink px-3 py-1 text-right" style={{ caretColor: "transparent" }} value={row.balance} onChange={(event) => {
              const balance = Number(event.target.value);
              if (!Number.isFinite(balance)) return;
              update((prev) => ({ ...prev, accounts: prev.accounts.map((item) => item.id === row.id ? { ...item, prior: item.balance, balance } : item) }));
            }} />
          </label>
        ))}
        <div className="mt-3"><Add label="New account" onAdd={(name) => update((prev) => ({ ...prev, accounts: [...prev.accounts, { id: newId(), name, balance: 0, prior: 0 }] }))} /></div>
      </Card>
      <Card title="Bills">
        {data.expenses.map((row) => (
          <div key={row.id} className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span>{row.name}</span>
            <input className="w-24 rounded-full border border-line bg-ink px-2 py-1 text-right" style={{ caretColor: "transparent" }} value={row.amount} onChange={(event) => {
              const amount = Number(event.target.value);
              if (!Number.isFinite(amount)) return;
              update((prev) => ({ ...prev, expenses: prev.expenses.map((item) => item.id === row.id ? { ...item, amount } : item) }));
            }} />
            <button type="button" className="bg-blue" onClick={() => update((prev) => ({ ...prev, expenses: prev.expenses.map((item) => item.id === row.id ? { ...item, paid: !item.paid } : item) }))}>{row.paid ? "Paid" : "Due"}</button>
          </div>
        ))}
        <div className="mt-3"><Add label="New bill" onAdd={(name) => update((prev) => ({ ...prev, expenses: [{ id: newId(), name, amount: 0, paid: false, fixed: true }, ...prev.expenses] }))} /></div>
      </Card>
      <Card title="Products">
        {data.products.map((row) => (
          <div key={row.id} className="mt-2 grid grid-cols-[1fr_5rem_5rem] gap-2 text-sm">
            <span>{row.name}</span>
            <input className="rounded-full border border-line bg-ink px-2 py-1" style={{ caretColor: "transparent" }} value={row.cost} aria-label="Cost" onChange={(event) => { const cost = Number(event.target.value); if (Number.isFinite(cost)) update((prev) => ({ ...prev, products: prev.products.map((item) => item.id === row.id ? { ...item, cost } : item) })); }} />
            <input className="rounded-full border border-line bg-ink px-2 py-1" style={{ caretColor: "transparent" }} value={row.revenue} aria-label="Revenue" onChange={(event) => { const revenue = Number(event.target.value); if (Number.isFinite(revenue)) update((prev) => ({ ...prev, products: prev.products.map((item) => item.id === row.id ? { ...item, revenue } : item) })); }} />
          </div>
        ))}
        <div className="mt-3"><Add label="New product" onAdd={(name) => update((prev) => ({ ...prev, products: [...prev.products, { id: newId(), name, cost: 0, revenue: 0 }] }))} /></div>
      </Card>
      <Card title="Credit">
        <label className="text-sm">FICO
          <input className="mt-1 w-full rounded-full border border-line bg-ink px-3 py-1" style={{ caretColor: "transparent" }} value={data.fico} onChange={(event) => { const fico = Number(event.target.value); if (Number.isFinite(fico)) update((prev) => ({ ...prev, fico })); }} />
        </label>
        <label className="mt-2 block text-sm">Vantage
          <input className="mt-1 w-full rounded-full border border-line bg-ink px-3 py-1" style={{ caretColor: "transparent" }} value={data.vantage} onChange={(event) => { const vantage = Number(event.target.value); if (Number.isFinite(vantage)) update((prev) => ({ ...prev, vantage })); }} />
        </label>
      </Card>
    </div>
  );

  if (slug === "office") return <OfficeDesk data={data} update={update} />;
  if (slug === "projects") return <ProjectsDesk data={data} update={update} />;
  if (slug === "maps") return <MapsDesk data={data} update={update} />;
  if (slug === "legal") return <LegalDesk data={data} update={update} />;
  if (slug === "journal") return <JournalDesk data={data} update={update} />;

  if (slug === "terminal") return <TerminalDesk data={data} />;
  if (slug === "simulators") return <SimDesk data={data} update={update} />;
  if (slug === "vault") return <VaultDesk data={data} update={update} />;

  if (slug === "ai-hub") return <HubDesk data={data} update={update} />;

  if (slug === "integrations") {
    const rows = SERVICES.map((name) => data.keys.find((row) => row.name === name) || { id: name, name, value: "" });
    return (
      <Card title="Integrations">
        <p className="text-sm text-muted">Google, Facebook, and Spotify use the Supabase login you already turned on. Nothing else on the dashboard is locked.</p>
        <div className="dock-bar mt-3 flex flex-wrap gap-3">
          {(["google", "facebook", "spotify"] as const).map((provider) => {
            const account = accounts.find((row) => row.provider === provider);
            return (
              <button key={provider} type="button" className={account ? "on" : ""} onClick={() => void import("@/lib/lifeos/oauth").then(({ startOAuth }) => startOAuth(provider)).catch((error) => setOauthNote(error instanceof Error ? error.message : "Connect failed."))}>
                {account ? `${provider} · ${account.email || account.name || "connected"}` : `Connect ${provider}`}
              </button>
            );
          })}
        </div>
        {oauthNote ? <p className="text-ember mt-2 text-xs">{oauthNote}</p> : null}
        <button type="button" className="mt-3 min-h-11 rounded-lg border border-line px-3 text-sm text-blue-2" onClick={() => {
          void Promise.all([import("@/lib/lifeos/oauth"), import("@/lib/lifeos/env-keys")]).then(async ([{ readOauth }, { pullProvider }]) => {
            for (const account of readOauth()) {
              const result = await pullProvider({ data: { provider: account.provider, token: account.token } });
              update((prev) => {
                let next = { ...prev, notifs: [{ id: newId(), text: `${account.provider}: ${result.text}`, source: account.provider, seen: false }, ...prev.notifs] };
                if ("events" in result && Array.isArray(result.events)) {
                  const events = result.events.map((item) => ({ id: newId(), day: item.when ? new Date(item.when).getDay() : new Date().getDay(), date: item.when?.slice(0, 10), title: item.title }));
                  next = { ...next, events: [...events, ...next.events] };
                }
                if ("tracks" in result && Array.isArray(result.tracks)) {
                  const links = result.tracks.filter((item) => item.url).map((item) => ({ id: newId(), label: `Spotify · ${item.title}`, href: item.url }));
                  next = { ...next, links: [...links, ...next.links] };
                }
                return next;
              });
            }
          }).catch(() => undefined);
        }}>Pull connected accounts</button>
        <button type="button" className="mt-3 min-h-11 rounded-lg border border-line px-3 text-sm text-blue-2" onClick={() => {
          void import("@/lib/lifeos/env-keys").then(async ({ pullWithKey }) => {
            for (const row of data.keys.filter((item) => item.value)) {
              const result = await pullWithKey({ data: { name: row.name, key: row.value } });
              update((prev) => {
                const note = { id: newId(), text: `${row.name}: ${result.text}`, source: row.name, seen: false };
                let next = { ...prev, notifs: [note, ...prev.notifs] };
                if (row.name === "Stripe" && "balance" in result && typeof result.balance === "number") {
                  const accounts = next.accounts.some((item) => item.name === "Stripe")
                    ? next.accounts.map((item) => item.name === "Stripe" ? { ...item, prior: item.balance, balance: result.balance as number } : item)
                    : [{ id: newId(), name: "Stripe", balance: result.balance as number, prior: 0 }, ...next.accounts];
                  next = { ...next, accounts };
                }
                if (row.name === "Nylas" && "messages" in result && Array.isArray(result.messages)) {
                  const mail = result.messages.map((item) => ({ id: newId(), title: item.title, body: item.body, at: item.at, folder: "inbox" as const, to: "", from: "Nylas", starred: false }));
                  next = { ...next, mail: [...mail, ...next.mail.filter((item) => item.from !== "Nylas")] };
                }
                if (row.name === "YouTube" && "videos" in result && Array.isArray(result.videos)) {
                  const links = result.videos.map((item) => ({ id: newId(), label: item.title, href: item.href }));
                  next = { ...next, links: [...links, ...next.links] };
                }
                return next;
              });
            }
          }).catch(() => undefined);
        }}>Pull live data</button>
        <ul className="mt-4 grid gap-3">
          {rows.map((row) => (
            <li key={row.name}>
              <Field label={row.name} value={row.value} onChange={(value) => update((prev) => {
                const found = prev.keys.find((item) => item.name === row.name);
                if (!found) return { ...prev, keys: [{ id: newId(), name: row.name, value }, ...prev.keys] };
                return { ...prev, keys: prev.keys.map((item) => item.name === row.name ? { ...item, value } : item) };
              })} />
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <Card title="Settings">
      <p className="text-sm text-muted">Notes, tasks, contacts, and the rest of the board sync with this code. Keys and the vault stay on this browser only.</p>
      <p className="mt-2 break-all font-mono text-xs text-blue-2">{code}</p>
      <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("code"); const next = input instanceof HTMLInputElement ? input.value : ""; if (adoptDevice(next) && input instanceof HTMLInputElement) input.value = ""; }}>
        <input name="code" placeholder="Paste a code from another browser" className="min-h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-sm" style={{ caretColor: "transparent" }} />
        <button type="submit" className="min-h-11 rounded-lg bg-blue px-3 text-sm">Load</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-lg bg-blue px-3 text-sm" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = "lifeos.json";
          link.click();
          URL.revokeObjectURL(url);
        }}>Export</button>
        <label className="min-h-11 cursor-pointer rounded-lg border border-line px-3 py-2 text-sm">
          Import
          <input type="file" accept="application/json" className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => update(() => sanitizeMemory(JSON.parse(text))));
          }} />
        </label>
      </div>
    </Card>
  );
}
