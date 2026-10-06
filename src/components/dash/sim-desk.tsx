import { useState } from "react";
import { newId, type Memory } from "./memory";
import { fmtMoney } from "./format";
import { SIMS, type SimName } from "./sims";
import { boardFacts } from "./facts";

type Update = (recipe: (prev: Memory) => Memory) => void;

const BLACK = [
  "The real reason I-285 is always backed up: ___.",
  "HR's email of the year: ___.",
  "What they do not mention at the Atlanta Chamber: ___.",
  "The startup pitch: we are Uber, but for ___.",
  "My side hustle is professionally ___.",
];
const WHITE = [
  "Existing in Atlanta traffic for 45 minutes to go 2 miles",
  "A passive-aggressive Slack message",
  "Sending per my last email and meaning it",
  "A subscription you forgot to cancel",
  "Calling a ten-minute task a deep dive",
  "A business loan spent on vibes",
  "The fifth final reminder email",
  "Asking if the meeting could have been an email",
];

const SCENES = [
  "Water balloon fight at Piedmont Park",
  "Falcons watch party",
  "Atlanta food truck argument",
  "Storm knocks the power out",
];
const CARDS = ["The Gate", "The Debt", "The Ally", "The Delay", "The Offer", "The Cut"];

function save(update: Update, name: string, body: string) {
  update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Sim · ${name}`, body }, ...prev.notes.filter((row) => row.title !== `Sim · ${name}`)] }));
}

export function SimDesk({ data, update }: { data: Memory; update: Update }) {
  const [name, setName] = useState<SimName>(SIMS[0]);
  const [pick, setPick] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [whatIf, setWhatIf] = useState("");
  const [dream, setDream] = useState("");
  const [black, setBlack] = useState("");
  const [whites, setWhites] = useState<string[]>([]);
  const [echoLine, setEchoLine] = useState("");
  const [echoChat, setEchoChat] = useState<{ mine: boolean; text: string }[]>([]);
  const [situation, setSituation] = useState("");
  const [game, setGame] = useState("");
  const [mins, setMins] = useState("60");
  const [arch, setArch] = useState("Pirate");
  const [scene, setScene] = useState(SCENES[0]);
  const [friendFind, setFriendFind] = useState("");
  const [friendLine, setFriendLine] = useState("");
  const [friendChat, setFriendChat] = useState<{ mine: boolean; text: string }[]>([]);
  const [joyMood, setJoyMood] = useState("Chill");
  const [joyEnergy, setJoyEnergy] = useState("Low");
  const [busy, setBusy] = useState(false);
  const open = data.tasks.filter((row) => !row.done);
  const done = data.tasks.filter((row) => row.done);
  const unpaid = data.expenses.filter((row) => !row.paid);
  const net = data.accounts.reduce((sum, row) => sum + row.balance, 0);
  const saved = data.notes.find((row) => row.title === `Sim · ${name}`)?.body || "";

  function run() {
    if (name === "Alternate Life") {
      const task = open.find((row) => row.id === pick) || open[0];
      setNote(task ? `If you drop "${task.title}", ${Math.max(0, open.length - 1)} open tasks stay. Unpaid stays ${unpaid.map((row) => row.name).join(", ") || "clear"}.` : "No open task is saved, so there is no path to drop.");
    } else if (name === "Dark Card") {
      const card = CARDS[Math.floor(Math.random() * CARDS.length)];
      const fact = data.leads[0]?.name || unpaid[0]?.name || open[0]?.title;
      setNote(fact ? `${card}. The board fact under it is ${fact}.` : `${card}. No lead, bill, or task is saved under it.`);
    } else if (name === "Dream Forge") {
      const row = data.notes.find((item) => item.id === pick) || data.notes.find((item) => !item.title.startsWith("Sim ·"));
      setNote(row ? `Scene from "${row.title}": ${row.body.slice(0, 500) || "That note has no body."}` : "No note is saved to forge.");
    } else if (name === "Echo Persona") {
      const pages = (data.journal.length ? data.journal : data.notes).slice(0, 4).map((row) => row.title);
      setNote(pages.length ? `Echo: ${pages.join(" · ")}` : "No journal page is saved.");
    } else if (name === "Fantasy Friend") {
      const person = data.contacts.find((row) => row.id === pick) || data.contacts[0];
      setNote(person ? `${person.name}${person.city ? `, ${person.city}` : ""}. ${person.phone || person.email || "No phone or email saved."}` : "No contact is saved.");
    } else if (name === "Narrative Conflict") {
      const a = [...data.leads.map((row) => row.name), ...open.map((row) => row.title)];
      const left = a.find((row) => row === pick) || a[0];
      const right = a.find((row) => row === other) || a[1];
      setNote(left && right && left !== right ? `${left} wants the next step. ${right} is the other claim.` : "Pick two different leads or tasks.");
    } else if (name === "Shadow Budget") {
      setNote(`Net ${fmtMoney(net)}. Unpaid ${fmtMoney(unpaid.reduce((sum, row) => sum + row.amount, 0))}.`);
    } else if (name === "Life RPG") {
      setNote(`Level ${done.length}. Open: ${open.map((row) => row.title).join(", ") || "none"}. Cleared: ${done.map((row) => row.title).join(", ") || "none"}.`);
    } else if (name === "Compliment Cannon") {
      setNote(done.length ? done.map((row) => `Finished: ${row.title}`).join("\n") : "Nothing is marked done.");
    } else if (name === "Smart Browser") {
      setNote(data.query ? `Saved search: ${data.query}` : "No search is saved on OmniSearch.");
    } else {
      const empty = [
        ["notes", data.notes.length],
        ["tasks", data.tasks.length],
        ["contacts", data.contacts.length],
        ["mail", data.mail.length],
        ["events", data.events.length],
      ].filter((row) => row[1] === 0).map((row) => row[0]);
      setNote(`Tasks ${data.tasks.length}. Contacts ${data.contacts.length}. Mail ${data.mail.length}. Net ${fmtMoney(net)}. Empty: ${empty.join(", ") || "none"}.`);
    }
  }

  async function simulate() {
    const question = whatIf.trim();
    if (!question) { setNote("Write the what-if first."); return; }
    setBusy(true);
    setNote("Simulating…");
    const facts = boardFacts(data, question);
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({
      data: {
        name: "Explorer",
        prompt: "Compare the saved board with one alternate path. Use only the facts. If a number is not in the facts, write unknown. Never invent income, names, or dates. Return JSON only.",
        facts,
        question: `What if: ${question}\nReturn JSON only: {"verdict":"","reason":"","current":"","alternate":"","timeline":["Month 1: "],"risks":[""],"test":["Week 1: "],"atlanta":""}`,
      },
    });
    setNote(result.text || "No simulation came back.");
    setBusy(false);
  }

  function deal() {
    const deck = [...WHITE].sort(() => Math.random() - 0.5).slice(0, 6);
    setBlack(BLACK[Math.floor(Math.random() * BLACK.length)]);
    setWhites(deck);
    setNote("");
  }

  async function judge(card: string) {
    setBusy(true);
    setNote("Judging…");
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({
      data: {
        name: "Czar",
        prompt: "You judge a dark-humor fill-in-the-blank. No slurs. No explicit content. One sentence.",
        facts: `Prompt: ${black}`,
        question: `Answer: ${card}. Score it 1-10 and say why in one line.`,
      },
    });
    setNote(result.text || "No verdict.");
    setBusy(false);
  }

  async function forge() {
    const vision = dream.trim();
    if (!vision) { setNote("Write the vision first."); return; }
    setBusy(true);
    setNote("Forging…");
    const facts = boardFacts(data, vision);
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({
      data: {
        name: "Forge",
        prompt: "Turn one vision into a 12-month playbook. Use only the facts for money. If a number is missing, write unknown. Return JSON only.",
        facts,
        question: `${vision}\nReturn JSON only: {"tagline":"","phases":[{"months":"1-2","title":"","tasks":[""]}],"conflicts":[""],"month12":"unknown"}`,
      },
    });
    setNote(result.text || "No playbook came back.");
    setBusy(false);
  }

  function takeTasks() {
    const raw = note.match(/\{[\s\S]*\}/)?.[0];
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { phases?: { title?: string; tasks?: string[] }[] };
      const fresh = (parsed.phases || []).flatMap((phase) => (phase.tasks || []).map((task) => `[Dream] ${phase.title || "Phase"}: ${task}`)).filter(Boolean).slice(0, 12);
      if (!fresh.length) return;
      update((prev) => ({ ...prev, tasks: [...fresh.filter((title) => !prev.tasks.some((row) => row.title === title)).map((title) => ({ id: newId(), title, done: false })), ...prev.tasks] }));
      setNote(`${note}\n\nAdded ${fresh.length} tasks.`);
    } catch {
      setNote("That playbook is not JSON, so no tasks were added.");
    }
  }

  async function askEcho() {
    const line = echoLine.trim();
    if (!line) return;
    setEchoLine("");
    setEchoChat((prev) => [...prev, { mine: true, text: line }]);
    setBusy(true);
    const pages = (data.journal.length ? data.journal : data.notes).slice(0, 40).map((row) => `${row.title}: ${row.body.slice(0, 1500)}`).join("\n");
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({
      data: {
        name: "Echo",
        prompt: "You are Chris 12 months from now. Use only the saved pages. If something is not there, say you do not know it yet. Stay in character. Two short paragraphs.",
        facts: pages || "No journal pages are saved.",
        question: line,
      },
    });
    setEchoChat((prev) => [...prev, { mine: false, text: result.text || "No echo came back." }]);
    setBusy(false);
  }

  async function readState() {
    if (!situation.trim()) { setNote("Write the situation first."); return; }
    setBusy(true);
    setNote("Reading the state…");
    const facts = boardFacts(data, situation);
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({
      data: {
        name: "RPG",
        prompt: "Treat the week as a game. Name one mode (build, recover, create, grind, or network), three moves that use the saved tasks or bills, and one weakness. Do not invent meetings or money.",
        facts,
        question: situation.trim(),
      },
    });
    setNote(result.text || "No read came back.");
    setBusy(false);
  }

  function logSession() {
    if (!game.trim()) return;
    const title = `Session · ${game.trim()}`;
    const stamp = new Date().toLocaleDateString("en-US");
    update((prev) => ({ ...prev, notes: [{ id: newId(), title, body: `${mins || "0"} min · ${stamp}` }, ...prev.notes.filter((row) => row.title !== title)] }));
    setGame("");
    setNote(`Logged ${title}.`);
  }

  async function talkFriend() {
    const line = friendLine.trim();
    const person = data.contacts.find((row) => row.id === pick);
    if (!line || !person) { setNote("Pick a contact and write a line."); return; }
    setFriendLine("");
    setFriendChat((prev) => [...prev, { mine: true, text: line }]);
    setBusy(true);
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({
      data: {
        name: person.name,
        prompt: `You are a silly ${arch} version of ${person.name} in Atlanta. Scene: ${scene}. Stay in character. Two or three sentences. No harm. Use only this contact card.`,
        facts: boardFacts(data, `${person.name} ${line}`),
        question: line,
      },
    });
    setFriendChat((prev) => [...prev, { mine: false, text: result.text || "No line came back." }]);
    setBusy(false);
  }

  const alt = (() => {
    try {
      const raw = note.match(/\{[\s\S]*\}/)?.[0];
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { verdict?: string; reason?: string; current?: string; alternate?: string; timeline?: string[]; risks?: string[]; test?: string[]; atlanta?: string };
      return parsed.verdict || parsed.current ? parsed : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[16rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">Simulators</p>
        <div className="mt-3">
          {SIMS.map((item) => <button key={item} type="button" className={`menu ${name === item ? "is-on" : ""}`} onClick={() => { setName(item); setNote(""); }}>{item}</button>)}
        </div>
      </aside>
      <section className="module-card p-4">
        <h1 className="text-2xl">{name}</h1>
        <div className="mt-4 grid gap-3">
          {name === "Alternate Life" ? (
            <div className="grid gap-2">
              <textarea className="min-h-20 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" placeholder="What if…" value={whatIf} onChange={(event) => setWhatIf(event.target.value)} />
              <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={pick} onChange={(event) => setPick(event.target.value)}>
                <option value="">Open task to drop</option>
                {open.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
              </select>
            </div>
          ) : null}
          {name === "Dream Forge" ? (
            <div className="grid gap-2">
              <textarea className="min-h-20 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" placeholder="The vision" value={dream} onChange={(event) => setDream(event.target.value)} />
              <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={pick} onChange={(event) => setPick(event.target.value)}>
                <option value="">Note to forge</option>
                {data.notes.filter((row) => !row.title.startsWith("Sim ·") && !row.title.startsWith("Family ·")).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
              </select>
            </div>
          ) : null}
          {name === "Dark Card" ? (
            <div className="grid gap-2">
              <p className="rounded-2xl border border-white/15 bg-black px-4 py-3 text-base">{black || "Deal a prompt."}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {whites.map((card) => <button key={card} type="button" className="rounded-2xl bg-white px-3 py-2 text-left text-sm text-black" onClick={() => void judge(card)}>{card}</button>)}
              </div>
            </div>
          ) : null}
          {name === "Echo Persona" ? (
            <div className="grid gap-2">
              {echoChat.map((row, index) => <p key={`${index}-${row.text.slice(0, 12)}`} className={row.mine ? "text-sm" : "text-sm text-white/70"}>{row.mine ? "You" : "Echo"} · {row.text}</p>)}
              <div className="flex gap-2">
                <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={echoLine} placeholder="Ask your future self" onChange={(event) => setEchoLine(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void askEcho(); }} />
                <button type="button" className="quiet is-on" onClick={() => void askEcho()}>{busy ? "…" : "Send"}</button>
              </div>
            </div>
          ) : null}
          {name === "Fantasy Friend" ? (
            <div className="grid gap-2">
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Find a contact" value={friendFind} onChange={(event) => setFriendFind(event.target.value)} />
              <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={pick} onChange={(event) => setPick(event.target.value)}>
                <option value="">Contact</option>
                {data.contacts.filter((row) => {
                  const q = friendFind.trim().toLowerCase();
                  if (!q) return false;
                  return `${row.name} ${row.company} ${row.phone} ${row.email} ${row.city}`.toLowerCase().includes(q);
                }).slice(0, 40).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                {["Pirate", "Wizard", "Chef", "Detective"].map((item) => <button key={item} type="button" className={`quiet ${arch === item ? "is-on" : ""}`} onClick={() => setArch(item)}>{item}</button>)}
              </div>
              <div className="flex flex-wrap gap-2">
                {SCENES.map((item) => <button key={item} type="button" className={`quiet ${scene === item ? "is-on" : ""}`} onClick={() => setScene(item)}>{item}</button>)}
              </div>
              {friendChat.map((row, index) => <p key={`${index}-${row.text.slice(0, 12)}`} className={row.mine ? "text-sm" : "text-sm text-white/70"}>{row.mine ? "You" : arch} · {row.text}</p>)}
              <div className="flex gap-2">
                <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={friendLine} placeholder="Say something" onChange={(event) => setFriendLine(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void talkFriend(); }} />
                <button type="button" className="quiet is-on" onClick={() => void talkFriend()}>{busy ? "…" : "Send"}</button>
              </div>
            </div>
          ) : null}
          {name === "Narrative Conflict" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={pick} onChange={(event) => setPick(event.target.value)}>
                <option value="">First claim</option>
                {[...data.leads.map((row) => row.name), ...open.map((row) => row.title)].map((row) => <option key={row} value={row}>{row}</option>)}
              </select>
              <select className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={other} onChange={(event) => setOther(event.target.value)}>
                <option value="">Second claim</option>
                {[...data.leads.map((row) => row.name), ...open.map((row) => row.title)].map((row) => <option key={`b-${row}`} value={row}>{row}</option>)}
              </select>
            </div>
          ) : null}
          {name === "Shadow Budget" ? (
            <div className="grid gap-2 text-sm">
              {data.accounts.map((row) => <p key={row.id} className="flex justify-between border-b border-white/10 py-1"><span>{row.name}</span><span>{fmtMoney(row.balance)}</span></p>)}
              {unpaid.map((row) => <p key={row.id} className="flex justify-between border-b border-white/10 py-1 text-white/60"><span>{row.name} due</span><span>{fmtMoney(row.amount)}</span></p>)}
              {!data.accounts.length && !unpaid.length ? <p className="text-white/40">No accounts or bills are saved.</p> : null}
              <button type="button" className="quiet is-on w-fit" onClick={() => {
                setBusy(true);
                setNote("Reading the books…");
                void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { name: "Oracle", prompt: "Read the finance sheet only. Say what is unpaid, which account moved, and one bill to pay first. Do not invent a balance or a return.", facts: boardFacts(data, "budget invoices accounts bills"), question: "What should be paid first?" } })).then((result) => { setNote(result.text || "No read came back."); setBusy(false); });
              }}>{busy ? "Working" : "Read the books"}</button>
            </div>
          ) : null}
          {name === "Random Joy" ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                {["Silly", "Chill", "Social", "Solo"].map((item) => <button key={item} type="button" className={`quiet ${joyMood === item ? "is-on" : ""}`} onClick={() => setJoyMood(item)}>{item}</button>)}
                {["Low", "Medium", "High"].map((item) => <button key={item} type="button" className={`quiet ${joyEnergy === item ? "is-on" : ""}`} onClick={() => setJoyEnergy(item)}>{item}</button>)}
              </div>
              <button type="button" className="quiet is-on" onClick={() => {
                setBusy(true);
                setNote("Spinning…");
                const recent = data.notes.filter((row) => row.title.startsWith("Joy ·")).slice(0, 5).map((row) => row.title).join(", ");
                void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { name: "Joy", prompt: "Give one harmless Atlanta micro-adventure. No self-improvement. No prices. One title line, then two sentences, then how long it takes. Do not repeat a recent idea.", facts: `Mood: ${joyMood}. Energy: ${joyEnergy}. Recent: ${recent || "none"}. Atlanta.`, question: "Spin one idea." } })).then((result) => {
                  const text = result.text || "Nothing came back.";
                  const title = text.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 80) || "Joy spin";
                  save(update, `Joy extra`, text);
                  update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Joy · ${title}`, body: text }, ...prev.notes.filter((row) => !row.title.startsWith("Sim · Joy"))] }));
                  setNote(text);
                  setBusy(false);
                }).catch(() => { setNote("The spin did not answer."); setBusy(false); });
              }}>{busy ? "…" : "Spin"}</button>
              {data.notes.filter((row) => row.title.startsWith("Joy ·")).slice(0, 6).map((row) => <p key={row.id} className="text-sm text-white/60">{row.title.replace("Joy · ", "")}</p>)}
            </div>
          ) : null}
          {name === "Life RPG" ? (
            <div className="grid gap-2">
              <textarea className="min-h-16 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" placeholder="What the week actually looks like" value={situation} onChange={(event) => setSituation(event.target.value)} />
              <div className="flex gap-2">
                <input className="h-8 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Game you played" value={game} onChange={(event) => setGame(event.target.value)} />
                <input className="h-8 w-20 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Min" value={mins} onChange={(event) => setMins(event.target.value.replace(/[^0-9]/g, ""))} />
                <button type="button" className="quiet" onClick={logSession}>Log</button>
              </div>
              <p className="text-sm text-white/50">Level {done.length}</p>
              {open.map((row) => <p key={row.id} className="text-sm">Open · {row.title}</p>)}
              {data.notes.filter((row) => row.title.startsWith("Session ·")).slice(0, 6).map((row) => <p key={row.id} className="text-sm text-white/50">{row.title.replace("Session · ", "")} · {row.body}</p>)}
            </div>
          ) : null}
          {name === "Smart Browser" ? (
            data.query ? <a className="text-sm text-blue-2" href={`https://duckduckgo.com/?q=${encodeURIComponent(data.query)}`} target="_blank" rel="noreferrer">{data.query}</a> : <p className="text-sm text-white/40">Search on OmniSearch first. This only opens what was saved.</p>
          ) : null}
          {name === "Life Audit" ? (
            <div className="grid gap-1 text-sm">
              {[["Notes", data.notes.length], ["Tasks", data.tasks.length], ["Contacts", data.contacts.length], ["Mail", data.mail.length], ["Events", data.events.length], ["Leads", data.leads.length]].map((row) => (
                <p key={String(row[0])} className="flex justify-between border-b border-white/10 py-1"><span>{row[0]}</span><span className={row[1] === 0 ? "text-ember" : ""}>{row[1]}</span></p>
              ))}
              <button type="button" className="quiet is-on mt-2 w-fit" onClick={() => {
                setBusy(true);
                setNote("Auditing…");
                void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { name: "Audit", prompt: "Audit the saved board. Name what is empty, what is full, and one next action that uses a saved item. Do not invent records.", facts: boardFacts(data, "audit contacts tasks mail events"), question: "What is missing and what is the next real step?" } })).then((result) => { setNote(result.text || "No audit came back."); setBusy(false); });
              }}>{busy ? "Working" : "Audit"}</button>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex gap-4">
          <button type="button" className="quiet is-on" onClick={run}>Run</button>
          {name === "Alternate Life" ? <button type="button" className="quiet is-on" onClick={() => void simulate()}>{busy ? "Working" : "Simulate"}</button> : null}
          {name === "Dream Forge" ? <button type="button" className="quiet is-on" onClick={() => void forge()}>{busy ? "Working" : "Forge"}</button> : null}
          {name === "Dream Forge" && note.includes("{") ? <button type="button" className="quiet" onClick={takeTasks}>Add tasks</button> : null}
          {name === "Dark Card" ? <button type="button" className="quiet is-on" onClick={deal}>Deal</button> : null}
          {name === "Life RPG" ? <button type="button" className="quiet is-on" onClick={() => void readState()}>{busy ? "Working" : "Read state"}</button> : null}
          {note ? <button type="button" className="quiet" onClick={() => save(update, name, note)}>Save run</button> : null}
        </div>
        {alt ? (
          <div className="mt-4 grid gap-3 text-sm">
            <p>{alt.verdict} <span className="text-white/45">{alt.reason}</span></p>
            <p><span className="text-white/35">Now. </span>{alt.current}</p>
            <p><span className="text-white/35">Other path. </span>{alt.alternate}</p>
            {(alt.timeline || []).map((line) => <p key={line} className="text-white/70">{line}</p>)}
            {(alt.risks || []).map((line) => <p key={line} className="text-ember">{line}</p>)}
            {(alt.test || []).map((line) => <p key={line}>{line}</p>)}
            {alt.atlanta ? <p className="text-white/60">{alt.atlanta}</p> : null}
          </div>
        ) : <p className="mt-4 whitespace-pre-wrap text-sm">{note || saved || "Run it. It only uses what is already saved."}</p>}
      </section>
    </div>
  );
}
