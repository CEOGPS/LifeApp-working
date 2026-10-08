import { useEffect, useState } from "react";
import { EngineBar } from "./engine-bar";
import { newId, type Memory } from "./memory";

type Update = (recipe: (prev: Memory) => Memory) => void;
type ToolId = "content" | "email" | "listings" | "social" | "leads" | "assets";
type Tab = "find" | "runs" | "tools" | "accounts" | "log";
type Step = { id: string; label: string; owner: "lucid" | "you"; done: boolean; output: string };
type Idea = { id: string; name: string; summary: string; effort: string; range: string; tools: ToolId[]; account: string; risks: string; steps: Step[] };
type Run = { id: string; name: string; status: "needs accounts" | "running" | "waiting" | "paused" | "stopped" | "done"; steps: Step[]; earned: string; updated: string };
type Account = { id: string; runId: string; runName: string; emailReady: boolean; depositReady: boolean };
type Entry = { id: string; at: string; text: string };
type Store = { tools: ToolId[]; ideas: Idea[]; runs: Run[]; accounts: Account[]; log: Entry[] };

const KEY = "lifeos.lucid.desk";
const TOOLS: { id: ToolId; label: string; does: string }[] = [
  { id: "content", label: "Content", does: "Writes the product, page, or script" },
  { id: "email", label: "Email", does: "Writes mail. It does not send it" },
  { id: "listings", label: "Listings", does: "Writes the shop or profile text" },
  { id: "social", label: "Social", does: "Writes posts. It does not publish them" },
  { id: "leads", label: "Leads", does: "Builds the searches and the reply" },
  { id: "assets", label: "Files", does: "Turns one file into a listing" },
];
const TABS: [Tab, string][] = [["find", "Find"], ["runs", "Runs"], ["tools", "Tool access"], ["accounts", "Accounts"], ["log", "Activity"]];

function ideaSet(niche: string, hours: string, face: boolean): Idea[] {
  const topic = niche.trim() || "a subject you can explain without research";
  const all: Idea[] = [
    { id: "pack", name: `A $12 download about ${topic}`, summary: "One short checklist. Lucid writes it and the shop page. You create the shop and upload the file.", effort: "Low. One sitting after the copy is written.", range: "Usually slow. A few sales, not a salary.", tools: ["content", "listings"], account: "New Gumroad or PayPal shop", risks: "No shop approval, no sales. Crowded topics sit at zero.", steps: [
      { id: "write", label: "Write the file and the sales page", owner: "lucid", done: false, output: `Title: ${topic} — the short checklist\nPrice to test: $12\nBuyer gets a 1–2 page file they can use the same day.\nNo income claim on the page.` },
      { id: "shop", label: "Open the shop and upload the file", owner: "you", done: false, output: "" },
    ] },
    { id: "clips", name: `Ten answer clips about ${topic}`, summary: "Short scripts for a new channel. No face required. You post them on the channel you create.", effort: "Low if you record voice only, or use text on screen.", range: "Most new channels earn nothing for months.", tools: ["content", "social"], account: "New YouTube channel", risks: "Reused footage and copied scripts get limited. One topic only.", steps: [
      { id: "scripts", label: "Write 10 short scripts", owner: "lucid", done: false, output: Array.from({ length: 10 }, (_, index) => `${index + 1}. One question about ${topic}. Answer in under 40 seconds.`).join("\n") },
      { id: "channel", label: "Create the channel and post the first three", owner: "you", done: false, output: "" },
    ] },
    { id: "compare", name: `One comparison page for ${topic}`, summary: "A page that compares two or three options you have actually used. You publish it where you can add a link later.", effort: "Low. One page, not a blog.", range: "Pays only if a program has already approved you and someone buys.", tools: ["content"], account: "New page on a site you control", risks: "Do not review products you have not used. No link, no payout.", steps: [
      { id: "draft", label: "Draft the comparison", owner: "lucid", done: false, output: `Page: ${topic}, two or three options\nFor each: what it is for, what it is bad at, what it costs.\nLeave the link blank until the program approves the account.` },
      { id: "publish", label: "Publish the page", owner: "you", done: false, output: "" },
    ] },
    { id: "etsy", name: `A template pack for ${topic}`, summary: "Three simple templates. Lucid writes the titles and tags. You export them and list them.", effort: "Low if the templates are plain documents.", range: "Often a few dollars a sale, if they sell.", tools: ["content", "assets", "listings"], account: "New Etsy or Creative Market shop", risks: "Do not list files you do not own. New shops can take days to clear.", steps: [
      { id: "copy", label: "Write three listings", owner: "lucid", done: false, output: `1. ${topic} checklist\n2. ${topic} tracker\n3. ${topic} first-week plan\nSay the format and that the buyer edits it.` },
      { id: "list", label: "Open the shop and publish the three files", owner: "you", done: false, output: "" },
    ] },
    { id: "replies", name: `Answer people already asking about ${topic}`, summary: "Lucid writes the searches and a short reply. You post it only where someone asked.", effort: "Low. A few replies, not a content calendar.", range: "One paid job if the reply is specific. Most threads pay nothing.", tools: ["leads", "social"], account: "The profile you post from", risks: "Copied ads get removed. Reply only to a real request.", steps: [
      { id: "pack", label: "Write the searches and the reply", owner: "lucid", done: false, output: `Search: "looking for" ${topic}\nSearch: "anyone know" ${topic}\n\nReply: I can help with ${topic}. Tell me the deadline and what done looks like. I will answer with a price before any work.` },
      { id: "post", label: "Send that reply on a thread that asked", owner: "you", done: false, output: "" },
    ] },
  ];
  return all.filter((idea) => {
    if (!face && idea.id === "clips") return hours !== "1";
    if (hours === "1") return idea.id === "pack" || idea.id === "replies" || idea.id === "compare";
    return true;
  });
}

function empty(): Store {
  return { tools: [], ideas: [], runs: [], accounts: [], log: [] };
}

function load(board: Memory["ideas"]): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Store | null;
    if (raw && (raw.ideas?.length || raw.runs?.length || raw.log?.length || raw.tools?.length)) return { ...empty(), ...raw };
  } catch { /* seed from the board */ }
  return {
    ...empty(),
    ideas: board.filter((row) => row.status === "new").map((row) => ({
      id: row.id, name: row.title, summary: row.note || "Saved on the board.", effort: row.effort || "Low", range: "Only the amount you type in later.", tools: ["content"], account: row.source || "An email and a deposit account you set up", risks: row.log || "Do not start until both accounts are ready.",
      steps: [{ id: "write", label: "Write the offer", owner: "lucid", done: false, output: row.note || row.title }, { id: "you", label: "Set up the email and the deposit account", owner: "you", done: false, output: "" }],
    })),
  };
}

export function LucidDesk({ data, update }: { data: Memory; update: Update }) {
  const [tab, setTab] = useState<Tab>("find");
  const [store, setStore] = useState<Store>(() => load(data.ideas));
  const [draft, setDraft] = useState<Record<string, string>>({ hours: "3", face: "no" });
  const logged = store.runs.reduce((sum, run) => sum + (Number(String(run.earned).replace(/[^0-9.]/g, "")) || 0), 0);

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
        log: [{ id: newId(), at: new Date().toISOString(), text: step ? `Lucid finished “${step.label}” for ${run.name}` : `${run.name} is waiting on you` }, ...current.log].slice(0, 80),
      }));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [store.runs]);

  const set = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const missing = (tools: ToolId[]) => tools.filter((tool) => !store.tools.includes(tool));

  function find() {
    const ideas = ideaSet(draft.niche || "", draft.hours || "3", draft.face === "yes").map((idea) => ({ ...idea, id: newId(), steps: idea.steps.map((step) => ({ ...step })) }));
    setStore((current) => ({ ...current, ideas, log: [{ id: newId(), at: new Date().toISOString(), text: `Lucid found ${ideas.length} low-effort ideas${draft.niche ? ` around ${draft.niche}` : ""}.` }, ...current.log].slice(0, 80) }));
    update((prev) => ({ ...prev, notifs: [{ id: newId(), text: `${ideas.length} Lucid ideas to review`, source: "Lucid", seen: false }, ...prev.notifs] }));
  }

  function approve(idea: Idea) {
    if (missing(idea.tools).length) return;
    const runId = newId();
    setStore((current) => ({
      ...current,
      ideas: current.ideas.filter((item) => item.id !== idea.id),
      runs: [{ id: runId, name: idea.name, status: "needs accounts", steps: idea.steps.map((step) => ({ ...step })), earned: "", updated: new Date().toISOString() }, ...current.runs],
      accounts: [{ id: newId(), runId, runName: idea.name, emailReady: false, depositReady: false }, ...current.accounts],
      log: [{ id: newId(), at: new Date().toISOString(), text: `You approved “${idea.name}”. Set up the email and deposit account, then Lucid will run it.` }, ...current.log],
    }));
    update((prev) => ({
      ...prev,
      ideas: [{ id: runId, title: idea.name, note: idea.summary, approved: true, status: "approved", source: idea.account, effort: "low", email: "", funding: "", log: idea.risks }, ...prev.ideas.filter((row) => row.title !== idea.name)],
      notifs: [{ id: newId(), text: `Set up accounts for ${idea.name}`, source: "Lucid", seen: false }, ...prev.notifs],
    }));
    setTab("accounts");
  }

  return (
    <div className="grid gap-3">
      <p className="max-w-3xl text-sm text-white/50">Lucid looks for low-effort ways to make money online. You approve one, set up the email and the deposit account, then Lucid runs the project. It writes the work. It does not open the email or the bank account.</p>
      <EngineBar panel="Lucid" data={data} update={update} />
      <div className="flex flex-wrap gap-3">
        {TABS.map(([id, label]) => <button key={id} type="button" className={`quiet ${tab === id ? "is-on" : ""}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {tab === "find" ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <input className="h-8 min-w-56 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="What can you explain?" value={draft.niche || ""} onChange={(event) => set("niche", event.target.value)} />
            <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={draft.hours || "3"} onChange={(event) => set("hours", event.target.value)}>
              <option value="1">About 1 hour a week</option>
              <option value="3">A few hours a week</option>
              <option value="5">More time than that</option>
            </select>
            <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={draft.face || "no"} onChange={(event) => set("face", event.target.value)}>
              <option value="no">No face on camera</option>
              <option value="yes">Face on camera is fine</option>
            </select>
            <button type="button" className="quiet is-on" onClick={find}>Find ideas</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {store.ideas.map((idea) => {
              const need = missing(idea.tools);
              return (
                <article key={idea.id} className="module-card p-3 text-sm">
                  <h2 className="text-base">{idea.name}</h2>
                  <p className="mt-1 text-white/70">{idea.summary}</p>
                  <p className="mt-2 text-white/45">{idea.effort}</p>
                  <p className="text-white/45">{idea.range}</p>
                  <p className="mt-2">You set up: {idea.account}.</p>
                  <p>Tools: {idea.tools.join(", ")}</p>
                  <p className="text-orange-200/80">Risk: {idea.risks}</p>
                  {need.length ? <p className="mt-2 text-orange-200">Turn on {need.join(", ")} in Tool access first.</p> : null}
                  <div className="mt-3 flex gap-3">
                    <button type="button" className="quiet is-on" disabled={need.length > 0} onClick={() => approve(idea)}>Approve</button>
                    <button type="button" className="link-remove" onClick={() => setStore((current) => ({ ...current, ideas: current.ideas.filter((item) => item.id !== idea.id) }))}>Pass</button>
                  </div>
                </article>
              );
            })}
          </div>
          {!store.ideas.length ? <p className="text-sm text-white/40">No ideas on screen. Run a search.</p> : null}
        </section>
      ) : null}
      {tab === "runs" ? (
        <section className="grid gap-3 text-sm">
          <p className="text-white/50">Paid amount you have typed in: ${logged.toFixed(2)}.</p>
          {store.runs.map((run) => (
            <article key={run.id} className="module-card p-3">
              <div className="flex justify-between gap-2"><h2 className="text-base">{run.name}</h2><span className="text-white/45">{run.status === "needs accounts" ? "Waiting on your email and deposit setup" : run.status}</span></div>
              {run.steps.map((step) => (
                <div key={step.id} className="mt-2 rounded-lg border border-white/10 p-2">
                  <div>{step.done ? "Done" : "Open"} · {step.owner === "lucid" ? "Lucid" : "You"} · {step.label}</div>
                  {step.done && step.output ? <pre className="mt-1 whitespace-pre-wrap text-white/70">{step.output}</pre> : null}
                  {!step.done && step.owner === "you" && run.status !== "stopped" ? (
                    <button type="button" className="quiet is-on mt-2" onClick={() => setStore((current) => ({
                      ...current,
                      runs: current.runs.map((item) => {
                        if (item.id !== run.id) return item;
                        const steps = item.steps.map((row) => row.id === step.id ? { ...row, done: true } : row);
                        const lucidLeft = steps.some((row) => !row.done && row.owner === "lucid");
                        const youLeft = steps.some((row) => !row.done && row.owner === "you");
                        return { ...item, steps, status: lucidLeft ? "running" : youLeft ? "waiting" : "done", updated: new Date().toISOString() };
                      }),
                      log: [{ id: newId(), at: new Date().toISOString(), text: `You finished “${step.label}”` }, ...current.log],
                    }))}>I did this</button>
                  ) : null}
                </div>
              ))}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="quiet" onClick={() => setStore((current) => ({ ...current, runs: current.runs.map((item) => item.id === run.id ? { ...item, status: item.status === "paused" || item.status === "stopped" ? "running" : "paused" } : item) }))}>{run.status === "paused" || run.status === "stopped" ? "Resume" : "Pause"}</button>
                <button type="button" className="link-remove" onClick={() => setStore((current) => ({ ...current, runs: current.runs.map((item) => item.id === run.id ? { ...item, status: "stopped" } : item) }))}>Stop</button>
                <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="What got paid" value={draft[`earn-${run.id}`] ?? run.earned} onChange={(event) => set(`earn-${run.id}`, event.target.value)} />
                <button type="button" className="quiet is-on" onClick={() => setStore((current) => ({ ...current, runs: current.runs.map((item) => item.id === run.id ? { ...item, earned: draft[`earn-${run.id}`] ?? item.earned } : item) }))}>Save amount</button>
              </div>
            </article>
          ))}
          {!store.runs.length ? <p className="text-white/40">Approve a found idea and it will show up here.</p> : null}
        </section>
      ) : null}
      {tab === "tools" ? (
        <section className="grid gap-2 text-sm">
          {TOOLS.map((tool) => (
            <label key={tool.id} className="module-card flex items-center gap-3 p-3">
              <input type="checkbox" checked={store.tools.includes(tool.id)} onChange={(event) => setStore((current) => ({ ...current, tools: event.target.checked ? [...current.tools, tool.id] : current.tools.filter((id) => id !== tool.id) }))} />
              <span><span className="block">{tool.label}</span><span className="block text-white/45">{tool.does}</span></span>
            </label>
          ))}
        </section>
      ) : null}
      {tab === "accounts" ? (
        <section className="grid gap-2 text-sm">
          <p className="text-white/50">After you approve an idea, mark the email and the deposit account here. Lucid does not start until both are ready.</p>
          {store.accounts.map((account) => {
            const ready = account.emailReady && account.depositReady;
            return (
              <article key={account.id} className="module-card p-3">
                <div>{account.runName}</div>
                <label className="mt-2 flex gap-2"><input type="checkbox" checked={account.emailReady} onChange={(event) => setStore((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === account.id ? { ...item, emailReady: event.target.checked } : item) }))} /> Email account is set up</label>
                <label className="mt-1 flex gap-2"><input type="checkbox" checked={account.depositReady} onChange={(event) => setStore((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === account.id ? { ...item, depositReady: event.target.checked } : item) }))} /> Deposit account is set up</label>
                <button type="button" className="quiet is-on mt-3" disabled={!ready} onClick={() => {
                  setStore((current) => ({ ...current, runs: current.runs.map((run) => run.id === account.runId ? { ...run, status: "running", updated: new Date().toISOString() } : run), log: [{ id: newId(), at: new Date().toISOString(), text: `Accounts are ready. Lucid is running “${account.runName}”.` }, ...current.log] }));
                  update((prev) => ({ ...prev, ideas: prev.ideas.map((row) => row.id === account.runId ? { ...row, status: "running", approved: true } : row) }));
                  setTab("runs");
                }}>Let Lucid run</button>
              </article>
            );
          })}
          {!store.accounts.length ? <p className="text-white/40">None yet. Approve an idea and Lucid adds the account that idea needs.</p> : null}
        </section>
      ) : null}
      {tab === "log" ? (
        <section className="grid gap-2 text-sm">
          {store.log.map((entry) => <div key={entry.id} className="module-card p-2"><div className="text-[11px] text-white/35">{new Date(entry.at).toLocaleString()}</div>{entry.text}</div>)}
          {!store.log.length ? <p className="text-white/40">Nothing yet.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
