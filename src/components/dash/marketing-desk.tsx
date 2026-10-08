import { useMemo, useState, type ReactNode } from "react";
import { EngineBar } from "./engine-bar";
import { Area, AreaChart, LabelList, ResponsiveContainer } from "recharts";
import { newId, type Memory } from "./memory";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Tool = "Overview" | "SEO Tools" | "Site Audit" | "Rank Tracking" | "Keyword Tool" | "Competitor Analysis" | "Marketing Automation" | "Content Creation" | "Customer Intelligence" | "Digital Assets" | "AI Lead Generator" | "Lead Tracker" | "Business Listings";
const STATUSES = ["New", "Warm", "Contacted", "Won", "Lost"];
const PLATFORMS = ["Google", "Yelp", "BBB", "Facebook", "Apple Maps", "Bing"];
const TABS: { id: Tool; label: string }[] = [
  { id: "SEO Tools", label: "SEO" },
  { id: "Content Creation", label: "CONTENT" },
  { id: "AI Lead Generator", label: "LEAD GEN" },
  { id: "Keyword Tool", label: "KEYWORDS" },
  { id: "Business Listings", label: "LISTINGS" },
  { id: "Marketing Automation", label: "CAMPAIGNS" },
  { id: "Lead Tracker", label: "CRM" },
  { id: "Customer Intelligence", label: "PEOPLE" },
];

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="module-card">
      <div className="border-b border-white/10 px-4 py-3"><h2 className="module-title">{title}</h2></div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="module-card p-3">
      <p className="text-[10px] tracking-widest text-white/40">{label}</p>
      <p className="mt-1 text-2xl">{value}</p>
    </div>
  );
}

function Chart({ points }: { points: number[] }) {
  const rows = points.map((value, index) => ({ name: String(index + 1), value }));
  if (!rows.length) return null;
  return (
    <div className="chart-glow h-28">
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

function saveNote(update: Update, title: string, body: string) {
  update((prev) => ({ ...prev, notes: [{ id: prev.notes.find((row) => row.title === title)?.id || newId(), title, body }, ...prev.notes.filter((row) => row.title !== title)] }));
}

export function MarketingDesk({ data, update }: { data: Memory; update: Update }) {
  const [tool, setTool] = useState<Tool>("SEO Tools");
  const [note, setNote] = useState("");
  const [seoTitle, setSeoTitle] = useState(data.notes.find((row) => row.title === "SEO · page")?.body.split("\n")[0] || "");
  const [seoMeta, setSeoMeta] = useState(data.notes.find((row) => row.title === "SEO · page")?.body.split("\n").slice(1).join("\n") || "");
  const [url, setUrl] = useState("https://");
  const [audit, setAudit] = useState("");
  const [keyword, setKeyword] = useState("");
  const [copy, setCopy] = useState("");
  const [rankName, setRankName] = useState("");
  const [rankValue, setRankValue] = useState("");
  const [rival, setRival] = useState("https://");
  const [rivalReport, setRivalReport] = useState("");
  const [autoName, setAutoName] = useState("");
  const [autoStep, setAutoStep] = useState("");
  const [brief, setBrief] = useState("");
  const [channel, setChannel] = useState("Post");
  const [draft, setDraft] = useState("");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("Atlanta");
  const [assetUrl, setAssetUrl] = useState("");
  const [listName, setListName] = useState("");
  const [listPlatform, setListPlatform] = useState(PLATFORMS[0]);
  const [listUrl, setListUrl] = useState("https://");
  const [listStatus, setListStatus] = useState("Pending");

  const audits = data.notes.filter((row) => row.title.startsWith("Audit · "));
  const rivals = data.notes.filter((row) => row.title.startsWith("Competitor · "));
  const posts = data.notes.filter((row) => row.title.startsWith("Content · "));
  const autos = data.tasks.filter((row) => row.title.startsWith("Auto · "));
  const generated = data.leads.filter((row) => row.source === "AI Lead Generator");
  const listings = data.links.filter((row) => row.label.startsWith("Listing · "));
  const ranks = data.marketing.filter((row) => row.label !== "Site visits" && row.label !== "Leads");
  const byStatus = STATUSES.map((status) => ({ name: status, value: data.leads.filter((row) => row.status === status).length }));
  const sources = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data.leads) map.set(row.source || "Unknown", (map.get(row.source || "Unknown") || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.leads]);

  async function runAudit(target: string) {
    if (!/^https?:\/\//i.test(target)) { setNote("Use a full http URL."); return ""; }
    setNote("Checking the page…");
    const { inspectSite } = await import("@/lib/lifeos/sync");
    const report = await inspectSite({ data: target });
    const checks = [
      `Status ${report.status}`,
      `Title ${report.title.length}/60: ${report.title || "missing"}`,
      `Description ${report.description.length}/160: ${report.description || "missing"}`,
      `H1 count: ${report.h1}`,
      report.title.length >= 50 && report.title.length <= 60 ? "Title length is in range." : "Title should be 50–60 characters.",
      report.description.length >= 120 && report.description.length <= 160 ? "Description length is in range." : "Description should be 120–160 characters.",
      report.h1 === 1 ? "One H1." : "Use a single H1.",
    ];
    const passed = checks.filter((line) => /in range|One H1|Status 200/.test(line)).length;
    const lines = [`Score ${passed}/4`, ...checks].join("\n");
    setAudit(lines);
    saveNote(update, `Audit · ${target}`, lines);
    setNote("Audit saved.");
    return lines;
  }

  function keywordReport() {
    const word = keyword.trim().toLowerCase();
    const words = copy.trim() ? copy.trim().split(/\s+/) : [];
    const hits = word ? copy.toLowerCase().split(word).length - 1 : 0;
    const stop = new Set(["the", "and", "for", "with", "that", "this", "from", "your", "you", "are", "was"]);
    const counts = new Map<string, number>();
    for (const part of words) {
      const clean = part.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean.length < 4 || stop.has(clean) || clean === word) continue;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    }
    const related = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => `${name} (${count})`);
    const density = words.length ? ((hits / words.length) * 100).toFixed(1) : "0";
    const lines = [`${word || "keyword"} appears ${hits} times in ${words.length} words (${density}%).`, related.length ? `Nearby words: ${related.join(", ")}` : "No nearby words yet."].join("\n");
    setNote(lines);
    if (word) saveNote(update, `Keyword · ${word}`, `${lines}\n\n${copy}`);
  }

  return (
    <div className="grid gap-4">
      <EngineBar panel="Marketing" data={data} update={update} />
      <div className="flex gap-4 overflow-x-auto">
        {TABS.map((item) => (
          <button key={item.id} type="button" className={`quiet ${tool === item.id ? "is-on" : ""}`} onClick={() => { setTool(item.id); setNote(""); }}>{item.label}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Leads" value={data.leads.length} />
        <Stat label="Open follow-ups" value={autos.filter((row) => !row.done).length} />
        <Stat label="Listings" value={listings.length} />
        <Stat label="Assets" value={data.media.length} />
      </div>
      {note ? <p className="whitespace-pre-wrap text-sm text-white/60">{note}</p> : null}
      <div className="grid gap-4">

        {tool === "SEO Tools" ? (
          <Box title="Title and description">
            <label className="block text-[11px] text-white/50">Title ({seoTitle.length}/60)<input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} /></label>
            <label className="mt-2 block text-[11px] text-white/50">Meta description ({seoMeta.length}/160)<textarea className="mt-1 min-h-24 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={seoMeta} onChange={(event) => setSeoMeta(event.target.value)} /></label>
            <p className="mt-2 text-sm text-white/50">{seoTitle.length >= 50 && seoTitle.length <= 60 ? "Title length is in range." : "Title should be 50–60 characters."} {seoMeta.length >= 120 && seoMeta.length <= 160 ? "Description length is in range." : "Description should be 120–160 characters."}</p>
            <div className="mt-3 flex items-center gap-4">
              <button type="button" className="bg-blue" onClick={() => { saveNote(update, "SEO · page", `${seoTitle}\n${seoMeta}`); setNote("SEO draft saved."); }}>Save</button>
              <button type="button" className="link-add" onClick={() => {
                setNote("Writing…");
                void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: `Write one SEO title under 60 characters and one meta description under 160 characters for ${seoTitle || "CEO GPS"}. No invented numbers.`, facts: seoMeta } })).then((result) => setNote(result.text || "No draft came back."));
              }}>Draft</button>
            </div>
          </Box>
        ) : null}

        {tool === "Site Audit" || tool === "SEO Tools" ? (
          <Box title="Page audit">
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void runAudit(url).catch((error: unknown) => setNote(error instanceof Error ? error.message : "The page did not load.")); }}>
              <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={url} onChange={(event) => setUrl(event.target.value)} />
              <button type="submit" className="bg-blue">Audit</button>
            </form>
            {audit ? <pre className="mt-3 whitespace-pre-wrap text-sm">{audit}</pre> : null}
            <div className="mt-3">{audits.map((row) => <button key={row.id} type="button" className="menu" onClick={() => setAudit(row.body)}>{row.title.replace("Audit · ", "")}</button>)}</div>
          </Box>
        ) : null}

        {tool === "Rank Tracking" || tool === "SEO Tools" ? (
          <Box title="Keyword positions">
            <form className="flex flex-wrap gap-2" onSubmit={(event) => {
              event.preventDefault();
              const point = Number(rankValue);
              const label = rankName.trim();
              if (!label || !Number.isFinite(point)) return;
              update((prev) => {
                const existing = prev.marketing.find((row) => row.label === label);
                const points = existing ? [...existing.points, point].slice(-12) : [point];
                const row = existing ? { ...existing, points } : { id: newId(), label, points };
                return { ...prev, marketing: [row, ...prev.marketing.filter((item) => item.label !== label)] };
              });
              setRankValue("");
              setNote(`Logged ${label} at ${point}.`);
            }}>
              <input className="h-8 w-48 rounded-full border border-line bg-black/40 px-3 text-sm" value={rankName} placeholder="Keyword" onChange={(event) => setRankName(event.target.value)} />
              <input className="h-8 w-28 rounded-full border border-line bg-black/40 px-3 text-sm" value={rankValue} placeholder="Position" onChange={(event) => setRankValue(event.target.value)} />
              <button type="submit" className="bg-blue">Log</button>
            </form>
            <div className="mt-4 grid gap-3">{ranks.map((row) => <div key={row.id}><p className="text-sm">{row.label} · latest {row.points.at(-1)}</p><Chart points={row.points} /></div>)}</div>
          </Box>
        ) : null}

        {tool === "Keyword Tool" ? (
          <Box title="Keyword check">
            <input className="h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={keyword} placeholder="Keyword" onChange={(event) => setKeyword(event.target.value)} />
            <textarea className="mt-2 min-h-28 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={copy} placeholder="Paste the page copy" onChange={(event) => setCopy(event.target.value)} />
            <button type="button" className="bg-blue mt-2" onClick={keywordReport}>Check</button>
          </Box>
        ) : null}

        {tool === "Competitor Analysis" || tool === "Keyword Tool" ? (
          <Box title="Competitor page">
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void runAudit(rival).then((lines) => { if (!lines) return; saveNote(update, `Competitor · ${rival}`, lines); setRivalReport(lines); }).catch((error: unknown) => setNote(error instanceof Error ? error.message : "The page did not load.")); }}>
              <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={rival} onChange={(event) => setRival(event.target.value)} />
              <button type="submit" className="bg-blue">Compare</button>
            </form>
            {rivalReport ? <pre className="mt-3 whitespace-pre-wrap text-sm">{rivalReport}</pre> : null}
            <div className="mt-3">{rivals.map((row) => <p key={row.id} className="truncate text-sm text-white/70">{row.title.replace("Competitor · ", "")}</p>)}</div>
          </Box>
        ) : null}

        {tool === "Marketing Automation" ? (
          <Box title="Follow-up steps">
            <form className="flex flex-wrap gap-2" onSubmit={(event) => {
              event.preventDefault();
              if (!autoStep.trim()) return;
              const title = `Auto · ${autoName.trim() || "Campaign"}: ${autoStep.trim()}`;
              update((prev) => ({ ...prev, tasks: [{ id: newId(), title, done: false }, ...prev.tasks], notifs: [{ id: newId(), text: title, source: "Marketing", seen: false }, ...prev.notifs] }));
              setAutoStep("");
              setNote("Step added to tasks and notifications.");
            }}>
              <input className="h-8 w-40 rounded-full border border-line bg-black/40 px-3 text-sm" value={autoName} placeholder="Campaign" onChange={(event) => setAutoName(event.target.value)} />
              <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={autoStep} placeholder="Next step" onChange={(event) => setAutoStep(event.target.value)} />
              <button type="submit" className="bg-blue">Add step</button>
            </form>
            <ul className="mt-3">{autos.map((row) => <li key={row.id} className="flex items-center justify-between gap-2 py-1 text-sm"><span className={row.done ? "text-white/40" : ""}>{row.title.replace("Auto · ", "")}</span><button type="button" className="link-add" onClick={() => update((prev) => ({ ...prev, tasks: prev.tasks.map((item) => item.id === row.id ? { ...item, done: !item.done } : item) }))}>{row.done ? "Reopen" : "Done"}</button></li>)}</ul>
          </Box>
        ) : null}

        {tool === "Content Creation" ? (
          <Box title="Write">
            <div className="mb-2 flex gap-4">{["Post", "Email", "Ad", "Blog"].map((item) => <button key={item} type="button" className={`quiet ${channel === item ? "is-on" : ""}`} onClick={() => setChannel(item)}>{item}</button>)}</div>
            <textarea className="min-h-24 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={brief} placeholder="What should it say?" onChange={(event) => setBrief(event.target.value)} />
            <div className="mt-2 flex items-center gap-4">
              <button type="button" className="bg-blue" onClick={() => {
                setNote("Writing…");
                void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: `Write a short ${channel.toLowerCase()} about ${brief || "CEO GPS"}. No invented numbers or testimonials.`, facts: "" } })).then((result) => { setDraft(result.text || ""); setNote(result.text ? "" : "No draft came back."); });
              }}>Write</button>
              <button type="button" className="link-add" onClick={() => { if (!draft.trim()) return; saveNote(update, `Content · ${channel} · ${brief.slice(0, 40) || "draft"}`, draft); setNote("Draft saved."); }}>Save</button>
            </div>
            {draft ? <pre className="mt-3 whitespace-pre-wrap text-sm">{draft}</pre> : null}
            <div className="mt-3">{posts.map((row) => <button key={row.id} type="button" className="menu" onClick={() => setDraft(row.body)}>{row.title.replace("Content · ", "")}</button>)}</div>
          </Box>
        ) : null}

        {tool === "Customer Intelligence" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <Box title="On the board">
              <p className="text-sm">{data.contacts.length} contacts</p>
              <p className="text-sm">{data.leads.length} leads</p>
              <p className="text-sm">{data.mail.length} emails</p>
              <p className="text-sm">{data.contacts.filter((row) => row.kind === "crm").length} CRM contacts</p>
            </Box>
            <Box title="Lead sources">{sources.map(([name, count]) => <p key={name} className="flex justify-between text-sm"><span>{name}</span><span>{count}</span></p>)}</Box>
          </div>
        ) : null}

        {tool === "Digital Assets" || tool === "Content Creation" ? (
          <Box title="Files from Media">
            <form className="mb-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (!/^https?:\/\//i.test(assetUrl)) return; update((prev) => ({ ...prev, media: [{ id: newId(), title: `Image · ${assetUrl.split("/").pop() || "asset"}`, body: assetUrl, at: new Date().toISOString() }, ...prev.media] })); setAssetUrl(""); }}>
              <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={assetUrl} placeholder="Asset URL" onChange={(event) => setAssetUrl(event.target.value)} />
              <button type="submit" className="bg-blue">Add</button>
            </form>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {data.media.slice(0, 24).map((row) => <div key={row.id} className="rounded-xl border border-white/10 p-2 text-sm">{/^https?:|^data:image/i.test(row.body) && !/youtu|\.mp4/i.test(row.body) ? <img src={row.body} alt="" className="mb-1 h-20 w-full rounded-lg object-cover" /> : null}<p className="truncate">{row.title}</p></div>)}
            </div>
          </Box>
        ) : null}

        {tool === "AI Lead Generator" ? (
          <Box title="Leads for a client offer">
            <form className="flex flex-wrap gap-2" onSubmit={(event) => {
              event.preventDefault();
              setNote("Looking for lead titles…");
              void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: `List 5 short business lead titles for ${niche || "local services"} in ${city}. One per line. No phone numbers, no emails, no fake company claims.`, facts: "" } })).then((result) => {
                const names = result.text.split("\n").map((line) => line.replace(/^\d+[\).\s-]+/, "").trim()).filter((line) => line.length > 2).slice(0, 5);
                if (!names.length) { setNote(result.text || "No leads came back."); return; }
                update((prev) => ({ ...prev, leads: [...names.map((name) => ({ id: newId(), name, source: "AI Lead Generator", status: "New" })), ...prev.leads] }));
                setNote(`Added ${names.length} leads.`);
              });
            }}>
              <input className="h-8 w-48 rounded-full border border-line bg-black/40 px-3 text-sm" value={niche} placeholder="Offer or niche" onChange={(event) => setNiche(event.target.value)} />
              <input className="h-8 w-36 rounded-full border border-line bg-black/40 px-3 text-sm" value={city} placeholder="City" onChange={(event) => setCity(event.target.value)} />
              <button type="submit" className="bg-blue">Generate</button>
            </form>
            <ul className="mt-3">{generated.map((row) => <li key={row.id} className="text-sm">{row.name} <span className="text-white/40">{row.status}</span></li>)}</ul>
          </Box>
        ) : null}

        {tool === "Lead Tracker" ? (
          <Box title="Pipeline">
            <div className="mb-3 flex flex-wrap gap-4 text-sm text-white/60">{byStatus.map((row) => <span key={row.name}>{row.name} {row.value}</span>)}</div>
            <ul>{data.leads.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2 text-sm">
                <span>{row.name}<span className="block text-[11px] text-white/40">{row.source}</span></span>
                <span className="flex flex-wrap gap-3">{STATUSES.map((status) => <button key={status} type="button" className={`quiet ${row.status === status ? "is-on" : ""}`} onClick={() => update((prev) => ({ ...prev, leads: prev.leads.map((item) => item.id === row.id ? { ...item, status } : item) }))}>{status}</button>)}</span>
              </li>
            ))}</ul>
          </Box>
        ) : null}

        {tool === "Business Listings" ? (
          <Box title="Where the business is listed">
            <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              if (!listName.trim() || !/^https?:\/\//i.test(listUrl)) return;
              update((prev) => ({ ...prev, links: [{ id: newId(), label: `Listing · ${listPlatform} · ${listStatus} · ${listName.trim()}`, href: listUrl.trim() }, ...prev.links] }));
              setListName("");
              setNote("Listing saved.");
            }}>
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={listName} placeholder="Business name" onChange={(event) => setListName(event.target.value)} />
              <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={listPlatform} onChange={(event) => setListPlatform(event.target.value)}>{PLATFORMS.map((item) => <option key={item}>{item}</option>)}</select>
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={listUrl} onChange={(event) => setListUrl(event.target.value)} />
              <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={listStatus} onChange={(event) => setListStatus(event.target.value)}>{["Pending", "Listed", "Needs update"].map((item) => <option key={item}>{item}</option>)}</select>
              <button type="submit" className="bg-blue">Save listing</button>
            </form>
            <ul className="mt-3">{listings.map((row) => {
              const [, platform, status, ...name] = row.label.split(" · ");
              return <li key={row.id} className="flex items-center justify-between gap-2 py-1 text-sm"><a className="truncate text-blue-2" href={row.href} target="_blank" rel="noreferrer">{name.join(" · ")} · {platform}</a><span className="text-white/40">{status}</span></li>;
            })}</ul>
          </Box>
        ) : null}
      </div>
    </div>
  );
}
