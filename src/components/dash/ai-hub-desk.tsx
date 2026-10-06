import { useState } from "react";
import { newId, type Memory } from "./memory";
import { defaultVoice, voiceId, VOICES } from "./voices";
import { AGENT_SKILLS, matchedSkill, runAgentTool, skillBrief } from "./agent-tools";
import { boardFacts } from "./facts";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Section = "erebus" | "kranos" | "agents" | "hierarchy" | "models" | "hermes" | "qwen" | "messaging" | "workers" | "assignments" | "skills";

const GROUPS: { label: string; items: { id: Section; label: string }[] }[] = [
  { label: "Primary", items: [
    { id: "erebus", label: "Erebus" },
    { id: "kranos", label: "Kranos" },
    { id: "agents", label: "Agents" },
    { id: "hierarchy", label: "Hierarchy" },
  ] },
  { label: "Models", items: [
    { id: "models", label: "Models" },
    { id: "hermes", label: "Hermes" },
    { id: "qwen", label: "Qwen" },
  ] },
  { label: "Ops", items: [
    { id: "skills", label: "Skills" },
    { id: "messaging", label: "Telegram" },
    { id: "workers", label: "Workers" },
    { id: "assignments", label: "Assignments" },
  ] },
];

const field = "mt-1 min-h-16 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm";
const BUILT_SKINS = [
  { name: "Nova", note: "Clean circular window" },
  { name: "Nyx", note: "Darker window" },
  { name: "Ember", note: "Warm edge" },
];
const AVATARS = ["nova", "nyx", "ember"];

const ROSTER = [
  { name: "Zero", role: "Command Intelligence", tagline: "Tactical · Dark · Omniscient", avatar: "nyx", prompt: "You are Zero. Cold, tactical, no fluff. Serve Chris Green at LifeOS. Stay in character." },
  { name: "Inferno", role: "Sales Dominator", tagline: "Aggressive · Relentless · Fire", avatar: "ember", prompt: "You are Inferno. High energy closer. Destroy objections and drive action for Chris Green." },
  { name: "Nova", role: "Strategic Visionary", tagline: "Intuitive · Strategic · Wise", avatar: "nova", prompt: "You are Nova. Wise and precise. Connect patterns and guide long-term decisions for Chris Green." },
  { name: "Viper", role: "Data and Analytics", tagline: "Precise · Lethal · Calculated", avatar: "nova", prompt: "You are Viper. Surgical and data-driven. Facts, numbers, and a clear next step only." },
  { name: "Rage", role: "Execution Engine", tagline: "Unstoppable · Bold · Fearless", avatar: "ember", prompt: "You are Rage. Bold and relentless. Turn the problem into the next action for Chris Green." },
  { name: "Aurora", role: "Creative Director", tagline: "Elegant · Luminous · Creative", avatar: "nyx", prompt: "You are Aurora. Elegant creative director. Write polished copy and brand ideas for Chris Green." },
  { name: "Breeze", role: "Comms and Social", tagline: "Connected · Fluid · Always On", avatar: "nova", prompt: "You are Breeze. Fast social and comms operator. Keep replies short and ready to post." },
];

const CATALOG = [
  { id: "grok-4.5", name: "Grok", key: "xAI", note: "Default mind" },
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet", key: "Anthropic", note: "Writing and analysis" },
  { id: "claude-opus-4-20250514", name: "Claude Opus", key: "Anthropic", note: "Hard tasks" },
  { id: "gpt-4o", name: "GPT-4o", key: "OpenAI", note: "Vision and code" },
  { id: "gpt-4o-mini", name: "GPT-4o mini", key: "OpenAI", note: "Fast OpenAI" },
  { id: "gemini-2.0-flash", name: "Gemini Flash", key: "Gemini", note: "Google multimodal" },
  { id: "llama-3.3-70b-versatile", name: "Groq Llama 3.3", key: "Groq", note: "Fast open model" },
  { id: "deepseek-chat", name: "DeepSeek", key: "DeepSeek", note: "Reasoning and code" },
  { id: "mistral-large-latest", name: "Mistral Large", key: "Mistral", note: "European model" },
  { id: "openai/gpt-oss-20b", name: "NVIDIA gpt-oss", key: "NVIDIA", note: "Hosted open model" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "OpenRouter Llama", key: "OpenRouter", note: "Any routed model" },
];

function readChat(data: Memory, name: string) {
  const row = data.notes.find((item) => item.title === `Chat · ${name}`);
  try {
    const parsed = JSON.parse(row?.body || "[]") as { role?: string; text?: string }[];
    if (!Array.isArray(parsed)) return [] as { role: "user" | "ai"; text: string }[];
    return parsed.filter((item) => item?.text && (item.role === "user" || item.role === "ai")).slice(-24).map((item) => ({ role: item.role as "user" | "ai", text: String(item.text) }));
  } catch {
    return [] as { role: "user" | "ai"; text: string }[];
  }
}

function saveChat(update: Update, name: string, lines: { role: "user" | "ai"; text: string }[]) {
  update((prev) => ({
    ...prev,
    notes: [{ id: newId(), title: `Chat · ${name}`, body: JSON.stringify(lines.slice(-24)) }, ...prev.notes.filter((row) => row.title !== `Chat · ${name}`)],
  }));
}

function preferredModel(data: Memory) {
  return data.notes.find((row) => row.title === "Hub · Model")?.body.trim() || "grok-4.5";
}

function keyFor(data: Memory, modelId: string) {
  const row = CATALOG.find((item) => item.id === modelId);
  if (!row) return "";
  return data.keys.find((item) => item.name === row.key)?.value || "";
}

function readSkins(data: Memory) {
  const row = data.notes.find((item) => item.title === "Hub · Skins");
  try {
    const extra = JSON.parse(row?.body || "[]") as { name?: string; note?: string }[];
    const custom = Array.isArray(extra) ? extra.filter((item) => item?.name && !BUILT_SKINS.some((skin) => skin.name === item.name)).map((item) => ({ name: String(item.name), note: String(item.note || "") })) : [];
    return [...BUILT_SKINS, ...custom];
  } catch {
    return BUILT_SKINS;
  }
}

function readAgent(data: Memory, name: string) {
  const row = data.notes.find((item) => item.title === `Agent · ${name}`);
  const pick = (label: string) => row?.body.split("\n").find((line) => line.startsWith(label))?.slice(label.length).trim() || "";
  return {
    soul: pick("Soul: "),
    personality: pick("Personality: "),
    instructions: pick("Instructions: "),
    rules: pick("Rules: "),
    voice: pick("Voice: ") || defaultVoice(name),
    skin: pick("Skin: ") || "Nova",
    avatar: pick("Avatar: ") || "nova",
    task: data.jobs.find((job) => job.agent === name)?.task || "",
    active: Boolean(data.jobs.find((job) => job.agent === name)?.active),
  };
}

function saveAgent(update: Update, name: string, form: ReturnType<typeof readAgent>) {
  update((prev) => ({
    ...prev,
    notes: [{ id: newId(), title: `Agent · ${name}`, body: `Soul: ${form.soul}\nPersonality: ${form.personality}\nInstructions: ${form.instructions}\nRules: ${form.rules}\nVoice: ${form.voice}\nSkin: ${form.skin}\nAvatar: ${form.avatar}` }, ...prev.notes.filter((row) => row.title !== `Agent · ${name}`)],
    jobs: [{ id: newId(), agent: name, task: form.task.trim() || "Awaiting assignment", active: form.active }, ...prev.jobs.filter((row) => row.agent !== name)],
  }));
}

function Profile({ name, blurb, data, update }: { name: string; blurb: string; data: Memory; update: Update }) {
  const roster = ROSTER.find((agent) => agent.name === name);
  const saved = data.notes.some((row) => row.title === `Agent · ${name}`);
  const base = readAgent(data, name);
  const current = !saved && roster ? { ...base, soul: roster.tagline, personality: roster.role, instructions: roster.prompt, avatar: roster.avatar } : base;
  const [form, setForm] = useState(current);
  const [loaded, setLoaded] = useState(name);
  const [skinName, setSkinName] = useState("");
  const [skinNote, setSkinNote] = useState("");
  if (loaded !== name) { setLoaded(name); setForm(readAgent(data, name)); }
  const skins = readSkins(data);
  const clip = AVATARS.includes(form.avatar) ? `/agents/avatars/${form.avatar}.mp4` : "";
  return (
    <div>
      <h1 className="text-2xl">{name}</h1>
      <p className="text-sm text-white/50">{blurb}</p>
      <div className="mt-3 flex gap-4">
        <button type="button" className="quiet" onClick={() => setForm({ ...form, active: !form.active })}>{form.active ? "On" : "Off"}</button>
      </div>
      <p className="mb-2 mt-4 text-[10px] tracking-widest text-white/35">AVATAR</p>
      <div className="flex flex-wrap items-end gap-3">
        {AVATARS.map((avatar) => (
          <button key={avatar} type="button" className={`quiet ${form.avatar === avatar ? "is-on" : ""}`} onClick={() => setForm({ ...form, avatar })}>
            <video className="mb-1 h-16 w-full rounded-full object-cover" src={`/agents/avatars/${avatar}.mp4`} muted loop autoPlay playsInline />
            <span className="capitalize">{avatar}</span>
          </button>
        ))}
        {clip ? null : form.avatar ? <img src={form.avatar} alt="" className="h-16 w-16 rounded-full object-cover" /> : null}
      </div>
      <label className="mt-2 block text-[11px] uppercase tracking-wider text-white/40">Avatar URL
        <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm normal-case" placeholder="https://… image or video" value={AVATARS.includes(form.avatar) ? "" : form.avatar} onChange={(event) => setForm({ ...form, avatar: event.target.value.trim() || "nova" })} />
      </label>
      <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">SKIN</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {skins.map((skin) => <button key={skin.name} type="button" className={`quiet ${form.skin === skin.name ? "is-on" : ""}`} onClick={() => setForm({ ...form, skin: skin.name })}>{skin.name}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className="h-8 w-36 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="New skin" value={skinName} onChange={(event) => setSkinName(event.target.value)} />
        <input className="h-8 min-w-40 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="How it looks" value={skinNote} onChange={(event) => setSkinNote(event.target.value)} />
        <button type="button" className="quiet is-on" onClick={() => {
          const next = skinName.trim();
          if (!next) return;
          const custom = readSkins(data).filter((skin) => !BUILT_SKINS.some((item) => item.name === skin.name) && skin.name !== next);
          update((prev) => ({ ...prev, notes: [{ id: newId(), title: "Hub · Skins", body: JSON.stringify([...custom, { name: next, note: skinNote.trim() }]) }, ...prev.notes.filter((row) => row.title !== "Hub · Skins")] }));
          setForm({ ...form, skin: next });
          setSkinName("");
          setSkinNote("");
        }}>Create skin</button>
      </div>
      <p className="mt-1 text-[11px] text-white/35">{skins.find((skin) => skin.name === form.skin)?.note || "No look written for this skin."}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {VOICES.map((voice) => <button key={voice.id} type="button" className={`quiet ${form.voice === voice.id ? "is-on" : ""}`} onClick={() => setForm({ ...form, voice: voice.id })}>{voice.name}</button>)}
      </div>
      {(["soul", "personality", "instructions", "rules"] as const).map((key) => (
        <label key={key} className="mt-3 block text-[11px] uppercase tracking-wider text-white/40">{key}
          <textarea className={field} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
        </label>
      ))}
      <label className="mt-3 block text-[11px] uppercase tracking-wider text-white/40">Assignment
        <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={form.task} onChange={(event) => setForm({ ...form, task: event.target.value })} />
      </label>
      <button type="button" className="bg-blue mt-4" onClick={() => saveAgent(update, name, form)}>Save</button>
      <AgentChat name={name} prompt={form.instructions || blurb} voice={form.voice} data={data} update={update} />
    </div>
  );
}

function AgentChat({ name, prompt, voice, data, update }: { name: string; prompt: string; voice: string; data: Memory; update: Update }) {
  const stored = readChat(data, name);
  const [lines, setLines] = useState(stored);
  const [loaded, setLoaded] = useState(name);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  if (loaded !== name) { setLoaded(name); setLines(readChat(data, name)); setText(""); setNote(""); }
  const model = preferredModel(data);
  async function send() {
    const question = text.trim();
    if (!question) return;
    const next = [...lines, { role: "user" as const, text: question }];
    setLines(next);
    setText("");
    setNote("Thinking");
    const history = next.slice(-6).map((line) => `${line.role === "user" ? "User" : name}: ${line.text}`).join("\n");
    const tool = await runAgentTool(data, question);
    if (tool?.task) update((prev) => ({ ...prev, tasks: [{ id: newId(), title: tool.task || "", done: false }, ...prev.tasks] }));
    if (tool?.noteTitle) update((prev) => ({ ...prev, notes: [{ id: newId(), title: tool.noteTitle || "Note", body: tool.noteBody || "" }, ...prev.notes] }));
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({ data: { question, facts: [boardFacts(data, question), history, skillBrief(), matchedSkill(question), tool ? `Tool result:\n${tool.text}` : ""].filter(Boolean).join("\n\n"), name, prompt, model, key: keyFor(data, model) } });
    const reply = [tool?.text, result.text].filter(Boolean).join("\n\n") || "No reply. Save a key for this model, or check xAI / NVIDIA / OpenAI on the machine.";
    const done = [...next, { role: "ai" as const, text: reply }];
    setLines(done);
    setNote(result.ok ? result.mind : "Offline");
    saveChat(update, name, done);
  }
  async function hear(line: string) {
    const key = data.keys.find((row) => row.name === "ElevenLabs")?.value || "";
    try {
      const { speakVoice } = await import("@/lib/lifeos/sync");
      const result = await speakVoice({ data: { text: line.slice(0, 400), key, voice: voiceId(voice) } });
      if (result.ok && result.audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${result.audio}`);
        void audio.play();
        return;
      }
    } catch { /* browser voice below */ }
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    synth.speak(new SpeechSynthesisUtterance(line.slice(0, 400)));
  }
  return (
    <div className="mt-6 border-t border-white/10 pt-4">
      <p className="text-[10px] tracking-widest text-white/35">CHAT · {CATALOG.find((item) => item.id === model)?.name || model}</p>
      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {lines.map((line, index) => (
          <p key={`${line.role}-${index}`} className={`text-sm ${line.role === "user" ? "text-white/80" : "text-white/55"}`}>
            <span className="mr-2 text-[10px] uppercase tracking-wider text-white/35">{line.role === "user" ? "You" : name}</span>
            {line.text}
            {line.role === "ai" ? <button type="button" className="quiet ml-2" onClick={() => hear(line.text)}>Hear</button> : null}
          </p>
        ))}
        {!lines.length ? <p className="text-sm text-white/40">{name} is ready.</p> : null}
      </div>
      <div className="mt-3 flex gap-2">
        <input className="h-8 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={text} placeholder={`Message ${name}`} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} />
        <button type="button" className="quiet is-on" onClick={() => void send()}>Send</button>
      </div>
      {note ? <p className="mt-1 text-[11px] text-white/35">{note}</p> : null}
    </div>
  );
}

function Models({ data, update }: { data: Memory; update: Update }) {
  const active = preferredModel(data);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  function saveKey(name: string) {
    const value = (drafts[name] || "").trim();
    if (!value) return;
    update((prev) => ({ ...prev, keys: [{ id: newId(), name, value }, ...prev.keys.filter((row) => row.name !== name)] }));
    setDrafts((prev) => ({ ...prev, [name]: "" }));
  }
  return (
    <div>
      <h1 className="text-2xl">Models</h1>
      <p className="text-sm text-white/50">Pick the mind the agents use. A saved key is sent with the chat. If it is missing, the board falls back to xAI, NVIDIA, then OpenAI on this machine.</p>
      <div className="mt-4">
        {CATALOG.map((model) => {
          const saved = data.keys.find((row) => row.name === model.key)?.value || "";
          return (
            <div key={model.id} className="border-b border-white/10 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className={`quiet ${active === model.id ? "is-on" : ""}`} onClick={() => update((prev) => ({ ...prev, notes: [{ id: newId(), title: "Hub · Model", body: model.id }, ...prev.notes.filter((row) => row.title !== "Hub · Model")] }))}>
                  {model.name}
                  <span className="ml-2 text-[11px] text-white/40">{model.note} · {saved ? "Key saved" : "No key"}</span>
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder={`${model.key} key`} value={drafts[model.key] ?? ""} onChange={(event) => setDrafts((prev) => ({ ...prev, [model.key]: event.target.value }))} />
                <button type="button" className="quiet is-on" onClick={() => saveKey(model.key)}>Save key</button>
                {saved ? <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, keys: prev.keys.filter((row) => row.name !== model.key) }))}>Clear</button> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TelegramBox({ token }: { token: string }) {
  const [chat, setChat] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="text-sm text-white/50">Send one message. The token stays on the server call. It does not broadcast.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="quiet" onClick={() => {
          setNote("Checking the bot…");
          void import("@/lib/lifeos/sync").then(({ telegramBot }) => telegramBot({ data: { token } })).then((result) => setNote(result.ok ? `Connected ${result.bot}` : result.error));
        }}>Check bot</button>
        <input className="h-8 w-36 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Chat id" value={chat} onChange={(event) => setChat(event.target.value)} />
        <input className="h-8 min-w-40 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Message" value={text} onChange={(event) => setText(event.target.value)} />
        <button type="button" className="quiet is-on" onClick={() => {
          setNote("Sending…");
          void import("@/lib/lifeos/sync").then(({ telegramBot }) => telegramBot({ data: { token, chat, text } })).then((result) => setNote(result.ok ? "Sent." : result.error));
        }}>Send</button>
      </div>
      {note ? <p className="mt-2 text-sm text-white/70">{note}</p> : null}
    </div>
  );
}

export function HubDesk({ data, update }: { data: Memory; update: Update }) {
  const [section, setSection] = useState<Section>("erebus");
  const [draft, setDraft] = useState("");
  const [openAgent, setOpenAgent] = useState("");
  const custom = data.notes.filter((row) => row.title.startsWith("Agent ·")).map((row) => row.title.replace("Agent · ", "")).filter((name) => !["Erebus", "Kranos", "Telegram", "Hermes", "Qwen", ...ROSTER.map((agent) => agent.name)].includes(name));
  const workers = data.jobs.filter((row) => !["Erebus", "Kranos"].includes(row.agent));
  const nvidia = data.keys.some((row) => row.name === "NVIDIA" && row.value);
  const xai = data.keys.some((row) => row.name === "xAI" && row.value);
  const telegram = data.keys.some((row) => row.name === "Telegram" && row.value);

  return (
    <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[13rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">AI Hub</p>
        {GROUPS.map((group) => (
          <div key={group.label} className="mt-4">
            <p className="text-[10px] tracking-widest text-white/35">{group.label}</p>
            {group.items.map((item) => (
              <button key={item.id} type="button" className={`menu ${section === item.id ? "is-on" : ""}`} onClick={() => setSection(item.id)}>{item.label}</button>
            ))}
          </div>
        ))}
      </aside>
      <section className="module-card p-4">
        {section === "erebus" ? <Profile name="Erebus" blurb="Runs the board. The only agent that creates and edits." data={data} update={update} /> : null}
        {section === "kranos" ? <Profile name="Kranos" blurb="Takes direction from Erebus. Does not create files." data={data} update={update} /> : null}
        {section === "messaging" ? (
          <div>
            <Profile name="Telegram" blurb={telegram ? "Bot token is on this machine. It only sends and reads messages." : "No Telegram token on this machine. Settings still save."} data={data} update={update} />
            <TelegramBox token={data.keys.find((row) => row.name === "Telegram")?.value || ""} />
          </div>
        ) : null}
        {section === "hermes" ? <Profile name="Hermes" blurb={nvidia ? "NVIDIA key is ready. Hermes is the local model slot." : "NVIDIA key is not set. This is still the Hermes model slot."} data={data} update={update} /> : null}
        {section === "qwen" ? <Profile name="Qwen" blurb={xai ? "xAI key is ready. Qwen stays a separate model slot." : "xAI key is not set. Qwen stays a separate model slot."} data={data} update={update} /> : null}
        {section === "agents" ? (
          openAgent ? <div><button type="button" className="quiet" onClick={() => setOpenAgent("")}>Back</button><Profile name={openAgent} blurb={ROSTER.find((agent) => agent.name === openAgent)?.tagline || "Change the skin, voice, and rules without deleting this agent."} data={data} update={update} /></div> : (
          <div>
            <h1 className="text-2xl">Agents</h1>
            <p className="text-sm text-white/50">The crew stays. Open one to change avatar, skin, rules, and chat. Nothing is deleted to switch look.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ROSTER.map((agent) => {
                const row = readAgent(data, agent.name);
                return (
                  <button key={agent.name} type="button" className="menu text-left" onClick={() => setOpenAgent(agent.name)}>
                    <span className="block text-sm">{agent.name}</span>
                    <span className="block text-[11px] text-white/40">{agent.role} · {row.skin || "Nova"} · {row.active ? "On" : "Idle"}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-3">
              <input className="h-8 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={draft} placeholder="New agent name" onChange={(event) => setDraft(event.target.value)} />
              <button type="button" className="quiet is-on" onClick={() => { if (!draft.trim()) return; saveAgent(update, draft.trim(), { ...readAgent(data, draft.trim()), active: false }); setOpenAgent(draft.trim()); setDraft(""); }}>Add agent</button>
            </div>
            <div className="mt-4">
              {custom.map((name) => {
                const row = readAgent(data, name);
                return (
                  <div key={name} className="flex items-center justify-between border-b border-white/10 py-2 text-sm">
                    <button type="button" className="quiet" onClick={() => setOpenAgent(name)}>{name}<span className="ml-2 text-[11px] text-white/40">{row.skin} · {row.active ? "On" : "Off"}</span></button>
                    <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, notes: prev.notes.filter((item) => item.title !== `Agent · ${name}`), jobs: prev.jobs.filter((item) => item.agent !== name) }))}>Remove</button>
                  </div>
                );
              })}
            </div>
          </div>
          )
        ) : null}
        {section === "models" ? <Models data={data} update={update} /> : null}
        {section === "skills" ? (
          <div>
            <h1 className="text-2xl">Skills</h1>
            <p className="text-sm text-white/50">Live tools run from the dock and from any agent chat. The rest are listed so an agent cannot pretend they ran.</p>
            {["LifeApp", "Loaded", "Browser", "Code", "Data", "Finance", "Comms", "Workflow", "Media", "Sales", "Social", "Marketing", "Reasoning", "Content", "App skills"].map((group) => {
              const rows = AGENT_SKILLS.filter((row) => row.group === group);
              if (!rows.length) return null;
              return (
                <div key={group} className="mt-4">
                  <p className="text-[10px] tracking-widest text-white/35">{group}</p>
                  {rows.map((row) => (
                    <p key={row.id} className="mt-2 text-sm"><span className={row.live ? "text-green" : "text-white/35"}>{row.live ? "Live" : "Off"}</span> · {row.name}<span className="block text-[11px] text-white/40">{row.note}</span></p>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
        {section === "hierarchy" ? (
          <div>
            <h1 className="text-2xl">Hierarchy</h1>
            <p className="mt-1 text-sm text-white/50">Erebus directs Kranos. Kranos directs the workers and Telegram.</p>
            {["Erebus", "Kranos", "Telegram"].map((name, index) => (
              <p key={name} className="mt-3 text-sm" style={{ paddingLeft: index * 16 }}>{name}<span className="ml-2 text-white/40">{readAgent(data, name).task || "No assignment"}</span></p>
            ))}
            {workers.filter((row) => row.agent !== "Telegram").map((row) => <p key={row.id} className="mt-2 pl-8 text-sm text-white/70">{row.agent}<span className="ml-2 text-white/40">{row.task}</span></p>)}
          </div>
        ) : null}
        {section === "workers" ? (
          <div>
            <h1 className="text-2xl">Workers</h1>
            <p className="text-sm text-white/50">Cloudflare workers and anyone who is not Erebus or Kranos. Assign a preset, then turn it on.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {["Lead Scout", "Review Reply", "Invoice Chaser", "Social Scheduler", "Content AI"].map((name) => (
                <button key={name} type="button" className="quiet" onClick={() => saveAgent(update, name, { ...readAgent(data, name), task: readAgent(data, name).task || "Awaiting assignment", active: true })}>{workers.some((row) => row.agent === name) ? name : `Add ${name}`}</button>
              ))}
            </div>
            {workers.map((row) => (
              <div key={row.id} className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span>{row.agent}<span className="ml-2 text-white/40">{row.task}</span></span>
                <button type="button" className="quiet" onClick={() => update((prev) => ({ ...prev, jobs: prev.jobs.map((item) => item.id === row.id ? { ...item, active: !item.active } : item) }))}>{row.active ? "On" : "Off"}</button>
              </div>
            ))}
            {!workers.length ? <p className="mt-3 text-sm text-white/40">No workers assigned.</p> : null}
          </div>
        ) : null}
        {section === "assignments" ? (
          <div>
            <h1 className="text-2xl">Assignments</h1>
            <p className="text-sm text-white/50">Who has work, and whether it is on.</p>
            {data.jobs.map((row) => (
              <div key={row.id} className="mt-3 grid items-center gap-2 sm:grid-cols-[8rem_1fr_auto]">
                <span className="text-sm">{row.agent}</span>
                <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={row.task} onChange={(event) => update((prev) => ({ ...prev, jobs: prev.jobs.map((item) => item.id === row.id ? { ...item, task: event.target.value } : item) }))} />
                <button type="button" className={`quiet ${row.active ? "is-on" : ""}`} onClick={() => update((prev) => ({ ...prev, jobs: prev.jobs.map((item) => item.id === row.id ? { ...item, active: !item.active } : item) }))}>{row.active ? "Active" : "Idle"}</button>
              </div>
            ))}
            {!data.jobs.length ? <p className="mt-3 text-sm text-white/40">No assignments yet.</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
