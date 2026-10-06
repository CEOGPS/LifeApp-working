import { useMemo, useState, type ReactNode } from "react";
import { newId, type Memory } from "./memory";
import { fmtPhone } from "./format";

type Update = (recipe: (prev: Memory) => Memory) => void;
const field = "h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm";
const SOURCES = ["Google", "Bing", "DuckDuckGo", "Brave", "Yahoo", "Wikipedia", "Reddit", "X", "LinkedIn", "Facebook", "Instagram", "YouTube", "TikTok", "Nextdoor", "Craigslist", "Yelp", "BBB", "Angi", "Thumbtack", "Google Business", "Apple Maps", "Bing Places", "Whitepages", "TruePeopleSearch", "FastPeopleSearch", "Spokeo", "Hunter", "Have I Been Pwned", "TinEye", "Google Lens", "Yandex", "GitHub", "Stack Overflow", "Product Hunt", "Crunchbase", "OpenCorporates", "SEC EDGAR", "CourtListener", "Google Patents", "Indeed", "Glassdoor", "Zillow", "Redfin", "Realtor", "Apartments", "LoopNet", "Census", "Data.gov", "OpenStreetMap", "Weather.gov"];

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

export { MapsDesk } from "./maps-desk";
export { OfficeDesk } from "./office-desk";
export { JournalDesk } from "./journal-desk";
export { MusicDesk } from "./music-desk";
export { MediaDesk } from "./media-desk";
export { ProjectsDesk } from "./projects-desk";
export { HubDesk } from "./ai-hub-desk";
export { TerminalDesk } from "./terminal-desk";
export { SimDesk } from "./sim-desk";
export { VaultDesk } from "./vault-desk";
