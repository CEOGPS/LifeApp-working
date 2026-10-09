import { useEffect, useMemo, useRef, useState } from "react";
import { newId, type EmailCampaign, type EmailDomain, type MailFolder, type MailItem, type Memory } from "./memory";
import { fmtDate } from "./format";
import { BOARD_EMAILS } from "@/lib/lifeos/oauth";

function plain(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function mailText(value: string) {
  const text = value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "");
  return text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, index) => (
    /^https?:\/\//.test(part)
      ? <a key={index} className="break-all text-orange-300 underline decoration-orange-300/40" href={part} target="_blank" rel="noreferrer">{part.replace(/^https?:\/\//, "")}</a>
      : <span key={index}>{part}</span>
  ));
}

type Update = (recipe: (prev: Memory) => Memory) => void;
type Tab = "Inbox" | "Campaigns" | "Analytics" | "Verification" | "DNS" | "Lists";
type Folder = MailFolder | "starred";

const TABS: Tab[] = ["Inbox", "Campaigns", "Analytics", "Verification", "DNS", "Lists"];
const FOLDERS: { id: Folder; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "starred", label: "Starred" },
  { id: "sent", label: "Sent" },
  { id: "drafts", label: "Drafts" },
  { id: "spam", label: "Spam" },
  { id: "archive", label: "Archive" },
  { id: "trash", label: "Trash" },
];
const field = "h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm";

function addresses(text: string) {
  return text.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

async function txt(name: string) {
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`);
  const data = await response.json();
  const rows = Array.isArray(data.Answer) ? data.Answer : [];
  return rows.map((row: { data?: string }) => String(row.data || "").replaceAll('"', "")).join(" ");
}

async function ask(prompt: string) {
  const { askNyx } = await import("@/lib/lifeos/sync");
  const result = await askNyx({ data: { question: prompt, facts: "Email campaign copy. No invented metrics." } });
  if (result.ok && result.text) return result.text.trim();
  throw new Error("No model reply");
}

export function EmailDesk({ data, update }: { data: Memory; update: Update }) {
  const hub = data.emailHub;
  const [tab, setTab] = useState<Tab>("Inbox");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState(hub.accounts[0]?.id || "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [accountForm, setAccountForm] = useState({ email: "", name: "", provider: "gmail" as const });
  const [campaign, setCampaign] = useState({ name: "", fromName: "", fromEmail: "", subject: "", body: "", listIds: [] as string[], when: "" });
  const [busy, setBusy] = useState("");
  const [domainName, setDomainName] = useState("");
  const [selector, setSelector] = useState("lifeos");
  const [domainId, setDomainId] = useState(hub.domains[0]?.id || "");
  const [listForm, setListForm] = useState({ name: "", description: "", people: "" });
  const [listPick, setListPick] = useState({ city: "", company: "", kind: "any" });
  const [listQuery, setListQuery] = useState("");
  const [compose, setCompose] = useState(false);

  const account = hub.accounts.find((row) => row.id === accountId) || null;
  const rows = useMemo(() => data.mail.filter((row) => {
    const inFolder = folder === "starred" ? row.starred && row.folder !== "trash" : row.folder === folder;
    const q = search.toLowerCase();
    return inFolder && (!q || `${row.title} ${row.body} ${row.to} ${row.from}`.toLowerCase().includes(q));
  }), [data.mail, folder, search]);
  const counts = useMemo(() => {
    const map: Record<Folder, number> = { inbox: 0, starred: 0, sent: 0, drafts: 0, spam: 0, archive: 0, trash: 0 };
    for (const row of data.mail) {
      map[row.folder] += 1;
      if (row.starred && row.folder !== "trash") map.starred += 1;
    }
    return map;
  }, [data.mail]);
  const open = data.mail.find((row) => row.id === openId) || null;
  const domain = hub.domains.find((row) => row.id === domainId) || hub.domains[0] || null;
  const totals = useMemo(() => hub.campaigns.reduce((sum, row) => ({
    sent: sum.sent + row.sent,
    opens: sum.opens + row.opens,
    clicks: sum.clicks + row.clicks,
    bounces: sum.bounces + row.bounces,
  }), { sent: 0, opens: 0, clicks: 0, bounces: 0 }), [hub.campaigns]);

  function saveMail(next: MailFolder) {
    if (!subject.trim() && !body.trim()) return;
    update((prev) => ({
      ...prev,
      mail: [{ id: newId(), title: subject.trim() || "No subject", body: body.trim(), at: new Date().toISOString(), folder: next, to: to.trim(), from: account?.email || "", starred: false }, ...prev.mail],
    }));
    if (next === "sent" && to.trim()) window.location.href = `mailto:${to.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setTo("");
    setSubject("");
    setBody("");
    setFolder(next);
    setOpenId(null);
  }

  function move(id: string, next: MailFolder) {
    update((prev) => ({ ...prev, mail: prev.mail.map((row) => row.id === id ? { ...row, folder: next } : row) }));
    setOpenId(null);
    setFolder(next);
  }

  function reply(row: MailItem, forward = false) {
    setCompose(true);
    setOpenId(null);
    setTo(forward ? "" : (row.from || row.to));
    setSubject(`${forward ? "Fwd" : "Re"}: ${row.title.replace(/^(Re|Fwd):\s*/i, "")}`);
    setBody(`\n\n--- ${forward ? "Forwarded" : "On"} ${fmtDate(row.at)} ---\n${row.body}`);
  }

  async function pullMail() {
    setBusy("pull");
    try {
      const { pullInbox } = await import("@/lib/lifeos/env-keys");
      const { readOauth } = await import("@/lib/lifeos/oauth");
      const googles = readOauth().filter((row) => row.provider === "google" && row.token);
      const key = data.keys.find((row) => row.name === "Nylas" && row.value)?.value || "";
      const result = await pullInbox({ data: { nylasKey: key, googleToken: googles[0]?.token || "", googleTokens: googles.map((row) => row.token) } });
      const incoming = Array.isArray(result.messages) ? result.messages : [];
      update((prev) => {
        const have = new Set(prev.mail.map((row) => row.id));
        const fresh = incoming.filter((row) => !have.has(row.id)).map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          at: row.at,
          folder: row.folder,
          to: row.to,
          from: row.from,
          starred: row.starred,
        }));
        const known = new Set(prev.emailHub.accounts.map((row) => row.email.toLowerCase()));
        const accounts = result.accounts.filter((row) => row.email && !known.has(row.email.toLowerCase())).map((row) => ({
          id: newId(),
          email: row.email,
          name: row.name || row.email,
          provider: row.provider,
        }));
        return {
          ...prev,
          mail: fresh.length ? [...fresh, ...prev.mail] : prev.mail,
          emailHub: accounts.length ? { ...prev.emailHub, accounts: [...accounts, ...prev.emailHub.accounts] } : prev.emailHub,
        };
      });
      setNote(result.text || (incoming.length ? "Mail pulled." : "No mail came back."));
    } catch {
      setNote("Could not pull mail.");
    } finally { setBusy(""); }
  }

  const pulled = useRef(false);
  useEffect(() => {
    const missing = BOARD_EMAILS.filter((email) => !data.emailHub.accounts.some((row) => row.email.toLowerCase() === email));
    if (missing.length) {
      update((prev) => ({
        ...prev,
        emailHub: {
          ...prev.emailHub,
          accounts: [
            ...missing.map((email) => ({ id: newId(), email, name: email.split("@")[0], provider: "gmail" as const })),
            ...prev.emailHub.accounts.filter((row) => !missing.includes(row.email.toLowerCase() as (typeof BOARD_EMAILS)[number])),
          ],
        },
      }));
    }
    if (pulled.current) return;
    pulled.current = true;
    void pullMail();
  }, []);

  function setHub(recipe: (prev: Memory["emailHub"]) => Memory["emailHub"]) {
    update((prev) => ({ ...prev, emailHub: recipe(prev.emailHub) }));
  }

  async function writeSubject() {
    if (!campaign.name.trim()) { setNote("Name the campaign first."); return; }
    setBusy("subject");
    try {
      const text = await ask(`Write one email subject under 60 characters for this campaign: ${campaign.name}. Return only the subject.`);
      setCampaign((prev) => ({ ...prev, subject: text.replace(/^"|"$/g, "").split("\n")[0].slice(0, 80) }));
      setNote("Subject written.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Subject was not written.");
    } finally { setBusy(""); }
  }

  async function writeBody() {
    if (!campaign.subject.trim()) { setNote("Add a subject first."); return; }
    setBusy("body");
    try {
      const text = await ask(`Write a marketing email under 160 words. No markdown. End with one call to action. Campaign: ${campaign.name}. Subject: ${campaign.subject}.`);
      setCampaign((prev) => ({ ...prev, body: text }));
      setNote("Body written.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Body was not written.");
    } finally { setBusy(""); }
  }

  function storeCampaign(status: EmailCampaign["status"]) {
    if (!campaign.name.trim()) { setNote("Campaign name is required."); return; }
    const sent = status === "sent";
    const people = new Set(hub.lists.filter((row) => campaign.listIds.includes(row.id)).flatMap((row) => row.subscribers));
    if (sent && people.size === 0) { setNote("Pick a list with addresses before sending."); return; }
    const row: EmailCampaign = {
      id: newId(),
      name: campaign.name.trim(),
      fromName: campaign.fromName.trim(),
      fromEmail: campaign.fromEmail || account?.email || "",
      subject: campaign.subject.trim(),
      body: campaign.body.trim(),
      listIds: campaign.listIds,
      status,
      scheduledFor: status === "scheduled" ? campaign.when : "",
      sentAt: sent ? new Date().toISOString() : "",
      sent: sent ? people.size : 0,
      opens: 0,
      clicks: 0,
      bounces: 0,
      at: new Date().toISOString(),
    };
    setHub((prev) => ({ ...prev, campaigns: [row, ...prev.campaigns] }));
    if (sent) {
      update((prev) => ({
        ...prev,
        mail: [{ id: newId(), title: row.subject || row.name, body: row.body, at: row.at, folder: "sent", to: `${people.size} on list`, from: row.fromEmail, starred: false }, ...prev.mail],
      }));
    }
    setCampaign({ name: "", fromName: "", fromEmail: campaign.fromEmail, subject: "", body: "", listIds: [], when: "" });
    setNote(status === "draft" ? "Draft saved." : status === "scheduled" ? "Scheduled on this board." : `Marked sent to ${people.size}.`);
  }

  async function check(row: EmailDomain) {
    setBusy(row.id);
    try {
      const [spf, dkim, dmarc] = await Promise.all([
        txt(row.domain),
        txt(`${row.selector}._domainkey.${row.domain}`),
        txt(`_dmarc.${row.domain}`),
      ]);
      setHub((prev) => ({
        ...prev,
        domains: prev.domains.map((item) => item.id === row.id ? { ...item, spf: /v=spf1/i.test(spf), dkim: /v=dkim1/i.test(dkim), dmarc: /v=dmarc1/i.test(dmarc), checkedAt: new Date().toISOString() } : item),
      }));
      setNote("DNS checked against public records.");
    } catch {
      setNote("DNS check did not answer.");
    } finally { setBusy(""); }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text).then(() => setNote("Copied.")).catch(() => setNote("Clipboard blocked."));
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-4">
        {TABS.map((name) => <button key={name} type="button" className={`quiet ${tab === name ? "is-on" : ""}`} onClick={() => { setTab(name); setNote(""); }}>{name}</button>)}
      </div>
      {note ? <p className="text-ember text-xs">{note}</p> : null}

      {tab === "Inbox" ? (
        <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[12rem_24rem_1fr]">
          <section className="module-card h-fit p-3">
            <p className="text-sm">Accounts</p>
            {hub.accounts.map((row) => (
              <button key={row.id} type="button" className={`menu ${accountId === row.id ? "is-on" : ""}`} onClick={() => setAccountId(row.id)}>{row.name}</button>
            ))}
            <form className="mt-3 grid gap-2" onSubmit={(event) => {
              event.preventDefault();
              const email = accountForm.email.trim();
              if (!email.includes("@")) return;
              const row = { id: newId(), email, name: accountForm.name.trim() || email, provider: accountForm.provider };
              setHub((prev) => ({ ...prev, accounts: [row, ...prev.accounts] }));
              setAccountId(row.id);
              setAccountForm({ email: "", name: "", provider: "gmail" });
            }}>
              <input className={field} placeholder="name@mail.com" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} />
              <select className={field} value={accountForm.provider} onChange={(event) => setAccountForm({ ...accountForm, provider: event.target.value as typeof accountForm.provider })}>
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="yahoo">Yahoo</option>
                <option value="imap">IMAP</option>
              </select>
              <button type="submit" className="quiet is-on">Add account</button>
            </form>
            <div className="mt-4">
              {FOLDERS.map((item) => (
                <button key={item.id} type="button" className={`menu ${folder === item.id ? "is-on" : ""}`} onClick={() => { setFolder(item.id); setOpenId(null); setCompose(false); }}>{item.label}<span className="ml-2 text-white/35">{counts[item.id] || ""}</span></button>
              ))}
            </div>
          </section>
          <section className="module-card h-fit p-3">
            <div className="mb-2 flex gap-3">
              <button type="button" className="quiet is-on" onClick={() => { setCompose(true); setOpenId(null); }}>Compose</button>
              <button type="button" className="quiet" disabled={busy === "pull"} onClick={() => void pullMail()}>{busy === "pull" ? "Pulling" : "Pull all three"}</button>
            </div>
            <input className={field} placeholder="Search mail" value={search} onChange={(event) => setSearch(event.target.value)} />
            <ul className="mt-2 max-h-[34rem] overflow-y-auto">
              {rows.map((row, index) => (
                <li key={row.id} className={index % 2 ? "bg-white/[0.04]" : ""}>
                  <button type="button" className={`inbox-row ${openId === row.id ? "is-on" : ""} ${index % 2 ? "is-alt" : ""}`} onClick={() => { setOpenId(row.id); setCompose(false); }}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-white">{row.starred ? "★ " : ""}{row.from || row.to || "Unknown"}</span>
                      <span className="shrink-0 text-[10px] text-white/40">{fmtDate(row.at)}</span>
                    </span>
                    <span className="truncate text-sm text-orange-300">{row.title || "No subject"}</span>
                    <span className="truncate text-xs text-white/40">{plain(row.body).slice(0, 90)}</span>
                  </button>
                </li>
              ))}
              {rows.length === 0 ? <li className="px-1 py-2 text-sm text-white/40">Nothing in {folder}.</li> : null}
            </ul>
          </section>
          <section className="module-card p-4">
            {compose ? (
              <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); saveMail("sent"); setCompose(false); }}>
                <input className={field} placeholder="To" value={to} onChange={(event) => setTo(event.target.value)} />
                <input className={field} placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
                <textarea className="min-h-64 rounded-2xl border border-line bg-black/40 px-3 py-2 text-base" placeholder="Message" value={body} onChange={(event) => setBody(event.target.value)} />
                <div className="flex gap-4">
                  <button type="submit" className="quiet is-on">Send</button>
                  <button type="button" className="quiet" onClick={() => { saveMail("drafts"); setCompose(false); }}>Save draft</button>
                  <button type="button" className="quiet" onClick={() => setCompose(false)}>Close</button>
                </div>
              </form>
            ) : open ? (
              <div>
                <p className="text-xl text-orange-300">{open.title}</p>
                <p className="mt-1 text-sm text-white/50">{open.from || "Local"} → {open.to || "No recipient"} · {fmtDate(open.at)}</p>
                <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-white/85">{mailText(open.body)}</p>
                <div className="mt-4 flex flex-wrap gap-4">
                  <button type="button" className="quiet" onClick={() => reply(open)}>Reply</button>
                  <button type="button" className="quiet" onClick={() => reply(open, true)}>Forward</button>
                  <button type="button" className="quiet" onClick={() => update((prev) => ({ ...prev, mail: prev.mail.map((row) => row.id === open.id ? { ...row, starred: !row.starred } : row) }))}>{open.starred ? "Unstar" : "Star"}</button>
                  <button type="button" className="quiet" onClick={() => move(open.id, "archive")}>Archive</button>
                  <button type="button" className="quiet" onClick={() => move(open.id, "spam")}>Spam</button>
                  <button type="button" className="quiet" onClick={() => move(open.id, "inbox")}>Inbox</button>
                  <button type="button" className="link-remove" onClick={() => move(open.id, "trash")}>Trash</button>
                </div>
              </div>
            ) : <p className="text-base text-white/45">Select a message, or compose one.</p>}
          </section>
        </div>
      ) : null}

      {tab === "Campaigns" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
          <section className="module-card grid gap-2 p-4">
            <input className={field} placeholder="Campaign name" value={campaign.name} onChange={(event) => setCampaign({ ...campaign, name: event.target.value })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="From name" value={campaign.fromName} onChange={(event) => setCampaign({ ...campaign, fromName: event.target.value })} />
              <select className={field} value={campaign.fromEmail} onChange={(event) => setCampaign({ ...campaign, fromEmail: event.target.value })}>
                <option value="">From account</option>
                {hub.accounts.map((row) => <option key={row.id} value={row.email}>{row.email}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input className={field} placeholder="Subject" value={campaign.subject} onChange={(event) => setCampaign({ ...campaign, subject: event.target.value })} />
              <button type="button" className="quiet" disabled={busy === "subject"} onClick={() => void writeSubject()}>Subject</button>
            </div>
            <textarea className="min-h-36 rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" style={{ caretColor: "transparent" }} placeholder="Body" value={campaign.body} onChange={(event) => setCampaign({ ...campaign, body: event.target.value })} />
            <div className="flex flex-wrap gap-4">
              <button type="button" className="quiet" disabled={busy === "body"} onClick={() => void writeBody()}>Write body</button>
              <button type="button" className="quiet" onClick={() => storeCampaign("draft")}>Save draft</button>
              <input className={field + " max-w-48"} type="datetime-local" value={campaign.when} onChange={(event) => setCampaign({ ...campaign, when: event.target.value })} />
              <button type="button" className="quiet" onClick={() => storeCampaign("scheduled")}>Schedule</button>
              <button type="button" className="quiet is-on" onClick={() => storeCampaign("sent")}>Send</button>
            </div>
            <ul className="mt-2">{hub.campaigns.map((row) => <li key={row.id} className="flex justify-between gap-3 py-1 text-sm"><span>{row.name}</span><span className="text-white/45">{row.status}</span></li>)}</ul>
          </section>
          <section className="module-card p-4">
            <p className="module-title mb-2">Lists</p>
            {hub.lists.map((row) => (
              <label key={row.id} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={campaign.listIds.includes(row.id)} onChange={(event) => setCampaign((prev) => ({ ...prev, listIds: event.target.checked ? [...prev.listIds, row.id] : prev.listIds.filter((id) => id !== row.id) }))} />
                {row.name} <span className="text-white/40">{row.subscribers.length}</span>
              </label>
            ))}
            {hub.lists.length === 0 ? <p className="text-sm text-white/40">Make a list in Lists first.</p> : null}
          </section>
        </div>
      ) : null}

      {tab === "Analytics" ? (
        <section className="module-card p-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            {[["Sent", totals.sent], ["Opens", totals.opens], ["Clicks", totals.clicks], ["Bounces", totals.bounces]].map(([label, value]) => (
              <p key={String(label)}><span className="block font-display text-2xl">{value}</span><span className="text-ember text-[10px] tracking-widest">{label}</span></p>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {hub.campaigns.filter((row) => row.status === "sent").map((row) => (
              <div key={row.id} className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_5rem_5rem_5rem]">
                <span>{row.name}</span>
                {(["opens", "clicks", "bounces"] as const).map((key) => (
                  <input key={key} className={field} aria-label={key} value={row[key]} onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value)) return;
                    setHub((prev) => ({ ...prev, campaigns: prev.campaigns.map((item) => item.id === row.id ? { ...item, [key]: value } : item) }));
                  }} />
                ))}
              </div>
            ))}
            {hub.campaigns.every((row) => row.status !== "sent") ? <p className="text-sm text-white/40">Send a campaign and the counts show here. Opens, clicks, and bounces are yours to log.</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "Verification" ? (
        <section className="module-card grid gap-3 p-4">
          <form className="flex flex-wrap gap-2" onSubmit={(event) => {
            event.preventDefault();
            const domain = domainName.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
            if (!domain.includes(".")) { setNote("Enter a real domain."); return; }
            const row = { id: newId(), domain, selector: selector.trim() || "lifeos", policy: "none" as const, spf: false, dkim: false, dmarc: false, checkedAt: "" };
            setHub((prev) => ({ ...prev, domains: [row, ...prev.domains] }));
            setDomainId(row.id);
            setDomainName("");
          }}>
            <input className={field + " max-w-xs"} placeholder="yourdomain.com" value={domainName} onChange={(event) => setDomainName(event.target.value)} />
            <input className={field + " max-w-32"} placeholder="selector" value={selector} onChange={(event) => setSelector(event.target.value)} />
            <button type="submit" className="quiet is-on">Add domain</button>
          </form>
          {hub.domains.map((row) => (
            <div key={row.id} className="border-t border-white/10 pt-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>{row.domain}</span>
                <button type="button" className="quiet" disabled={busy === row.id} onClick={() => void check(row)}>{busy === row.id ? "Checking" : "Check DNS"}</button>
              </div>
              <p className="mt-1 text-xs text-white/50">SPF {row.spf ? "found" : "missing"} · DKIM {row.dkim ? "found" : "missing"} · DMARC {row.dmarc ? "found" : "missing"}{row.checkedAt ? ` · ${new Date(row.checkedAt).toLocaleString()}` : ""}</p>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "DNS" ? (
        <section className="module-card grid gap-3 p-4 text-sm">
          {!domain ? <p className="text-white/40">Add a domain in Verification first.</p> : (
            <>
              <div className="flex flex-wrap gap-4">{hub.domains.map((row) => <button key={row.id} type="button" className={`quiet ${domain.id === row.id ? "is-on" : ""}`} onClick={() => setDomainId(row.id)}>{row.domain}</button>)}</div>
              <p>SPF <button type="button" className="quiet" onClick={() => copy("v=spf1 include:_spf.google.com include:sendgrid.net ~all")}>Copy</button></p>
              <code className="block truncate text-xs text-white/60">v=spf1 include:_spf.google.com include:sendgrid.net ~all</code>
              <p>DKIM name {domain.selector}._domainkey <button type="button" className="quiet" onClick={() => copy(`v=DKIM1; k=rsa; p= <generate this key at your mail host>`)}>Copy</button></p>
              <label className="block text-xs text-white/50">DMARC
                <select className={field + " mt-1"} value={domain.policy} onChange={(event) => setHub((prev) => ({ ...prev, domains: prev.domains.map((row) => row.id === domain.id ? { ...row, policy: event.target.value as EmailDomain["policy"] } : row) }))}>
                  <option value="none">none</option>
                  <option value="quarantine">quarantine</option>
                  <option value="reject">reject</option>
                </select>
              </label>
              <code className="block truncate text-xs text-white/60">v=DMARC1; p={domain.policy}; rua=mailto:dmarc@{domain.domain}</code>
              <p className="text-xs text-white/45">Sending host: mail.{domain.domain}</p>
            </>
          )}
        </section>
      ) : null}

      {tab === "Lists" ? (
        <section className="module-card grid gap-3 p-4">
          <input className={field} placeholder="Search lists" value={listQuery} onChange={(event) => setListQuery(event.target.value)} />
          <form className="grid gap-2" onSubmit={(event) => {
            event.preventDefault();
            if (!listForm.name.trim()) return;
            const own = addresses(listForm.people);
            setHub((prev) => ({ ...prev, lists: [{ id: newId(), name: listForm.name.trim(), description: listForm.description.trim(), subscribers: [...new Set(own)] }, ...prev.lists] }));
            setListForm({ name: "", description: "", people: "" });
            setNote("List saved.");
          }}>
            <input className={field} placeholder="List name" value={listForm.name} onChange={(event) => setListForm({ ...listForm, name: event.target.value })} />
            <input className={field} placeholder="What this list is for" value={listForm.description} onChange={(event) => setListForm({ ...listForm, description: event.target.value })} />
            <textarea className="min-h-20 rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" placeholder="Paste emails, or fill from contacts below." value={listForm.people} onChange={(event) => setListForm({ ...listForm, people: event.target.value })} />
            <div className="flex flex-wrap gap-2">
              <input className={field + " max-w-40"} placeholder="City" value={listPick.city} onChange={(event) => setListPick({ ...listPick, city: event.target.value })} />
              <input className={field + " max-w-40"} placeholder="Company" value={listPick.company} onChange={(event) => setListPick({ ...listPick, company: event.target.value })} />
              {["any", "personal", "crm"].map((kind) => <button key={kind} type="button" className={`quiet ${listPick.kind === kind ? "is-on" : ""}`} onClick={() => setListPick({ ...listPick, kind })}>{kind}</button>)}
              <button type="button" className="quiet" onClick={() => {
                const city = listPick.city.trim().toLowerCase();
                const company = listPick.company.trim().toLowerCase();
                const found = data.contacts.filter((row) => {
                  if (!row.email.includes("@")) return false;
                  if (listPick.kind !== "any" && row.kind !== listPick.kind) return false;
                  if (city && !row.city.toLowerCase().includes(city)) return false;
                  if (company && !`${row.company} ${row.name}`.toLowerCase().includes(company)) return false;
                  return true;
                }).map((row) => row.email.toLowerCase());
                setListForm({ ...listForm, people: [...new Set(found)].join("\n") });
                setNote(found.length ? `${found.length} contacts matched.` : "No contacts matched those filters.");
              }}>Fill from contacts</button>
            </div>
            <button type="submit" className="quiet is-on">Save list</button>
          </form>
          {hub.lists.filter((row) => `${row.name} ${row.description}`.toLowerCase().includes(listQuery.toLowerCase())).map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-3 border-t border-white/10 pt-3 text-sm">
              <div><p>{row.name} <span className="text-white/40">{row.subscribers.length}</span></p><p className="text-xs text-white/45">{row.description}</p></div>
              <div className="flex gap-4">
                <button type="button" className="quiet" onClick={() => {
                  const csv = ["email", ...row.subscribers].join("\n");
                  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  const link = document.createElement("a");
                  link.href = url; link.download = `${row.name}.csv`; link.click();
                  URL.revokeObjectURL(url);
                }}>Export</button>
                <button type="button" className="link-remove" onClick={() => setHub((prev) => ({ ...prev, lists: prev.lists.filter((item) => item.id !== row.id) }))}>Delete</button>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
