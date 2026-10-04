import { useMemo, useState, type ReactNode } from "react";
import { newId, type Memory } from "./memory";
import { fmtDate, fmtPhone, fmtTime } from "./format";
import { runCommand, runSim, SIMS } from "./sims";

type Update = (recipe: (prev: Memory) => Memory) => void;
const field = "h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm";
const SOURCES = ["Google", "Bing", "DuckDuckGo", "Brave", "Yahoo", "Wikipedia", "Reddit", "X", "LinkedIn", "Facebook", "Instagram", "YouTube", "TikTok", "Nextdoor", "Craigslist", "Yelp", "BBB", "Angi", "Thumbtack", "Google Business", "Apple Maps", "Bing Places", "Whitepages", "TruePeopleSearch", "FastPeopleSearch", "Spokeo", "Hunter", "Have I Been Pwned", "TinEye", "Google Lens", "Yandex", "GitHub", "Stack Overflow", "Product Hunt", "Crunchbase", "OpenCorporates", "SEC EDGAR", "CourtListener", "Google Patents", "Indeed", "Glassdoor", "Zillow", "Redfin", "Realtor", "Apartments", "LoopNet", "Census", "Data.gov", "OpenStreetMap", "Weather.gov"];
const STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="module-card">
      <div className="border-b border-white/10 px-4 py-3"><h2 className="module-title">{title}</h2></div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const AGENTS = new Set(["Nyx", "Erebus", "Kranos", "Nova", "You"]);

function chatPartner(line: { who: string; text: string; mine: boolean }) {
  if (line.mine && (line.who === "You" || AGENTS.has(line.who))) {
    const match = /^([^:]{1,40}):\s/.exec(line.text);
    return match && !AGENTS.has(match[1]) ? match[1] : null;
  }
  if (AGENTS.has(line.who)) return null;
  return line.who;
}

function chatBody(line: { who: string; text: string; mine: boolean }) {
  if (line.mine) {
    const match = /^([^:]{1,40}):\s([\s\S]*)$/.exec(line.text);
    if (match) return match[2];
  }
  return line.text;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

export function MessagesDesk({ data, update }: { data: Memory; update: Update }) {
  const [who, setWho] = useState("");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const needle = q.trim().toLowerCase();
  const conversations = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of data.thread) {
      const name = chatPartner(line);
      if (name) map.set(name, chatBody(line));
    }
    if (who && !map.has(who)) map.set(who, "New conversation");
    return [...map.entries()]
      .map(([name, last]) => ({ name, last }))
      .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.last.toLowerCase().includes(needle));
  }, [data.thread, who, needle]);
  const person = data.contacts.find((row) => row.name === who);
  const lines = data.thread.filter((line) => chatPartner(line) === who);
  const picks = data.contacts.filter((row) => !needle || row.name.toLowerCase().includes(needle)).slice(0, 8);

  function open(name: string) {
    setWho(name);
    setPicking(false);
  }

  return (
    <section className="module-card grid min-h-[34rem] overflow-hidden lg:grid-cols-[18rem_1fr]">
      <aside className="flex min-h-0 flex-col border-b border-white/10 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
          <h2 className="module-title">Chats</h2>
          <button type="button" className="ml-auto bg-blue" onClick={() => setPicking((value) => !value)}>{picking ? "Close" : "New"}</button>
        </div>
        <label className="px-3 py-2">
          <input className={field} value={q} placeholder="Search chats" onChange={(event) => setQ(event.target.value)} />
        </label>
        {picking ? (
          <ul className="max-h-40 overflow-y-auto border-b border-white/10 px-2 pb-2">
            {picks.map((row) => (
              <li key={row.id}>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5" onClick={() => open(row.name)}>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs">{initials(row.name)}</span>
                  {row.name}
                </button>
              </li>
            ))}
            {picks.length === 0 ? <li className="px-2 py-2 text-sm text-white/40">No matching contacts.</li> : null}
          </ul>
        ) : null}
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {conversations.map((row) => (
            <li key={row.name}>
              <button type="button" className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left ${who === row.name ? "bg-[oklch(0.68_0.15_230/16%)]" : "hover:bg-white/5"}`} onClick={() => open(row.name)}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-black/40 text-xs text-blue-2">{initials(row.name)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{row.name}</span>
                  <span className="block truncate text-xs text-white/40">{row.last}</span>
                </span>
              </button>
            </li>
          ))}
          {conversations.length === 0 ? <li className="px-2 py-6 text-sm text-white/40">No conversations yet. Start one with New.</li> : null}
        </ul>
      </aside>
      <div className="flex min-h-[24rem] flex-col">
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          {who ? (
            <>
              <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/10 bg-black/40 text-sm text-blue-2">
                {person?.avatar ? <img src={person.avatar} alt="" className="h-full w-full object-cover" /> : initials(who)}
              </span>
              <span>
                <span className="block text-sm">{who}</span>
                <span className="block text-xs text-white/40">{person ? fmtPhone(person.phone) || person.email || "Saved contact" : "No contact card"}</span>
              </span>
              {person?.phone ? (
                <span className="ml-auto flex gap-2">
                  <a className="bg-blue" href={`tel:${person.phone.replace(/\D/g, "")}`}>Call</a>
                  <a className="bg-blue" href={`sms:${person.phone.replace(/\D/g, "")}`}>Text</a>
                </span>
              ) : null}
            </>
          ) : <h2 className="module-title">Messages</h2>}
        </header>
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
          {who ? lines.map((row) => (
            <li key={row.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${row.mine ? "ml-auto bg-[rgba(76,29,149,0.45)]" : "bg-white/5"}`}>{chatBody(row)}</li>
          )) : <li className="m-auto text-sm text-white/40">Choose a conversation. Contacts stay in Contacts until you message them.</li>}
          {who && lines.length === 0 ? <li className="m-auto text-sm text-white/40">No messages with {who} yet.</li> : null}
        </ul>
        <form className="mt-auto flex gap-2 border-t border-white/10 p-3" onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim() || !who) return;
          update((prev) => ({ ...prev, thread: [...prev.thread, { id: newId(), who, text: text.trim(), mine: true }] }));
          setText("");
        }}>
          <input className={field} value={text} placeholder={who ? `Message ${who}` : "Choose a conversation"} disabled={!who} onChange={(event) => setText(event.target.value)} />
          <button type="submit" className="bg-blue" disabled={!who}>Send</button>
        </form>
      </div>
    </section>
  );
}

export function SearchDesk({ data, update }: { data: Memory; update: Update }) {
  const [q, setQ] = useState(data.query);
  const [kind, setKind] = useState<"web" | "phone" | "email" | "image">("web");
  const hits = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return [];
    return [
      ...data.notes.map((row) => `Note · ${row.title}`),
      ...data.contacts.map((row) => `Contact · ${row.name}`),
      ...data.leads.map((row) => `Lead · ${row.name}`),
      ...data.tasks.map((row) => `Task · ${row.title}`),
      ...data.mail.map((row) => `Email · ${row.title}`),
    ].filter((row) => row.toLowerCase().includes(needle)).slice(0, 8);
  }, [data, q]);
  const query = kind === "phone" ? fmtPhone(q) || q : q;
  const links = kind === "phone"
    ? [["Whitepages", `https://www.whitepages.com/phone/${q.replace(/\D/g, "")}`], ["TruePeopleSearch", `https://www.truepeoplesearch.com/results?phoneno=${encodeURIComponent(q)}`]]
    : kind === "email"
      ? [["Google", `https://www.google.com/search?q=${encodeURIComponent(q)}`], ["Have I Been Pwned", `https://haveibeenpwned.com/account/${encodeURIComponent(q)}`]]
      : kind === "image"
        ? [["Google Lens", `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(q)}`], ["TinEye", `https://tineye.com/search?url=${encodeURIComponent(q)}`], ["Yandex", `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(q)}`]]
        : SOURCES.slice(0, 12).map((name) => [name, `https://duckduckgo.com/?q=${encodeURIComponent(`${query} site:${name.replaceAll(" ", "").toLowerCase()}`)}`] as [string, string]);
  return (
    <Box title="OmniSearch">
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); update((prev) => ({ ...prev, query })); }}>
        <input className={field} value={q} placeholder={kind === "image" ? "Image URL" : kind === "phone" ? "Phone" : kind === "email" ? "Email" : "Search"} onChange={(event) => setQ(kind === "phone" ? fmtPhone(event.target.value) : event.target.value)} />
        <button type="submit" className="bg-blue">Search</button>
      </form>
      <div className="dock-bar mt-3 flex gap-3">
        {(["web", "phone", "email", "image"] as const).map((item) => <button key={item} type="button" className={kind === item ? "on" : ""} onClick={() => setKind(item)}>{item}</button>)}
      </div>
      <ul className="mt-3">{hits.map((row) => <li key={row} className="py-1 text-sm">{row}</li>)}</ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map(([label, href]) => <a key={label} className="text-sm text-blue-2" href={href} target="_blank" rel="noreferrer">{label}</a>)}
      </div>
      <p className="mt-3 text-xs text-white/40">{SOURCES.length} sources. Web search opens the live index. Phone, email, and image search open the matching lookup.</p>
    </Box>
  );
}

export function MapsDesk({ data, update }: { data: Memory; update: Update }) {
  const [form, setForm] = useState({ zip: "30303", county: "Fulton", state: "GA", radius: "10", area: "" });
  const [q, setQ] = useState("30303 Fulton GA");
  const areas = data.notes.filter((row) => row.title.startsWith("Service area ·"));
  const query = [form.zip, form.county, form.state, form.area, form.radius ? `${form.radius} mile radius` : ""].filter(Boolean).join(" ");
  return (
    <Box title="Maps">
      <form className="grid gap-2 sm:grid-cols-5" onSubmit={(event) => { event.preventDefault(); setQ(query); }}>
        {(["zip", "county", "state", "radius", "area"] as const).map((key) => (
          <input key={key} className={field} placeholder={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
        ))}
        <button type="submit" className="bg-blue sm:col-span-5">Search</button>
      </form>
      <iframe title="Map" className="mt-3 h-80 w-full rounded-xl" src={`https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=12&output=embed`} />
      <button type="button" className="bg-blue mt-3" onClick={() => update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Service area · ${q}`, body: q }, ...prev.notes] }))}>Save service area</button>
      <ul className="mt-3">{areas.map((row) => <li key={row.id} className="py-1 text-sm">{row.title.replace("Service area · ", "")}</li>)}</ul>
    </Box>
  );
}

export function OfficeDesk({ data, update }: { data: Memory; update: Update }) {
  const docs = data.notes.filter((row) => row.title.startsWith("Doc ·"));
  const [name, setName] = useState("Untitled");
  const [body, setBody] = useState("");
  const [sheet, setSheet] = useState("Item,Value\nLeads,4\nRevenue,1200");
  const rows = sheet.split(/\n/).slice(1).map((line) => line.split(",")).filter((row) => row[0]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Box title="Doc">
        <input className={field} value={name} onChange={(event) => setName(event.target.value)} />
        <textarea className="mt-2 min-h-48 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" style={{ caretColor: "transparent" }} value={body} onChange={(event) => setBody(event.target.value)} />
        <button type="button" className="bg-blue mt-2" onClick={() => update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Doc · ${name}`, body }, ...prev.notes] }))}>Save doc</button>
        <ul className="mt-3">{docs.map((row) => <li key={row.id}><button type="button" className="py-1 text-left text-sm" onClick={() => { setName(row.title.replace("Doc · ", "")); setBody(row.body); }}>{row.title}</button></li>)}</ul>
      </Box>
      <Box title="Sheet">
        <textarea className="min-h-40 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 font-mono text-xs" style={{ caretColor: "transparent" }} value={sheet} onChange={(event) => setSheet(event.target.value)} />
        <div className="mt-3 grid gap-1">
          {rows.map((row) => (
            <div key={row[0]} className="grid grid-cols-[1fr_4rem_1fr] items-center gap-2 text-sm">
              <span>{row[0]}</span>
              <span>{row[1]}</span>
              <span className="h-2 rounded-full bg-violet-400/70" style={{ width: `${Math.min(100, Number(row[1]) || 0)}%` }} />
            </div>
          ))}
        </div>
        <button type="button" className="bg-blue mt-3" onClick={() => update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Sheet · ${fmtDate(new Date())}`, body: sheet }, ...prev.notes] }))}>Save sheet</button>
      </Box>
    </div>
  );
}

export function JournalDesk({ data, update }: { data: Memory; update: Update }) {
  const books = [...new Set(data.journal.map((row) => row.title.split(" · ")[0] || "Inbox"))];
  const [book, setBook] = useState(books[0] || "Inbox");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const pages = data.journal.filter((row) => row.title.startsWith(`${book} ·`) || (book === "Inbox" && !row.title.includes(" · ")));
  return (
    <div className="grid gap-4 lg:grid-cols-[12rem_1fr]">
      <Box title="Notebooks">
        {books.map((name) => <button key={name} type="button" className={`block py-1 text-sm ${book === name ? "text-blue-2" : ""}`} onClick={() => setBook(name)}>{name}</button>)}
        <form className="mt-2" onSubmit={(event) => { event.preventDefault(); if (title.trim()) setBook(title.trim()); setTitle(""); }}>
          <input className={field} placeholder="New notebook" value={title} onChange={(event) => setTitle(event.target.value)} />
        </form>
      </Box>
      <Box title={book}>
        <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); if (!body.trim()) return; update((prev) => ({ ...prev, journal: [{ id: newId(), title: `${book} · ${fmtDate(new Date())} ${fmtTime()}`, body, at: new Date().toISOString() }, ...prev.journal] })); setBody(""); }}>
          <textarea className="min-h-36 rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" style={{ caretColor: "transparent" }} placeholder="Page" value={body} onChange={(event) => setBody(event.target.value)} />
          <button type="submit" className="bg-blue">Save page</button>
        </form>
        <ul className="mt-3">{pages.map((row) => <li key={row.id} className="border-t border-white/10 py-2 text-sm"><span className="text-ember text-xs">{row.title}</span><span className="mt-1 block whitespace-pre-wrap">{row.body}</span></li>)}</ul>
      </Box>
    </div>
  );
}

export function MusicDesk({ data, update }: { data: Memory; update: Update }) {
  const [index, setIndex] = useState(0);
  const track = data.tracks[index];
  return (
    <Box title="Music">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("url"); const url = input instanceof HTMLInputElement ? input.value.trim() : ""; if (!url) return; update((prev) => ({ ...prev, tracks: [...prev.tracks, { id: newId(), title: url.split("/").pop() || "Track", url }] })); if (input instanceof HTMLInputElement) input.value = ""; }}>
        <input name="url" className={field} placeholder="Audio URL" />
        <button type="submit" className="bg-blue">Add</button>
      </form>
      {track ? <audio key={track.id} className="mt-3 w-full" controls autoPlay src={track.url} /> : <p className="mt-3 text-sm text-white/40">Add a track to start the queue.</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" className="bg-blue" onClick={() => setIndex((value) => (value - 1 + data.tracks.length) % Math.max(1, data.tracks.length))}>Prev</button>
        <button type="button" className="bg-blue" onClick={() => setIndex((value) => (value + 1) % Math.max(1, data.tracks.length))}>Next</button>
      </div>
      <ul className="mt-3">{data.tracks.map((row, item) => <li key={row.id}><button type="button" className={`py-1 text-sm ${item === index ? "text-blue-2" : ""}`} onClick={() => setIndex(item)}>{row.title}</button></li>)}</ul>
    </Box>
  );
}

export function MediaDesk({ data, update }: { data: Memory; update: Update }) {
  const [q, setQ] = useState("");
  const images = data.links.filter((row) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(row.href) || row.label.startsWith("Image ·"));
  return (
    <Box title="Media">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!/^https?:\/\//i.test(q)) return; update((prev) => ({ ...prev, links: [...prev.links, { id: newId(), label: `Image · ${q.split("/").pop() || "image"}`, href: q }] })); setQ(""); }}>
        <input className={field} value={q} placeholder="Image URL" onChange={(event) => setQ(event.target.value)} />
        <button type="submit" className="bg-blue">Add</button>
      </form>
      <a className="mt-2 inline-flex text-sm text-blue-2" href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q || "life")}`} target="_blank" rel="noreferrer">Search images</a>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {images.map((row) => <a key={row.id} href={row.href} target="_blank" rel="noreferrer"><img src={row.href} alt="" className="h-28 w-full rounded-xl object-cover" /></a>)}
      </div>
    </Box>
  );
}

export function ProjectsDesk({ data, update }: { data: Memory; update: Update }) {
  const [title, setTitle] = useState("");
  const columns = ["To do", "Doing", "Done"];
  return (
    <Box title="Projects">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!title.trim()) return; update((prev) => ({ ...prev, projects: [{ id: newId(), title: title.trim(), body: "To do", at: new Date().toISOString() }, ...prev.projects] })); setTitle(""); }}>
        <input className={field} value={title} placeholder="New project" onChange={(event) => setTitle(event.target.value)} />
        <button type="submit" className="bg-blue">Add</button>
      </form>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {columns.map((status) => (
          <div key={status}>
            <p className="text-ember text-xs">{status}</p>
            {data.projects.filter((row) => row.body === status).map((row) => (
              <button key={row.id} type="button" className="mt-2 block w-full rounded-xl border border-white/10 p-2 text-left text-sm" onClick={() => update((prev) => ({ ...prev, projects: prev.projects.map((item) => item.id === row.id ? { ...item, body: columns[(columns.indexOf(status) + 1) % 3] } : item) }))}>{row.title}</button>
            ))}
          </div>
        ))}
      </div>
    </Box>
  );
}

export function LegalDesk({ data, update }: { data: Memory; update: Update }) {
  const [form, setForm] = useState({ kind: "NDA", party: "", other: "", date: fmtDate(new Date()), money: "" });
  const body = form.kind === "NDA"
    ? `Mutual NDA dated ${form.date}. ${form.party} and ${form.other} will keep shared information private and use it only for the stated purpose.`
    : form.kind === "Invoice terms"
      ? `Invoice terms dated ${form.date}. ${form.party} will pay ${form.other} ${form.money || "$0.00"} within 15 days. Late amounts accrue 1.5% per month.`
      : `Scope of work dated ${form.date}. ${form.party} will deliver the described work to ${form.other} for ${form.money || "$0.00"}. Changes require a written note.`;
  return (
    <Box title="Legal">
      <p className="text-xs text-white/40">Drafts you write. Not legal advice.</p>
      <div className="dock-bar mt-2 flex gap-3">
        {["NDA", "Invoice terms", "Scope of work"].map((kind) => <button key={kind} type="button" className={form.kind === kind ? "on" : ""} onClick={() => setForm({ ...form, kind })}>{kind}</button>)}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className={field} placeholder="Your name" value={form.party} onChange={(event) => setForm({ ...form, party: event.target.value })} />
        <input className={field} placeholder="Other party" value={form.other} onChange={(event) => setForm({ ...form, other: event.target.value })} />
        <input className={field} placeholder="MM/DD/YYYY" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        <input className={field} placeholder="$0.00" value={form.money} onChange={(event) => setForm({ ...form, money: event.target.value })} />
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm">{body}</p>
      <button type="button" className="bg-blue mt-3" onClick={() => update((prev) => ({ ...prev, legal: [{ id: newId(), title: `${form.kind} · ${form.date}`, body, at: new Date().toISOString() }, ...prev.legal] }))}>Save draft</button>
      <ul className="mt-3">{data.legal.map((row) => <li key={row.id} className="py-1 text-sm">{row.title}</li>)}</ul>
    </Box>
  );
}

export function HubDesk({ data, update }: { data: Memory; update: Update }) {
  const [form, setForm] = useState({ name: "", soul: "", personality: "", instructions: "", rules: "", voice: "Nova" });
  const agents = data.notes.filter((row) => row.title.startsWith("Agent ·"));
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Box title="Agents">
        {data.jobs.map((row) => (
          <button key={row.id} type="button" className="flex w-full items-center justify-between py-1 text-left text-sm" onClick={() => update((prev) => ({ ...prev, jobs: prev.jobs.map((item) => item.id === row.id ? { ...item, active: !item.active } : item) }))}>
            <span>{row.agent}</span><span className={row.active ? "text-green" : "text-white/35"}>{row.active ? "On" : "Off"}</span>
          </button>
        ))}
        {agents.map((row) => <p key={row.id} className="py-1 text-sm">{row.title.replace("Agent · ", "")}</p>)}
      </Box>
      <Box title="New agent">
        {(["name", "soul", "personality", "instructions", "rules", "voice"] as const).map((key) => (
          <label key={key} className="mt-2 block text-xs text-white/45">{key}
            <input className={field + " mt-1"} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
          </label>
        ))}
        <button type="button" className="bg-blue mt-3" onClick={() => {
          if (!form.name.trim()) return;
          update((prev) => ({
            ...prev,
            notes: [{ id: newId(), title: `Agent · ${form.name.trim()}`, body: `Soul: ${form.soul}\nPersonality: ${form.personality}\nInstructions: ${form.instructions}\nRules: ${form.rules}\nVoice: ${form.voice}` }, ...prev.notes],
            jobs: [{ id: newId(), agent: form.name.trim(), task: "Awaiting assignment", active: false }, ...prev.jobs],
          }));
          setForm({ name: "", soul: "", personality: "", instructions: "", rules: "", voice: "Nova" });
        }}>Create agent</button>
      </Box>
    </div>
  );
}

export function CrmDesk({ data, update }: { data: Memory; update: Update }) {
  const rows = data.contacts.filter((row) => row.kind === "crm");
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {STAGES.map((stage) => (
        <section key={stage} className="module-card p-3">
          <p className="text-ember text-xs">{stage}</p>
          {rows.filter((row) => row.stage === stage).map((row) => (
            <button key={row.id} type="button" className="mt-2 block w-full rounded-xl border border-white/10 p-2 text-left text-sm" onClick={() => update((prev) => ({ ...prev, contacts: prev.contacts.map((item) => item.id === row.id ? { ...item, stage: STAGES[(STAGES.indexOf(stage) + 1) % STAGES.length] } : item) }))}>
              {row.name}<span className="block text-xs text-white/40">{row.company}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

export function TerminalDesk({ data }: { data: Memory }) {
  const [log, setLog] = useState<string[]>(["LifeOS terminal. Type help."]);
  const [line, setLine] = useState("");
  return (
    <section className="module-card p-4">
      <pre className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap font-mono text-sm text-green">{log.join("\n")}</pre>
      <form className="mt-3 flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        const text = line.trim();
        if (!text) return;
        const result = runCommand(text, data);
        setLine("");
        setLog((prev) => result === "__clear__" ? ["LifeOS terminal. Type help."] : [...prev, `> ${text}`, result]);
      }}>
        <span className="text-green">{">"}</span>
        <input className="h-8 flex-1 bg-transparent font-mono text-sm outline-none" style={{ caretColor: "transparent" }} value={line} onChange={(event) => setLine(event.target.value)} />
      </form>
    </section>
  );
}

export function SimDesk({ data, update }: { data: Memory; update: Update }) {
  const [name, setName] = useState<string>(SIMS[0]);
  const [result, setResult] = useState("");
  return (
    <section className="module-card p-4">
      <div className="dock-bar flex flex-col items-start gap-1">
        {SIMS.map((item) => <button key={item} type="button" className={name === item ? "on" : ""} onClick={() => setName(item)}>{item}</button>)}
      </div>
      <button type="button" className="bg-blue mt-4" onClick={() => {
        const text = runSim(name, data);
        setResult(text);
        update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Sim · ${name}`, body: text }, ...prev.notes.filter((row) => row.title !== `Sim · ${name}`)] }));
      }}>Run</button>
      {result ? <p className="mt-4 whitespace-pre-wrap text-sm">{result}</p> : <p className="mt-4 text-sm text-white/40">Each simulator only uses what is saved on the board. It will say when a fact is missing.</p>}
    </section>
  );
}

export function VaultDesk({ data, update }: { data: Memory; update: Update }) {
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="module-card p-4">
      <p className="text-sm text-white/50">Stored only in this browser. It is left out of sync.</p>
      <form className="mt-3 grid gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!label.trim() && !secret.trim()) return;
        update((prev) => ({ ...prev, vault: [{ id: newId(), title: label.trim() || "Locked note", body: secret.trim(), at: new Date().toISOString() }, ...prev.vault] }));
        setLabel("");
        setSecret("");
      }}>
        <input className={field} placeholder="Label" value={label} onChange={(event) => setLabel(event.target.value)} />
        <textarea className="min-h-24 rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" style={{ caretColor: "transparent" }} placeholder="Secret" value={secret} onChange={(event) => setSecret(event.target.value)} />
        <button type="submit" className="bg-blue">Lock it here</button>
      </form>
      <ul className="mt-4">
        {data.vault.map((row) => (
          <li key={row.id} className="border-t border-white/10 py-2 text-sm">
            <button type="button" onClick={() => setOpen(open === row.id ? null : row.id)}>{row.title}</button>
            {open === row.id ? <p className="mt-1 text-white/70">{row.body}</p> : null}
            <button type="button" className="text-ember ml-3 text-xs" onClick={() => update((prev) => ({ ...prev, vault: prev.vault.filter((item) => item.id !== row.id) }))}>Delete</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
