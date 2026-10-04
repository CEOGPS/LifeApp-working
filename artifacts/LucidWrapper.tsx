import { useEffect, useState } from "react";

type ToolId = "content" | "email" | "listings" | "social" | "leads" | "assets";
type Tab = "find" | "runs" | "tools" | "accounts" | "log";
type Step = { id: string; label: string; owner: "lucid" | "you"; done: boolean; output: string };
type Idea = { id: string; name: string; summary: string; effort: string; range: string; tools: ToolId[]; account: string; risks: string; steps: Step[] };
type Run = { id: string; name: string; status: "needs accounts" | "running" | "waiting" | "paused" | "stopped" | "done"; steps: Step[]; earned: string; updated: string };
type Account = { id: string; runId: string; runName: string; emailReady: boolean; depositReady: boolean };
type Entry = { id: string; at: string; text: string };
type Store = { tools: ToolId[]; ideas: Idea[]; runs: Run[]; accounts: Account[]; log: Entry[] };

const KEY = "lifeos_lucid_v2";
const TOOLS: { id: ToolId; label: string; does: string }[] = [
  { id: "content", label: "Content", does: "Writes the product, page, or script" },
  { id: "email", label: "Email", does: "Writes mail. It does not send it" },
  { id: "listings", label: "Listings", does: "Writes the shop or profile text" },
  { id: "social", label: "Social", does: "Writes posts. It does not publish them" },
  { id: "leads", label: "Leads", does: "Builds the searches and the reply" },
  { id: "assets", label: "Files", does: "Turns one file into a listing" },
];

function ideaSet(niche: string, hours: string, face: boolean): Idea[] {
  const topic = niche.trim() || "a subject you can explain without research";
  const all: Idea[] = [
    {
      id: "pack",
      name: `A $12 download about ${topic}`,
      summary: "One short checklist or template. Lucid writes it and the shop page. You create the shop and upload the file.",
      effort: "Low. One sitting after the copy is written.",
      range: "Usually slow. A few sales, not a salary.",
      tools: ["content", "listings"],
      account: "New Gumroad or PayPal shop",
      risks: "No shop approval, no sales. Crowded topics sit at zero.",
      steps: [
        { id: "write", label: "Write the file and the sales page", owner: "lucid", done: false, output: `Title: ${topic} — the short checklist\nPrice to test: $12\nBuyer gets a 1–2 page file they can use the same day.\nPage: what is inside, who it is not for, and the file format.\nNo income claim on the page.` },
        { id: "shop", label: "Open the shop and upload the file", owner: "you", done: false, output: "" },
        { id: "live", label: "Mark the product live in the run log", owner: "lucid", done: false, output: "Product page and file are ready. Waiting on the shop you manage." },
      ],
    },
    {
      id: "clips",
      name: `Ten answer clips about ${topic}`,
      summary: "Short scripts for a new channel. No face required. Lucid writes the scripts. You post them on the channel you create.",
      effort: "Low if you record voice only, or use text on screen.",
      range: "Most new channels earn nothing for months.",
      tools: ["content", "social"],
      account: "New YouTube channel",
      risks: "Reused footage and copied scripts get limited. One topic only.",
      steps: [
        { id: "scripts", label: "Write 10 short scripts", owner: "lucid", done: false, output: Array.from({ length: 10 }, (_, i) => `${i + 1}. One question about ${topic}. Answer in under 40 seconds. End with what to do next, not a subscribe pitch.`).join("\n") },
        { id: "channel", label: "Create the channel and post the first three", owner: "you", done: false, output: "" },
      ],
    },
    {
      id: "compare",
      name: `One comparison page for ${topic}`,
      summary: "A single page that compares two or three options you have actually used. Lucid drafts it. You publish it where you can add a link later.",
      effort: "Low. One page, not a blog.",
      range: "Pays only if a program has already approved you and someone buys.",
      tools: ["content"],
      account: "New page on a site you control",
      risks: "Do not review products you have not used. No link, no payout.",
      steps: [
        { id: "draft", label: "Draft the comparison", owner: "lucid", done: false, output: `Page: ${topic}, two or three options\nFor each: what it is for, what it is bad at, what it costs.\nSay which one you would pick and why.\nLeave the link blank until the program approves the account.` },
        { id: "publish", label: "Publish the page", owner: "you", done: false, output: "" },
      ],
    },
    {
      id: "etsy",
      name: `A template pack for ${topic}`,
      summary: "Three simple templates. Lucid writes the titles, tags, and what each file contains. You export them and list them.",
      effort: "Low if the templates are plain documents, not custom art.",
      range: "Often a few dollars a sale, if they sell.",
      tools: ["content", "assets", "listings"],
      account: "New Etsy or Creative Market shop",
      risks: "Do not list files you do not own. New shops can take days to clear.",
      steps: [
        { id: "copy", label: "Write three listings", owner: "lucid", done: false, output: `1. ${topic} checklist — 1 page\n2. ${topic} tracker — a blank sheet with the columns named\n3. ${topic} first-week plan — seven boxes, one task each\nTags: the topic, template, printable or doc.\nSay the format and that the buyer edits it.` },
        { id: "list", label: "Open the shop and publish the three files", owner: "you", done: false, output: "" },
      ],
    },
    {
      id: "replies",
      name: `Answer people already asking about ${topic}`,
      summary: "Lucid writes the searches and a short reply. You post it only where someone asked. This is not an ad account.",
      effort: "Low. A few replies, not a content calendar.",
      range: "One paid job if the reply is specific. Most threads pay nothing.",
      tools: ["leads", "social"],
      account: "The profile you post from",
      risks: "Copied ads get removed. Reply only to a real request.",
      steps: [
        { id: "pack", label: "Write the searches and the reply", owner: "lucid", done: false, output: `Search: "looking for" ${topic}\nSearch: "anyone know" ${topic}\nSearch: recommend OR hire ${topic}\n\nReply: I can help with ${topic}. Tell me the deadline and what done looks like. I will answer with a price before any work.` },
        { id: "post", label: "Send that reply on a thread that asked", owner: "you", done: false, output: "" },
      ],
    },
  ];
  return all.filter((idea) => {
    if (!face && idea.id === "clips") return hours !== "1";
    if (hours === "1") return idea.id === "pack" || idea.id === "replies" || idea.id === "compare";
    return true;
  });
}

const empty = (): Store => ({ tools: [], ideas: [], runs: [], accounts: [], log: [] });
function load(): Store {
  try { return { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) || "null") || {}) }; }
  catch { return empty(); }
}

const input = "rounded border border-sky-500/30 bg-black px-3 py-2 text-sm text-white";
const btn = "rounded bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-40";

export default function LucidWrapper() {
  const [tab, setTab] = useState<Tab>("find");
  const [store, setStore] = useState<Store>(load);
  const [draft, setDraft] = useState<Record<string, string>>({ hours: "3" });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(store)); }, [store]);

  useEffect(() => {
    const run = store.runs.find((item) => item.status === "running");
    if (!run) return;
    const step = run.steps.find((item) => !item.done && item.owner === "lucid");
    const timer = window.setTimeout(() => {
      setStore((current) => ({
        ...current,
        runs: current.runs.map((item) => {
          if (item.id !== run.id || item.status !== "running") return item;
          if (!step) {
            const waiting = item.steps.some((row) => !row.done && row.owner === "you");
            return { ...item, status: waiting ? "waiting" : "done", updated: new Date().toISOString() };
          }
          const steps = item.steps.map((row) => row.id === step.id ? { ...row, done: true } : row);
          const lucidLeft = steps.some((row) => !row.done && row.owner === "lucid");
          const youLeft = steps.some((row) => !row.done && row.owner === "you");
          return { ...item, steps, status: !lucidLeft && youLeft ? "waiting" : "running", updated: new Date().toISOString() };
        }),
        accounts: current.accounts,
        log: [{ id: crypto.randomUUID(), at: new Date().toISOString(), text: step ? `Lucid finished “${step.label}” for ${run.name}` : `${run.name} is waiting on you` }, ...current.log].slice(0, 80),
      }));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [store.runs]);

  const set = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const missing = (tools: ToolId[]) => tools.filter((tool) => !store.tools.includes(tool));
  const logged = store.runs.reduce((sum, run) => sum + (Number(run.earned) || 0), 0);

  function find() {
    const ideas = ideaSet(draft.niche || "", draft.hours || "3", draft.face === "yes").map((idea) => ({ ...idea, id: crypto.randomUUID(), steps: idea.steps.map((step) => ({ ...step })) }));
    setStore((current) => ({
      ...current,
      ideas,
      log: [{ id: crypto.randomUUID(), at: new Date().toISOString(), text: `Lucid found ${ideas.length} low-effort ideas${draft.niche ? ` around ${draft.niche}` : ""}.` }, ...current.log].slice(0, 80),
    }));
  }

  function approve(idea: Idea) {
    if (missing(idea.tools).length) return;
    const accountId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    setStore((current) => ({
      ...current,
      ideas: current.ideas.filter((item) => item.id !== idea.id),
      runs: [{ id: runId, name: idea.name, status: "needs accounts", steps: idea.steps.map((step) => ({ ...step })), earned: "", updated: new Date().toISOString() }, ...current.runs],
      accounts: [{ id: accountId, runId, runName: idea.name, emailReady: false, depositReady: false }, ...current.accounts],
      log: [{ id: crypto.randomUUID(), at: new Date().toISOString(), text: `You approved “${idea.name}”. Set up the email and deposit account, then Lucid will run it.` }, ...current.log],
    }));
    setTab("accounts");
  }

  return (
    <main className="min-h-full bg-black p-4 text-sky-50">
      <h1 className="text-2xl font-semibold text-white">Lucid</h1>
      <p className="mb-3 max-w-3xl text-sm text-sky-200/70">
        Lucid looks for low-effort ways to make money online. You approve one, set up the email and the deposit account, then Lucid runs the project. It writes and advances the work while this page is open. It does not open the email or the bank account.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {([["find", "Find"], ["runs", "Runs"], ["tools", "Tool access"], ["accounts", "Accounts"], ["log", "Activity"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded px-3 py-2 text-sm ${tab === id ? "bg-sky-600 text-white" : "border border-sky-500/30"}`}>{label}</button>
        ))}
      </div>

      {tab === "find" && (
        <section className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <input className={input} placeholder="What can you explain? Leave blank for a general search" value={draft.niche || ""} onChange={(e) => set("niche", e.target.value)} />
            <select className={input} value={draft.hours || "3"} onChange={(e) => set("hours", e.target.value)}>
              <option value="1">About 1 hour a week</option>
              <option value="3">A few hours a week</option>
              <option value="5">More time than that</option>
            </select>
            <select className={input} value={draft.face || "no"} onChange={(e) => set("face", e.target.value)}>
              <option value="no">No face on camera</option>
              <option value="yes">Face on camera is fine</option>
            </select>
            <button type="button" className={btn} onClick={find}>Find ideas</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {store.ideas.map((idea) => {
              const need = missing(idea.tools);
              return (
                <article key={idea.id} className="rounded border border-sky-500/25 p-3">
                  <h2 className="text-base text-white">{idea.name}</h2>
                  <p className="mt-1">{idea.summary}</p>
                  <p className="mt-2 text-sky-200/70">{idea.effort}</p>
                  <p className="text-sky-200/70">{idea.range}</p>
                  <p className="mt-2">After approval you set up the email and the deposit account. This idea uses: {idea.account}.</p>
                  <p>Tools: {idea.tools.join(", ")}</p>
                  <p className="text-amber-100/80">Risk: {idea.risks}</p>
                  {!!need.length && <p className="mt-2 text-amber-200">Turn on {need.join(", ")} in Tool access first.</p>}
                  <div className="mt-3 flex gap-2">
                    <button type="button" className={btn} disabled={!!need.length} onClick={() => approve(idea)}>Approve</button>
                    <button type="button" className="rounded border border-sky-500/30 px-3 py-2" onClick={() => setStore((current) => ({ ...current, ideas: current.ideas.filter((item) => item.id !== idea.id) }))}>Pass</button>
                  </div>
                </article>
              );
            })}
          </div>
          {!store.ideas.length && <p className="text-sky-200/60">No ideas on screen. Run a search.</p>}
        </section>
      )}

      {tab === "runs" && (
        <section className="space-y-3 text-sm">
          <p className="text-sky-200/70">Paid amount you have typed in: ${logged.toFixed(2)}.</p>
          {store.runs.map((run) => (
            <article key={run.id} className="rounded border border-sky-500/25 p-3">
              <div className="flex justify-between gap-2"><h2 className="text-base text-white">{run.name}</h2><span>{run.status === "needs accounts" ? "Waiting on your email and deposit setup" : run.status}</span></div>
              {run.steps.map((step) => (
                <div key={step.id} className="mt-2 rounded border border-sky-500/15 p-2">
                  <div>{step.done ? "Done" : "Open"} · {step.owner === "lucid" ? "Lucid" : "You"} · {step.label}</div>
                  {step.done && step.output && <pre className="mt-1 whitespace-pre-wrap text-sky-100/80">{step.output}</pre>}
                  {!step.done && step.owner === "you" && run.status !== "stopped" && (
                    <button type="button" className={`${btn} mt-2`} onClick={() => setStore((current) => ({
                      ...current,
                      runs: current.runs.map((item) => {
                        if (item.id !== run.id) return item;
                        const steps = item.steps.map((row) => row.id === step.id ? { ...row, done: true } : row);
                        const lucidLeft = steps.some((row) => !row.done && row.owner === "lucid");
                        const youLeft = steps.some((row) => !row.done && row.owner === "you");
                        return { ...item, steps, status: lucidLeft ? "running" : youLeft ? "waiting" : "done", updated: new Date().toISOString() };
                      }),
                      accounts: current.accounts,
                      log: [{ id: crypto.randomUUID(), at: new Date().toISOString(), text: `You finished “${step.label}”` }, ...current.log],
                    }))}>I did this</button>
                  )}
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => setStore((current) => ({ ...current, runs: current.runs.map((item) => item.id === run.id ? { ...item, status: item.status === "paused" || item.status === "stopped" ? "running" : "paused" } : item) }))}>{run.status === "paused" || run.status === "stopped" ? "Resume" : "Pause"}</button>
                <button type="button" className="rounded border border-red-400/40 px-3 py-2 text-red-200" onClick={() => setStore((current) => ({ ...current, runs: current.runs.map((item) => item.id === run.id ? { ...item, status: "stopped" } : item) }))}>Stop</button>
                <input className={input} placeholder="What got paid" value={draft[`earn-${run.id}`] ?? run.earned} onChange={(e) => set(`earn-${run.id}`, e.target.value)} />
                <button type="button" className={btn} onClick={() => setStore((current) => ({ ...current, runs: current.runs.map((item) => item.id === run.id ? { ...item, earned: draft[`earn-${run.id}`] ?? item.earned } : item) }))}>Save amount</button>
              </div>
            </article>
          ))}
          {!store.runs.length && <p className="text-sky-200/60">Approve a found idea and it will show up here.</p>}
        </section>
      )}

      {tab === "tools" && (
        <section className="space-y-2 text-sm">
          {TOOLS.map((tool) => (
            <label key={tool.id} className="flex gap-3 rounded border border-sky-500/25 p-3">
              <input type="checkbox" checked={store.tools.includes(tool.id)} onChange={(e) => setStore((current) => ({ ...current, tools: e.target.checked ? [...current.tools, tool.id] : current.tools.filter((id) => id !== tool.id) }))} />
              <span><span className="text-white">{tool.label}</span><span className="block text-sky-200/70">{tool.does}</span></span>
            </label>
          ))}
        </section>
      )}

      {tab === "accounts" && (
        <section className="space-y-2 text-sm">
          <p className="text-sky-200/70">After you approve an idea, set up the email and the deposit account here. Lucid does not start until both are marked ready.</p>
          {store.accounts.map((account) => {
            const ready = account.emailReady && account.depositReady;
            return (
              <article key={account.id} className="rounded border border-sky-500/25 p-3">
                <div className="text-white">{account.runName}</div>
                <label className="mt-2 flex gap-2"><input type="checkbox" checked={account.emailReady} onChange={(e) => setStore((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === account.id ? { ...item, emailReady: e.target.checked } : item) }))} /> Email account is set up</label>
                <label className="mt-1 flex gap-2"><input type="checkbox" checked={account.depositReady} onChange={(e) => setStore((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === account.id ? { ...item, depositReady: e.target.checked } : item) }))} /> Deposit account is set up</label>
                <button type="button" className={`${btn} mt-3`} disabled={!ready} onClick={() => { setStore((current) => ({ ...current, runs: current.runs.map((run) => run.id === account.runId ? { ...run, status: "running", updated: new Date().toISOString() } : run), log: [{ id: crypto.randomUUID(), at: new Date().toISOString(), text: `Accounts are ready. Lucid is running “${account.runName}”.` }, ...current.log] })); setTab("runs"); }}>Let Lucid run</button>
              </article>
            );
          })}
          {!store.accounts.length && <p className="text-sky-200/60">None yet. Approve an idea and Lucid adds the account that idea needs.</p>}
        </section>
      )}

      {tab === "log" && (
        <section className="space-y-2 text-sm">
          {store.log.map((entry) => <div key={entry.id} className="rounded border border-sky-500/20 p-2"><div className="text-sky-200/50">{new Date(entry.at).toLocaleString()}</div>{entry.text}</div>)}
          {!store.log.length && <p className="text-sky-200/60">Nothing yet.</p>}
        </section>
      )}
    </main>
  );
}
