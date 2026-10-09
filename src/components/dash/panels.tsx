import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { newId, type Contact, type Memory } from "./memory";
import { moneyTips } from "@/lib/lifeos/board";
import { CalendarDesk } from "./calendar";
import { EmailDesk } from "./email";
import { fmtDate, fmtDateInput, fmtMoney, fmtPhone, fmtTime } from "./format";
import { Area, AreaChart, Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis } from "recharts";
import { HubDesk, JournalDesk, MapsDesk, MediaDesk, MessagesDesk, MusicDesk, OfficeDesk, ProjectsDesk, SearchDesk, SimDesk, VaultDesk } from "./suite";
import { SocialDesk } from "./social-desk";
import { CreatorDesk } from "./creator-desk";
import { EinsteinDesk } from "./einstein-desk";
import { IntegrationsDesk } from "./integrations-desk";
import { FinanceDesk } from "./finance-desk";
import { MarketingDesk } from "./marketing-desk";
import { AnalyticsDesk } from "./analytics-desk";
import { SettingsDesk } from "./settings-desk";
import { LucidDesk } from "./lucid-desk";
import { pushNotice } from "./app-settings";

type Update = (recipe: (prev: Memory) => Memory) => void;

const SOURCES = [
  { id: "nextdoor", label: "Nextdoor" },
  { id: "facebook", label: "Facebook groups" },
  { id: "craigslist", label: "Craigslist" },
  { id: "reddit", label: "Reddit" },
  { id: "offerup", label: "OfferUp" },
];
const DEFAULT_GROUPS = [
  { id: "connectionsllc", label: "Connections LLC", url: "https://www.facebook.com/groups/connectionsllc" },
  { id: "2021408511473331", label: "2021408511473331", url: "https://www.facebook.com/groups/2021408511473331" },
  { id: "537846923790610", label: "537846923790610", url: "https://www.facebook.com/groups/537846923790610" },
  { id: "536595090120155", label: "536595090120155", url: "https://www.facebook.com/groups/536595090120155" },
  { id: "958327068681121", label: "958327068681121", url: "https://www.facebook.com/groups/958327068681121" },
];

function LeadsDesk({ data, update }: { data: Memory; update: Update }) {
  const [service, setService] = useState("");
  const [city, setCity] = useState("");
  const [sources, setSources] = useState<string[]>(SOURCES.map((row) => row.id));
  const [groupUrl, setGroupUrl] = useState("");
  const [groupName, setGroupName] = useState("");
  const [posts, setPosts] = useState<{ title: string; url: string; snippet: string; source: string }[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [who, setWho] = useState("");
  const [referral, setReferral] = useState("");

  useEffect(() => {
    if (data.groups.length) return;
    update((prev) => prev.groups.length ? prev : { ...prev, groups: DEFAULT_GROUPS });
  }, [data.groups.length, update]);

  async function search() {
    if (!service.trim()) { setNote("Type the service."); return; }
    setBusy(true);
    setNote("Searching public posts…");
    const { findCommunity } = await import("@/lib/lifeos/sync");
    const result = await findCommunity({ data: { service, city, sources, groups: data.groups } });
    setPosts(result.posts);
    setNote(result.note || `${result.posts.length} public posts.`);
    setBusy(false);
  }

  function saveLead(row: { title: string; url: string; snippet: string; source: string }) {
    update((prev) => prev.leads.some((item) => item.url === row.url) ? prev : {
      ...prev,
      leads: [{ id: newId(), name: row.title, source: row.source, status: "New", url: row.url, note: row.snippet }, ...prev.leads],
    });
    pushNotice("leads", row.source, row.title);
    setNote("Saved to leads.");
  }

  function saveReferral(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const line = [fmtPhone(phone), who.trim() ? `Referred by ${who.trim()}` : "", referral.trim()].filter(Boolean).join(" · ");
    update((prev) => ({ ...prev, leads: [{ id: newId(), name: name.trim(), source: "Referral", status: "New", url: "", note: line }, ...prev.leads] }));
    pushNotice("leads", "Referral", name.trim());
    setName("");
    setPhone("");
    setWho("");
    setReferral("");
    setNote("Referral saved.");
  }

  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <section className="module-card p-3">
        <p className="module-title">Search</p>
        <div className="mt-3 grid gap-2">
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={service} placeholder="Service" onChange={(event) => setService(event.target.value)} />
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={city} placeholder="City, blank = national" onChange={(event) => setCity(event.target.value)} />
          <button type="button" className="bg-blue w-fit" disabled={busy} onClick={() => void search()}>{busy ? "Searching" : "Search"}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SOURCES.map((row) => (
            <button key={row.id} type="button" className={`quiet ${sources.includes(row.id) ? "is-on" : ""}`} onClick={() => setSources((prev) => prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id])}>{row.label}</button>
          ))}
        </div>
        {note ? <p className="mt-3 text-xs text-white/50">{note}</p> : null}
        <div className="mt-3 grid max-h-72 gap-3 overflow-y-auto">
          {posts.map((row) => (
            <article key={row.url} className="border-b border-white/10 pb-3">
              <p className="text-sm">{row.title}</p>
              <p className="text-[11px] text-white/40">{row.source}</p>
              {row.snippet ? <p className="mt-1 text-xs text-white/60">{row.snippet}</p> : null}
              <div className="mt-2 flex gap-4">
                <a className="text-sm text-blue-2" href={row.url} target="_blank" rel="noreferrer">Open</a>
                <button type="button" className="link-add" onClick={() => saveLead(row)}>Save</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="module-card p-3">
        <p className="module-title">Facebook groups</p>
        <ul className="mt-3 max-h-64 overflow-y-auto">
          {data.groups.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 border-b border-white/10 py-2 text-sm">
              <a className="truncate text-blue-2" href={row.url} target="_blank" rel="noreferrer">{row.label}</a>
              <button type="button" className="link-remove shrink-0" onClick={() => update((prev) => ({ ...prev, groups: prev.groups.filter((item) => item.id !== row.id) }))}>Remove</button>
            </li>
          ))}
        </ul>
        <form className="mt-3 grid gap-2" onSubmit={(event) => {
          event.preventDefault();
          const url = groupUrl.trim().split("?")[0];
          const slug = url.split("/groups/")[1]?.split(/[/?#]/)[0] || "";
          if (!/^https?:\/\/(www\.)?facebook\.com\/groups\//i.test(url) || !slug) { setNote("Paste a facebook.com/groups link."); return; }
          update((prev) => prev.groups.some((item) => item.url.includes(`/groups/${slug}`)) ? prev : { ...prev, groups: [...prev.groups, { id: slug.slice(0, 40), label: groupName.trim() || slug, url }] });
          setGroupUrl("");
          setGroupName("");
        }}>
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={groupName} placeholder="Group name" onChange={(event) => setGroupName(event.target.value)} />
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={groupUrl} placeholder="https://www.facebook.com/groups/…" onChange={(event) => setGroupUrl(event.target.value)} />
          <button type="submit" className="bg-blue w-fit">Add group</button>
        </form>
      </section>
      <section className="module-card p-3">
        <p className="module-title">Referral</p>
        <form className="mt-3 grid gap-2" onSubmit={saveReferral}>
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={phone} placeholder="Phone" onChange={(event) => setPhone(event.target.value)} />
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={who} placeholder="Referred by" onChange={(event) => setWho(event.target.value)} />
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={referral} placeholder="What they need" onChange={(event) => setReferral(event.target.value)} />
          <button type="submit" className="bg-blue w-fit">Save referral</button>
        </form>
      </section>
      <section className="module-card p-3">
        <p className="module-title">Saved</p>
        <ul className="mt-3 max-h-80 overflow-y-auto">
          {data.leads.map((row) => (
            <li key={row.id} className="border-b border-white/10 py-2 text-sm">
              <span>{row.name}</span>
              <span className="ml-2 text-white/40">{row.source}</span>
              {row.note ? <span className="mt-1 block text-xs text-white/50">{row.note}</span> : null}
              {row.url ? <a className="text-blue-2" href={row.url} target="_blank" rel="noreferrer">Open</a> : null}
              <span className="mt-1 flex flex-wrap gap-2">
                {["New", "Warm", "Closed"].map((status) => (
                  <button key={status} type="button" className={row.status === status ? "text-green" : "text-white/40"} onClick={() => update((prev) => ({ ...prev, leads: prev.leads.map((item) => item.id === row.id ? { ...item, status } : item) }))}>{status}</button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

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
        <textarea className={`${className} min-h-24`} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} value={value} onChange={(event) => onChange(event.target.value)} />
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
    add: (row: Contact) => update((prev) => ({ ...prev, contacts: [{ ...row, kind }, ...prev.contacts] })),
    removeAll: () => update((prev) => ({ ...prev, contacts: prev.contacts.filter((row) => row.kind !== kind) })),
    remove: (id: string) => update((prev) => ({ ...prev, contacts: prev.contacts.filter((row) => row.id !== id) })),
  };
}

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else quoted = false;
      } else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parts(value: string) {
  return value.split("|").map((part) => part.trim()).filter(Boolean);
}

function values(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object") {
      const row = item as { value?: unknown; platform?: unknown };
      const value = String(row.value || "").trim();
      const platform = String(row.platform || "").trim();
      return platform && value ? `${platform}: ${value}` : value;
    }
    return "";
  }).filter(Boolean);
}

function readMeta(raw: string): Record<string, unknown> {
  let text = raw.trim();
  if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).replace(/""/g, '"');
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  if (!text.startsWith("{")) return {};
  try {
    let parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "string") parsed = JSON.parse(parsed) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function dig(value: unknown, keys: string[], depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => dig(item, keys, depth + 1));
  if (typeof value !== "object") return [];
  const found: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const norm = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (keys.includes(norm)) {
      if (typeof child === "string" || typeof child === "number") found.push(String(child));
      else {
        const listed = values(Array.isArray(child) ? child : []);
        found.push(...(listed.length ? listed : dig(child, keys, depth + 1)));
      }
    } else found.push(...dig(child, keys, depth + 1));
  }
  return found.map((item) => item.trim()).filter(Boolean);
}

function jsonBits(raw: string, key: string) {
  return [...raw.matchAll(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "gi"))].map((match) => match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim()).filter(Boolean);
}

function parseCsv(text: string, kind: "personal" | "crm"): Contact[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsv(lines[0]).map((cell) => cell.toLowerCase().replace(/[^a-z0-9_]+/g, ""));
  const gather = (cells: string[], test: (header: string) => boolean) => {
    const found: string[] = [];
    headers.forEach((header, index) => {
      const value = (cells[index] || "").trim();
      if (test(header) && value) found.push(value);
    });
    return found;
  };
  return lines.slice(1).map((line) => {
    let cells = splitCsv(line);
    const metaIndex = headers.indexOf("metadata");
    if (metaIndex >= 0 && cells.length > headers.length) {
      const extra = cells.length - headers.length;
      cells = [...cells.slice(0, metaIndex), cells.slice(metaIndex, metaIndex + extra + 1).join(","), ...cells.slice(metaIndex + extra + 1)];
    }
    const metaRaw = (cells[metaIndex] || "").trim();
    const meta = readMeta(metaRaw);
    const emails = [...new Set([
      ...gather(cells, (header) => header.includes("email")).flatMap(parts),
      ...dig(meta, ["email", "emails", "emailaddress"]),
      ...jsonBits(metaRaw, "email"),
      ...(line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []),
    ].map((item) => item.trim()).filter((item) => item.includes("@")))];
    const phones = [...new Set([
      ...gather(cells, (header) => header.includes("phone") || header.includes("mobile")).flatMap(parts),
      ...dig(meta, ["phone", "phones", "phonenumber", "mobile"]),
      ...jsonBits(metaRaw, "phone"),
    ].map((item) => fmtPhone(item)).filter((item) => /\d/.test(item)))];
    const websites = [...new Set([...gather(cells, (header) => header.includes("website") || header === "url").flatMap(parts), ...dig(meta, ["website", "websites", "url"]), ...jsonBits(metaRaw, "website")])];
    const socials = [...new Set([...gather(cells, (header) => header.includes("social")).flatMap(parts), ...dig(meta, ["social", "socials"])])];
    const linkedin = gather(cells, (header) => header.includes("linkedin"))[0] || dig(meta, ["linkedin", "linkedinurl"])[0] || "";
    if (linkedin && !socials.some((item) => item.includes(linkedin))) socials.push(`LinkedIn: ${linkedin}`);
    const first = gather(cells, (header) => header === "firstname" || header === "first_name" || header === "first")[0] || dig(meta, ["firstname"])[0] || "";
    const last = gather(cells, (header) => header === "lastname" || header === "last_name" || header === "last")[0] || dig(meta, ["lastname"])[0] || "";
    const named = gather(cells, (header) => header === "fullname" || header === "name" || header === "contactname" || header === "displayname")[0] || "";
    const firstName = first || (named.includes(" ") ? named.split(" ").slice(0, -1).join(" ") : named);
    const lastName = last || (named.includes(" ") ? named.split(" ").slice(-1).join(" ") : "");
    const company = gather(cells, (header) => header.includes("company") || header.includes("organization"))[0] || dig(meta, ["company", "organization"])[0] || jsonBits(metaRaw, "company")[0] || "";
    const city = gather(cells, (header) => header === "city" || header.endsWith("city"))[0] || dig(meta, ["city"])[0] || jsonBits(metaRaw, "city")[0] || "";
    const address = gather(cells, (header) => header === "address" || header === "street" || header.endsWith("street"))[0] || dig(meta, ["address", "street"])[0] || jsonBits(metaRaw, "address")[0] || "";
    const state = gather(cells, (header) => header === "state" || header.endsWith("region"))[0] || dig(meta, ["state"])[0] || jsonBits(metaRaw, "state")[0] || "";
    const zip = gather(cells, (header) => header === "zip" || header.includes("postal"))[0] || dig(meta, ["zip", "postal", "postalcode"])[0] || jsonBits(metaRaw, "zip")[0] || "";
    const note = gather(cells, (header) => header === "notes" || header === "note")[0] || dig(meta, ["notes", "note"])[0] || jsonBits(metaRaw, "notes")[0] || "";
    const birthday = fmtDateInput(gather(cells, (header) => header.includes("birth"))[0] || dig(meta, ["birthday", "birthdate"])[0] || jsonBits(metaRaw, "birthday")[0] || "");
    const avatar = gather(cells, (header) => header.includes("avatar") || header.includes("image") || header.includes("photo") || header.includes("picture"))[0] || dig(meta, ["imageupload", "avatar", "photourl", "picture"])[0] || "";
    const jobTitle = gather(cells, (header) => header === "jobtitle" || header === "job_title" || header === "title")[0] || dig(meta, ["jobtitle", "title"])[0] || "";
    return {
      id: newId(),
      name: `${firstName} ${lastName}`.trim() || emails[0] || phones[0] || "",
      firstName,
      lastName,
      company,
      email: emails[0] || "",
      phone: phones[0] || "",
      city,
      avatar,
      stage: gather(cells, (header) => header === "stage" || header === "status")[0] || dig(meta, ["stage"])[0] || "New",
      deal: (gather(cells, (header) => header === "deal" || header === "value" || header === "amount")[0] || dig(meta, ["value", "deal"])[0] || "").replace(/[^0-9.]/g, ""),
      note,
      birthday,
      address,
      state,
      zip,
      emails,
      phones,
      websites,
      socials,
      jobTitle,
      source: gather(cells, (header) => header === "source")[0] || dig(meta, ["source"])[0] || "",
      tag: gather(cells, (header) => header === "tag")[0] || dig(meta, ["tag"])[0] || "",
      kind,
    };
  }).filter((row) => row.name || row.email || row.phone).map((row) => ({ ...row, kind }));
}

const PEOPLE_STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
const RELATIONS = ["Family", "Friend", "Associate", "Coworker", "Enemy"];
const BLANK = { firstName: "", lastName: "", name: "", company: "", email: "", phone: "", city: "", avatar: "", stage: "New", deal: "", note: "", birthday: "", address: "", state: "", zip: "", emails: [] as string[], phones: [] as string[], websites: [] as string[], socials: [] as string[], jobTitle: "", source: "", tag: "" };

const SOCIALS = ["Instagram", "Facebook", "X", "TikTok", "LinkedIn", "YouTube", "Snapchat", "WhatsApp", "Telegram", "Threads", "Pinterest", "Other"];

function splitSocial(value: string) {
  const raw = value.trim();
  if (!raw) return { platform: "Other", handle: "" };
  const known = SOCIALS.find((item) => item !== "Other" && raw.toLowerCase().startsWith(`${item.toLowerCase()}:`));
  if (known) return { platform: known, handle: raw.slice(known.length + 1).trim() };
  const lower = raw.toLowerCase();
  const hosts: [string, string][] = [["instagram.com", "Instagram"], ["facebook.com", "Facebook"], ["fb.com", "Facebook"], ["twitter.com", "X"], ["x.com", "X"], ["tiktok.com", "TikTok"], ["linkedin.com", "LinkedIn"], ["youtube.com", "YouTube"], ["snapchat.com", "Snapchat"], ["wa.me", "WhatsApp"], ["whatsapp", "WhatsApp"], ["t.me", "Telegram"], ["threads.net", "Threads"], ["pinterest.com", "Pinterest"]];
  const host = hosts.find(([site]) => lower.includes(site));
  if (host) return { platform: host[1], handle: raw };
  const hinted = SOCIALS.find((item) => item !== "Other" && lower.includes(item.toLowerCase()));
  if (hinted) return { platform: hinted, handle: raw.replace(/^[^:]+:\s*/, "") };
  return { platform: "Other", handle: raw };
}

function Socials({ rows, onChange }: { rows: string[]; onChange: (rows: string[]) => void }) {
  const list = rows.length ? rows : [""];
  const write = (index: number, platform: string, handle: string) => {
    const next = [...list];
    next[index] = `${platform}: ${handle.trim()}`;
    onChange(next);
  };
  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Social accounts</span>
        <button type="button" className="link-add" onClick={() => onChange([...list, ""])}>Add</button>
      </div>
      {list.map((row, index) => {
        const { platform, handle } = splitSocial(row);
        return (
          <div key={`social-${index}`} className="mt-1 flex gap-2">
            <select className="h-8 w-36 shrink-0 rounded-full border border-line bg-black/40 px-2 text-sm" value={platform} aria-label="Social platform" onChange={(event) => write(index, event.target.value, handle)}>
              {SOCIALS.map((item) => <option key={item}>{item}</option>)}
            </select>
            <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={handle} placeholder="@username or profile URL" onChange={(event) => write(index, platform, event.target.value)} />
            <button type="button" className="link-remove" onClick={() => onChange(list.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
          </div>
        );
      })}
    </div>
  );
}

function Repeat({ label, rows, onChange, placeholder }: { label: string; rows: string[]; onChange: (rows: string[]) => void; placeholder: string }) {
  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <button type="button" className="link-add" onClick={() => onChange([...rows, ""])}>Add</button>
      </div>
      {rows.map((row, index) => (
        <div key={`${label}-${index}`} className="mt-1 flex gap-2">
          <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={row} placeholder={placeholder} onChange={(event) => onChange(rows.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
          <button type="button" className="link-remove" onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
        </div>
      ))}
    </div>
  );
}

type Kin = {
  firstName: string;
  lastName: string;
  company: string;
  birthday: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  avatar: string;
  relation: string;
  emails: string[];
  phones: string[];
  websites: string[];
  socials: string[];
  notes: string;
};

function blankKin(): Kin {
  return { firstName: "", lastName: "", company: "", birthday: "", address: "", city: "", state: "", zip: "", avatar: "", relation: "", emails: [""], phones: [""], websites: [], socials: [], notes: "" };
}

function readKin(body: string): Kin {
  const blank = blankKin();
  try {
    const parsed = JSON.parse(body) as Partial<Kin> & { email?: string; phone?: string };
    return {
      ...blank,
      ...parsed,
      emails: Array.isArray(parsed.emails) && parsed.emails.length ? parsed.emails : parsed.email ? [parsed.email] : [""],
      phones: Array.isArray(parsed.phones) && parsed.phones.length ? parsed.phones : parsed.phone ? [parsed.phone] : [""],
      websites: parsed.websites || [],
      socials: parsed.socials || [],
    };
  } catch {
    return { ...blank, notes: body };
  }
}

function kinName(kin: Kin) {
  return `${kin.firstName} ${kin.lastName}`.trim();
}

function readPhoto(file: File, onDone: (url: string) => void) {
  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => {
    const scale = Math.min(1, 240 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    onDone(canvas.toDataURL("image/jpeg", 0.72));
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

function FamilyForm({ form, setForm, onSave, onCancel }: { form: Kin; setForm: (recipe: (prev: Kin) => Kin) => void; onSave: () => void; onCancel: () => void }) {
  const set = (key: keyof Kin) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <Field label="First name" value={form.firstName} onChange={set("firstName")} />
      <Field label="Last name" value={form.lastName} onChange={set("lastName")} />
      <Field label="Company" value={form.company} onChange={set("company")} />
      <label className="text-sm text-muted">Relationship
        <select className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={form.relation} onChange={(event) => set("relation")(event.target.value)}>
          <option value="">None</option>
          {RELATIONS.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      <label className="text-sm text-muted">Photo
        <input className="mt-1 block w-full text-sm" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) readPhoto(file, (url) => set("avatar")(url)); event.target.value = ""; }} />
      </label>
      <div className="flex items-end gap-3">
        {form.avatar ? <img src={form.avatar} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-[10px] text-white/40">No photo</div>}
        {form.avatar ? <button type="button" className="link-remove" onClick={() => set("avatar")("")}>Delete photo</button> : null}
      </div>
      <Repeat label="Phones" rows={form.phones} placeholder="1(000) 000-0000" onChange={(rows) => setForm((prev) => ({ ...prev, phones: rows.map((item) => fmtPhone(item)) }))} />
      <Repeat label="Emails" rows={form.emails} placeholder="name@email.com" onChange={(rows) => setForm((prev) => ({ ...prev, emails: rows }))} />
      <Field label="Birthday" value={form.birthday} onChange={(value) => set("birthday")(fmtDateInput(value))} />
      <Field label="Street" value={form.address} onChange={set("address")} />
      <Field label="City" value={form.city} onChange={set("city")} />
      <Field label="State" value={form.state} onChange={set("state")} />
      <Field label="ZIP" value={form.zip} onChange={set("zip")} />
      <Field label="Image URL" value={form.avatar.startsWith("data:") ? "" : form.avatar} onChange={set("avatar")} />
      <Repeat label="Websites" rows={form.websites} placeholder="https://" onChange={(rows) => setForm((prev) => ({ ...prev, websites: rows }))} />
      <Socials rows={form.socials} onChange={(rows) => setForm((prev) => ({ ...prev, socials: rows }))} />
      <Field label="Notes" value={form.notes} onChange={set("notes")} area />
      <div className="flex gap-2">
        <button type="submit" className="bg-blue">Save</button>
        <button type="button" className="quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function FamilyShelf({ data, update }: { data: Memory; update: Update }) {
  const people = data.notes.filter((row) => row.title.startsWith("Family · "));
  const [form, setForm] = useState<Kin>(blankKin());
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState("");

  function write(id: string | null) {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const who = `${firstName} ${lastName}`.trim();
    if (!who) return;
    const emails = form.emails.map((item) => item.trim()).filter((item) => item.includes("@"));
    const phones = form.phones.map((item) => item.trim()).filter((item) => /\d/.test(item));
    const next: Kin = { ...form, firstName, lastName, emails, phones, websites: form.websites.map((item) => item.trim()).filter(Boolean), socials: form.socials.map((item) => item.trim()).filter(Boolean) };
    const title = `Family · ${who}`;
    const body = JSON.stringify(next);
    update((prev) => ({
      ...prev,
      notes: [{ id: id || newId(), title, body }, ...prev.notes.filter((row) => row.id !== id && row.title !== title)],
    }));
    setForm(blankKin());
    setEditing(null);
  }

  function beginEdit(row: { id: string; title: string; body: string }) {
    const kin = readKin(row.body);
    if (!kin.firstName && !kin.lastName) {
      const parts = row.title.replace("Family · ", "").trim().split(/\s+/);
      kin.firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";
      kin.lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    }
    setForm(kin);
    setEditing(row.id);
  }

  async function coach(title: string, body: string) {
    const kin = readKin(body);
    setTip("Reading the profile…");
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({
      data: {
        name: "Kranos",
        prompt: "Give three specific things Chris can do this week for this family member. Use only the profile. Do not invent events.",
        facts: `${title}. ${kin.relation}. Phones ${kin.phones.join(", ") || "none"}. Emails ${kin.emails.join(", ") || "none"}. Birthday ${kin.birthday || "unknown"}. Address ${[kin.address, kin.city, kin.state, kin.zip].filter(Boolean).join(", ") || "unknown"}. Notes ${kin.notes || "none"}.`,
        question: "What should he do this week?",
      },
    });
    setTip(result.text || "No tip came back.");
  }

  return (
    <section className="module-card mb-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">Family <span className="text-sm text-white/40">{people.length}</span></h2>
        <div className="flex gap-3">
          <button type="button" className="quiet" onClick={() => setOpen((value) => !value)}>{open ? "Minimize" : "Open"}</button>
          <button type="button" className="quiet is-on" onClick={() => { setOpen(true); setForm(blankKin()); setEditing("new"); }}>Add family</button>
        </div>
      </div>
      {!open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {people.slice(0, 12).map((row) => {
            const kin = readKin(row.body);
            const name = kinName(kin) || row.title.replace("Family · ", "");
            return (
              <button key={row.id} type="button" className="flex items-center gap-2 rounded-full border border-white/10 px-2 py-1 text-sm" onClick={() => { setOpen(true); beginEdit(row); }}>
                {kin.avatar ? <img src={kin.avatar} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px]">{name.slice(0, 1)}</span>}
                {name}
              </button>
            );
          })}
          {people.length > 12 ? <span className="self-center text-xs text-white/40">+{people.length - 12}</span> : null}
        </div>
      ) : null}
      {open ? <p className="text-sm text-white/45">Same fields as a contact. They stay on this board and are not CRM leads.</p> : null}
      {open && editing === "new" ? <FamilyForm form={form} setForm={setForm} onSave={() => write(null)} onCancel={() => { setEditing(null); setForm(blankKin()); }} /> : null}
      {open ? <div className="mt-3 grid max-h-80 gap-3 overflow-y-auto">
        {people.map((row) => {
          const kin = readKin(row.body);
          const name = kinName(kin) || row.title.replace("Family · ", "");
          const phones = kin.phones.filter((item) => /\d/.test(item));
          const emails = kin.emails.filter((item) => item.includes("@"));
          const address = [kin.address, kin.city, kin.state, kin.zip].filter(Boolean).join(", ");
          if (editing === row.id) return <FamilyForm key={row.id} form={form} setForm={setForm} onSave={() => write(row.id)} onCancel={() => { setEditing(null); setForm(blankKin()); }} />;
          return (
            <div key={row.id} className="rounded-xl border border-white/10 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {kin.avatar ? <img src={kin.avatar} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-sm">{name.slice(0, 1)}</div>}
                  <div>
                    <p className="text-base text-white">{name} {kin.relation ? <span className="text-sm text-white/40">{kin.relation}</span> : null}</p>
                    <p className="text-blue-2">{phones.map((item) => fmtPhone(item)).join(" · ") || "No phone"}</p>
                    <p className="text-blue-2">{emails.join(" · ") || "No email"}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" className="quiet" onClick={() => beginEdit(row)}>Edit</button>
                  <button type="button" className="link-remove" onClick={() => { if (window.confirm(`Delete ${name}?`)) update((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.id !== row.id) })); }}>Delete</button>
                </div>
              </div>
              <p className="mt-2 text-white/70">{[kin.company, address].filter(Boolean).join(" · ") || "No address"}</p>
              <p className="text-white/50">{kin.birthday ? `Birthday ${kin.birthday}` : "No birthday"}</p>
              {kin.websites.filter(Boolean).map((site) => <p key={site} className="truncate text-blue-2">{site}</p>)}
              {kin.socials.filter(Boolean).map((item) => {
                const social = splitSocial(item);
                return <p key={item} className="text-white/75">{social.platform}: {social.handle}</p>;
              })}
              {kin.notes ? <p className="mt-2 whitespace-pre-wrap text-white/75">{kin.notes}</p> : null}
              <button type="button" className="quiet mt-2" onClick={() => void coach(row.title, row.body)}>Tips</button>
            </div>
          );
        })}
        {!people.length && editing !== "new" ? <p className="text-sm text-white/40">No family profiles yet.</p> : null}
      </div> : null}
      {tip ? <p className="mt-3 whitespace-pre-wrap text-sm text-white/70">{tip}</p> : null}
    </section>
  );
}

function Contacts({ kind, data, update }: { kind: "personal" | "crm"; data: Memory; update: Update }) {
  const book = people(kind, data, update);
  const rows = useMemo(() => data.contacts.filter((row) => row.kind === kind), [data.contacts, kind]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(0);
  const [stage, setStage] = useState("All");
  const [relation, setRelation] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "new">("view");
  const [form, setForm] = useState(BLANK);
  const [importNote, setImportNote] = useState("");
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let next = rows.filter((row) => !needle || `${row.name} ${row.firstName} ${row.lastName} ${row.company} ${row.email} ${row.phone} ${row.city}`.toLowerCase().includes(needle));
    if (kind === "crm" && stage !== "All") next = next.filter((row) => row.stage === stage);
    if (kind === "personal" && relation !== "All") next = next.filter((row) => row.tag === relation);
    next = [...next].sort((a, b) => {
      if (sort === "company") return (a.company || "").localeCompare(b.company || "");
      if (sort === "name-desc") return (b.name || b.email || b.phone || "").localeCompare(a.name || a.email || a.phone || "");
      return (a.name || a.email || a.phone || "").localeCompare(b.name || b.email || b.phone || "");
    });
    return next;
  }, [rows, q, kind, stage, relation, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const open = rows.find((row) => row.id === selected) || null;
  const hot = rows.filter((row) => row.stage === "Qualified" || row.stage === "Proposal" || Number(row.deal) > 0).length;
  const pipeline = rows.reduce((sum, row) => sum + (Number(row.deal) || 0), 0);

  function exportCsv() {
    const header = "first_name,last_name,company,emails,phones,address,city,state,zip,birthday,avatar,stage,deal,websites,socials,notes\n";
    const body = filtered.map((row) => [row.firstName, row.lastName, row.company, row.emails.join("|"), row.phones.join("|"), row.address, row.city, row.state, row.zip, row.birthday, row.avatar, row.stage, row.deal, row.websites.join("|"), row.socials.join("|"), row.note].map((cell) => /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function beginNew() {
    setMode("new");
    setSelected(null);
    setForm(BLANK);
  }

  function saveForm() {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const emails = form.emails.map((item) => item.trim()).filter((item) => item.includes("@"));
    const phones = form.phones.map((item) => item.trim()).filter((item) => /\d/.test(item));
    const next = { ...form, firstName, lastName, name: `${firstName} ${lastName}`.trim(), emails, phones, websites: form.websites.map((item) => item.trim()).filter(Boolean), socials: form.socials.map((item) => item.trim()).filter(Boolean), email: emails[0] || "", phone: phones[0] || "", deal: kind === "crm" ? form.deal : "" };
    if (!next.name) return;
    if (mode === "edit" && selected) {
      update((prev) => ({ ...prev, contacts: prev.contacts.map((item) => item.id === selected ? { ...item, ...next, kind } : item) }));
      setMode("view");
      return;
    }
    const id = newId();
    book.add({ ...next, id, kind });
    setSelected(id);
    setMode("view");
    setForm(BLANK);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" data-keep="off" value={q} placeholder={kind === "crm" ? "Search name, email, phone, company" : "Search contacts"} onChange={(event) => { setQ(event.target.value); setPage(0); }} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="h-7 w-24 rounded-full border border-line bg-black/40 px-2 text-xs" value={pageSize} aria-label="Page size" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}>
            {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
          <select className="h-7 w-32 rounded-full border border-line bg-black/40 px-2 text-xs" value={sort} aria-label="Sort" onChange={(event) => { setSort(event.target.value); setPage(0); }}>
            <option value="name">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="company">Company</option>
          </select>
          <button type="button" className="quiet" onClick={() => {
            const headers = ["first_name", "last_name", "company", "job_title", "email", "email_2", "phone", "phone_2", "address", "city", "state", "zip", "birthday", "avatar", "website", "linkedin", "socials", "notes"];
            const sample = ["Jane", "Doe", "Acme", "Owner", "jane@acme.com", "", "14045551212", "", "1 Main St", "Atlanta", "GA", "30301", "01/15/1990", "", "https://acme.com", "", "Instagram: @jane", "Met at the shop"];
            if (kind === "crm") {
              headers.push("stage", "deal", "source", "tag");
              sample.push("New", "1000", "Referral", "Hot");
            }
            const csv = `${headers.join(",")}\n${sample.join(",")}\n`;
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = kind === "crm" ? "crm-template.csv" : "contacts-template.csv";
            link.click();
            URL.revokeObjectURL(url);
          }}>Template</button>
          <button type="button" className="quiet" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              const incoming = parseCsv(text, kind).map((row) => ({ ...row, kind }));
              const keyOf = (row: Contact) => `${row.kind}|${(row.name || "").toLowerCase()}|${(row.email || "").toLowerCase()}|${row.phone}`;
              let added = 0;
              update((prev) => {
                const seen = new Set(prev.contacts.map(keyOf));
                const fresh = incoming.filter((row) => {
                  const key = keyOf(row);
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
                added = fresh.length;
                return { ...prev, contacts: [...fresh, ...prev.contacts] };
              });
              setImportNote(`Added ${added.toLocaleString()} of ${incoming.length.toLocaleString()} into ${kind === "crm" ? "CRM" : "Contacts"}.`);
            });
            event.target.value = "";
          }} />
          <button type="button" className="quiet" onClick={exportCsv}>Export</button>
          <button type="button" className="danger" onClick={() => { if (rows.length && window.confirm(`Delete all ${rows.length} ${kind === "crm" ? "CRM leads" : "contacts"}? This cannot be undone.`)) book.removeAll(); }}>Delete all</button>
          <button type="button" className="bg-blue" onClick={beginNew}>{kind === "crm" ? "New lead" : "New contact"}</button>
        </div>
      </div>
      {importNote ? <p className="mb-3 text-sm text-white/50">{importNote}</p> : null}
      {kind === "personal" ? <FamilyShelf data={data} update={update} /> : null}
      {kind === "crm" ? (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="module-card p-3 text-center"><p className="text-[10px] tracking-widest text-white/40">LEADS</p><p className="text-lg">{rows.length.toLocaleString()}</p></div>
          <div className="module-card p-3 text-center"><p className="text-[10px] tracking-widest text-white/40">HOT</p><p className="text-lg text-ember">{hot}</p></div>
          <div className="module-card p-3 text-center"><p className="text-[10px] tracking-widest text-white/40">PIPELINE</p><p className="text-lg text-green">{fmtMoney(pipeline)}</p></div>
        </div>
      ) : null}
      {kind === "crm" ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] tracking-widest text-white/40">STAGE</span>
          {["All", ...PEOPLE_STAGES].map((name) => (
            <button key={name} type="button" className={`quiet ${stage === name ? "is-on" : ""}`} onClick={() => { setStage(name); setPage(0); }}>{name}</button>
          ))}
        </div>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] tracking-widest text-white/40">RELATIONSHIP</span>
          {["All", ...RELATIONS].map((name) => (
            <button key={name} type="button" className={`quiet ${relation === name ? "is-on" : ""}`} onClick={() => { setRelation(name); setPage(0); }}>{name}</button>
          ))}
        </div>
      )}
      <div className="mb-3 flex items-center gap-3 text-sm text-white/50">
        <button type="button" className="quiet" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Prev</button>
        <span>Page {safePage + 1} of {pageCount} · {slice.length.toLocaleString()} on this page · {filtered.length.toLocaleString()} match · {rows.length.toLocaleString()} {kind === "crm" ? "CRM" : "personal"}</span>
        {(q || stage !== "All" || relation !== "All") && filtered.length !== rows.length ? <button type="button" className="quiet" onClick={() => { setQ(""); setStage("All"); setRelation("All"); setPage(0); }}>Clear filter</button> : null}
        <button type="button" className="quiet" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
      <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="module-card h-[36rem] space-y-2 overflow-y-auto p-2">
          {slice.length === 0 ? <p className="p-4 text-sm text-white/40">{rows.length === 0 ? "None yet." : `None of the ${rows.length.toLocaleString()} match this search.`}</p> : null}
          {slice.map((row) => (
            <div key={row.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${selected === row.id ? "border-[oklch(0.72_0.14_220/45%)] bg-[oklch(0.68_0.15_230/16%)]" : "border-white/10 bg-black/30"}`} onClick={() => { setSelected(row.id); setMode("view"); }}>
              {row.avatar && !row.avatar.startsWith("data:") ? <img src={row.avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px]">{(row.name || row.email || "?").slice(0, 2).toUpperCase()}</div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{row.name || "No name"}</p>
                <p className="truncate text-[11px] text-blue-2">{[row.phone ? fmtPhone(row.phone) : "", row.email, row.company].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              {kind === "crm" ? <span className="text-[10px] text-blue-2">{row.stage}</span> : row.tag ? <span className="text-[10px] text-blue-2">{row.tag}</span> : null}
            </div>
          ))}
        </aside>
        <section className="module-card p-4">
          {mode === "new" || mode === "edit" ? (
            <form className="grid gap-2 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); saveForm(); }}>
              <Field label="First name" value={form.firstName} onChange={set("firstName")} />
              <Field label="Last name" value={form.lastName} onChange={set("lastName")} />
              <Field label="Company" value={form.company} onChange={set("company")} />
              <Repeat label="Phones" rows={form.phones} placeholder="1(000) 000-0000" onChange={(rows) => setForm((prev) => ({ ...prev, phones: rows.map((item) => fmtPhone(item)) }))} />
              <Repeat label="Emails" rows={form.emails} placeholder="name@email.com" onChange={(rows) => setForm((prev) => ({ ...prev, emails: rows }))} />
              <Field label="Birthday" value={form.birthday} onChange={(value) => set("birthday")(fmtDateInput(value))} />
              <Field label="Street" value={form.address} onChange={set("address")} />
              <Field label="City" value={form.city} onChange={set("city")} />
              <Field label="State" value={form.state} onChange={set("state")} />
              <Field label="ZIP" value={form.zip} onChange={set("zip")} />
              <Field label="Image URL" value={form.avatar} onChange={set("avatar")} />
              {kind === "personal" ? (
                <label className="text-sm text-muted">Relationship
                  <select className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={form.tag} onChange={(event) => set("tag")(event.target.value)}>
                    <option value="">None</option>
                    {RELATIONS.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </label>
              ) : null}
              <Repeat label="Websites" rows={form.websites} placeholder="https://" onChange={(rows) => setForm((prev) => ({ ...prev, websites: rows }))} />
              <Socials rows={form.socials} onChange={(rows) => setForm((prev) => ({ ...prev, socials: rows }))} />
              {kind === "crm" ? <Field label="Job title" value={form.jobTitle} onChange={set("jobTitle")} /> : null}
              {kind === "crm" ? <Field label="Source" value={form.source} onChange={set("source")} /> : null}
              {kind === "crm" ? <Field label="Tag" value={form.tag} onChange={set("tag")} /> : null}
              {kind === "crm" ? <Field label="Stage" value={form.stage} onChange={set("stage")} /> : null}
              {kind === "crm" ? <Field label="Deal" value={form.deal} onChange={(value) => set("deal")(value.replace(/[^0-9.]/g, ""))} /> : null}
              <Field label="Notes" value={form.note} onChange={set("note")} area />
              <div className="flex gap-2">
                <button type="submit" className="bg-blue">Save</button>
                <button type="button" className="quiet" onClick={() => setMode("view")}>Cancel</button>
              </div>
            </form>
          ) : open ? (
            <div>
              <header className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {open.avatar ? <img src={open.avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-lg">{(open.name || "?").slice(0, 1)}</div>}
                  <div>
                    <h2 className="text-xl">{open.name}</h2>
                    <p className="text-sm text-white/50">{[kind === "personal" ? open.tag : "", open.jobTitle, open.company].filter(Boolean).join(" · ") || (kind === "crm" ? "CRM" : "Personal")}</p>
                    <p className="mt-1 text-sm text-blue-2">{open.phones.filter((item) => /\d/.test(item)).map((item) => fmtPhone(item)).join(" · ") || "No phone"}</p>
                    <p className="text-sm text-blue-2">{open.emails.filter((item) => item.includes("@")).join(" · ") || "No email"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="quiet" onClick={() => { setForm({ firstName: open.firstName, lastName: open.lastName, name: open.name, company: open.company, email: open.email, phone: open.phone, city: open.city, avatar: open.avatar, stage: open.stage, deal: open.deal, note: open.note, birthday: open.birthday, address: open.address, state: open.state, zip: open.zip, emails: open.emails.length ? open.emails : [""], phones: open.phones.length ? open.phones : [""], websites: open.websites, socials: open.socials, jobTitle: open.jobTitle, source: open.source, tag: open.tag }); setMode("edit"); }}>Edit</button>
                  <button type="button" className="quiet" onClick={() => { update((prev) => ({ ...prev, contacts: prev.contacts.map((item) => item.id === open.id ? { ...item, kind: kind === "crm" ? "personal" : "crm" } : item) })); setSelected(null); }}>{kind === "crm" ? "Make personal" : "Make CRM"}</button>
                  <button type="button" className="link-remove" onClick={() => { book.remove(open.id); setSelected(null); }}>Delete</button>
                </div>
              </header>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 p-4 text-sm">
                  <p className="mb-2 text-[10px] tracking-widest text-blue-2">CONTACT</p>
                  <p>{[open.address, open.city, open.state, open.zip].filter(Boolean).join(", ") || "No address"}</p>
                  <p className="mt-2 text-white/60">{open.birthday ? `Birthday ${open.birthday}` : "No birthday"}</p>
                  {open.websites.filter(Boolean).map((site) => <p key={site} className="mt-2 truncate text-blue-2">{site}</p>)}
                  {open.socials.filter(Boolean).map((row) => {
                    const social = splitSocial(row);
                    return <p key={row} className="mt-1 text-white/75">{social.platform}: {social.handle}</p>;
                  })}
                </div>
                {kind === "crm" ? (
                  <div className="rounded-xl border border-white/10 p-4 text-sm">
                    <p className="mb-2 text-[10px] tracking-widest text-blue-2">DEAL</p>
                    <p>{open.stage || "New"}{open.deal ? ` · ${fmtMoney(Number(open.deal) || 0)}` : ""}</p>
                    <p className="mt-2 text-white/60">{[open.source, open.tag].filter(Boolean).join(" · ") || "No source"}</p>
                    <p className="mt-3 whitespace-pre-wrap text-white/75">{open.note || "No notes."}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 p-4 text-sm">
                    <p className="mb-2 text-[10px] tracking-widest text-blue-2">NOTES</p>
                    <p className="whitespace-pre-wrap text-white/75">{open.note || "No notes."}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-4">
                {open.phone ? <a className="text-sm text-blue-2" href={`tel:${open.phone.replace(/\D/g, "")}`}>Call</a> : null}
                {open.phone ? <a className="text-sm text-blue-2" href={`sms:${open.phone.replace(/\D/g, "")}`}>Text</a> : null}
                {open.email ? <a className="text-sm text-blue-2" href={`mailto:${open.email}`}>Email</a> : null}
              </div>
            </div>
          ) : (
            <p className="grid h-full place-items-center text-sm tracking-widest text-white/30">{kind === "crm" ? "SELECT A LEAD OR CLICK NEW LEAD" : "SELECT A CONTACT OR CLICK NEW CONTACT"}</p>
          )}
        </section>
      </div>
    </div>
  );
}

const TOOLS = ["SEO Tools", "Site Audit", "Rank Tracking", "Keyword Tool", "Competitor Analysis", "Marketing Automation", "Content Creation", "Customer Intelligence", "Digital Assets", "AI Lead Generator", "Lead Tracker", "Business Listings"];
const SIMS = ["Alternate Life", "Dream Forge", "Echo Persona", "Fantasy Friend", "Narrative Conflict", "Shadow Budget", "Life RPG", "Compliment Cannon", "Smart Browser", "Life Audit"];
const SERVICES = ["NVIDIA", "ElevenLabs", "Stripe", "Luma", "Nylas", "YouTube", "OpenAI", "Anthropic", "xAI", "Telegram", "Google Maps", "Supabase", "SendGrid", "Brevo", "Spotify", "Replicate", "Facebook App ID"];
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "X", "LinkedIn", "YouTube"];
const JOURNAL_TEMPLATES = ["Morning pages", "Win and miss", "Decision log"];
function band(score: number) {
  if (score >= 800) return "Great";
  if (score >= 740) return "Good";
  if (score >= 670) return "Fair";
  return "Poor";
}

function roi(cost: number, revenue: number) {
  if (!cost) return revenue > 0 ? "—" : "0%";
  return `${Math.round(((revenue - cost) / cost) * 100)}%`;
}

const GLOW = ["rgba(176, 107, 255, 0.45)", "rgba(45, 212, 191, 0.42)", "rgba(52, 211, 153, 0.4)", "rgba(176, 107, 255, 0.28)"];
const CREDIT_LEVELS = [
  { label: "Poor", color: "#f43f5e", min: 300, max: 579 },
  { label: "Fair", color: "#fb923c", min: 580, max: 669 },
  { label: "Good", color: "#2dd4bf", min: 670, max: 739 },
  { label: "Great", color: "#34d399", min: 740, max: 850 },
];

function Bars({ rows }: { rows: { name: string; value: number }[] }) {
  if (!rows.length) return <p className="text-sm text-muted">Nothing to chart yet.</p>;
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

function Trend({ rows }: { rows: { name: string; value: number }[] }) {
  if (!rows.length) return null;
  return (
    <div className="chart-glow h-28 min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
          <Area type="monotone" dataKey="value" stroke="rgba(176, 107, 255, 0.7)" fill="rgba(176, 107, 255, 0.16)">
            <LabelList dataKey="value" position="top" fill="#f7f7f7" fontSize={11} />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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
  const [openVault, setOpenVault] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ provider: string; name: string; email: string }[]>([]);
  const [oauthNote, setOauthNote] = useState("");
  useEffect(() => {
    void import("@/lib/lifeos/oauth").then(async ({ finishOAuth, readOauth, allowedEmail, catchReturn, pullWorkerLinks }) => {
      const session = await finishOAuth().catch(() => null);
      const back = catchReturn();
      if (session?.provider === "google" && !session.token && !session.via) {
        setOauthNote(allowedEmail(session.email || "") ? "Google did not return a token. Connect that mailbox again." : `${session.email || "That mailbox"} is not one of the three board emails.`);
      } else if (back.error) setOauthNote(back.error);
      else if (back.provider) setOauthNote(`${back.provider} is connected.`);
      await pullWorkerLinks().catch(() => undefined);
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

  if (slug === "calendar") return <CalendarDesk data={data} update={update} />;

  if (slug === "crm") return <Contacts kind="crm" data={data} update={update} />;
  if (slug === "contacts") return <Contacts kind="personal" data={data} update={update} />;
  if (slug === "omnisearch") return <SearchDesk data={data} update={update} />;

  if (slug === "social") return <SocialDesk data={data} update={update} />;

  if (slug === "marketing") return <MarketingDesk data={data} update={update} />;

  if (slug === "analytics") return <AnalyticsDesk data={data} update={update} />;

  if (slug === "leads") return <LeadsDesk data={data} update={update} />;

  if (slug === "creator") return <CreatorDesk data={data} update={update} />;

  if (slug === "music-einstein") return <EinsteinDesk data={data} update={update} />;

  if (slug === "lucid") return <LucidDesk data={data} update={update} />;

  if (slug === "music") return <MusicDesk data={data} update={update} />;
  if (slug === "media") return <MediaDesk data={data} update={update} />;

  if (slug === "finance") return <FinanceDesk data={data} update={update} />;

  if (slug === "office") return <OfficeDesk data={data} update={update} />;
  if (slug === "projects") return <ProjectsDesk data={data} update={update} />;
  if (slug === "maps") return <MapsDesk data={data} update={update} />;
  if (slug === "journal") return <JournalDesk data={data} update={update} />;

  if (slug === "simulators") return <SimDesk data={data} update={update} />;
  if (slug === "vault") return <VaultDesk data={data} update={update} />;

  if (slug === "ai-hub") return <HubDesk data={data} update={update} />;

  if (slug === "integrations") return <IntegrationsDesk data={data} update={update} accounts={accounts} setAccounts={setAccounts} note={oauthNote} setNote={setOauthNote} />;

  if (slug === "settings") return <SettingsDesk data={data} update={update} />;

  return null;
}
