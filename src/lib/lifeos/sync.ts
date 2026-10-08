import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { callTool } from "@/lib/app-data/client.server";
import { ConnectorType, GoogleCalendarTools } from "@/lib/app-data/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function device(value: string) {
  const id = String(value || "").trim();
  if (!UUID.test(id)) throw new Error("bad device");
  return id;
}

export const pullBoard = createServerFn({ method: "POST" })
  .validator((id: string) => device(id))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ payload: string; updated_at: string }>`
      select payload, updated_at from life_board where user_id = ${data}
    `;
    if (!rows[0]) return null;
    return { payload: rows[0].payload, at: new Date(rows[0].updated_at).getTime() };
  });

export const pushBoard = createServerFn({ method: "POST" })
  .validator((input: { device: string; payload: string }) => {
    const id = device(input?.device);
    const payload = String(input?.payload || "");
    if (payload.length > 900_000) throw new Error("Board is too large");
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    delete parsed.keys;
    delete parsed.vault;
    return { id, payload: JSON.stringify(parsed) };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into life_board (user_id, payload, updated_at)
      values (${data.id}, ${data.payload}, now())
      on conflict (user_id) do update
      set payload = excluded.payload, updated_at = now()
    `;
    return { ok: true as const, at: Date.now() };
  });

export const askNyx = createServerFn({ method: "POST" })
  .validator((input: { question: string; facts: string; mind?: string; name?: string; prompt?: string; key?: string; model?: string }) => {
    const question = String(input?.question || "").trim().slice(0, 4000);
    const facts = String(input?.facts || "").slice(0, 96_000);
    if (!question) throw new Error("question required");
    const mind = input?.mind === "nvidia" || input?.mind === "openai" ? input.mind : "grok";
    return {
      question,
      facts,
      mind,
      name: String(input?.name || "Nyx").slice(0, 24),
      prompt: String(input?.prompt || "").slice(0, 2400),
      key: String(input?.key || "").trim().slice(0, 400),
      model: String(input?.model || "").trim().slice(0, 80),
    };
  })
  .handler(async ({ data }) => {
    const system = data.prompt || `You are ${data.name}, the LifeOS assistant. Use only the facts given. If a fact is missing, say it is not on the board. Never invent names, balances, times, or lead statuses.`;
    const messages = [
      { role: "system", content: system },
      { role: "user", content: data.facts ? `Facts:\n${data.facts}\n\nQuestion: ${data.question}` : data.question },
    ];
    if (data.key && data.model) {
      const keyed = await askKeyed(data.model, data.key, messages);
      if (keyed) return { ok: true as const, text: keyed.slice(0, 6000), mind: data.model };
    }
    const order = [data.mind, "grok", "nvidia", "openai"].filter((mind, index, list) => list.indexOf(mind) === index);
    for (const mind of order) {
      const text = await askMind(mind, messages);
      if (text) return { ok: true as const, text: text.slice(0, 6000), mind };
    }
    return { ok: false as const, text: "", mind: data.mind };
  });

async function complete(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (!res.ok) return "";
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    content?: { text?: string }[];
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return json.choices?.[0]?.message?.content || json.content?.[0]?.text || json.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function askKeyed(model: string, key: string, messages: { role: string; content: string }[]) {
  try {
    const id = model.toLowerCase();
    const system = messages.find((row) => row.role === "system")?.content || "";
    const rest = messages.filter((row) => row.role !== "system");
    if (id.startsWith("claude")) {
      return await complete("https://api.anthropic.com/v1/messages", { "x-api-key": key, "anthropic-version": "2023-06-01" }, { model, max_tokens: 600, system, messages: rest });
    }
    if (id.startsWith("gemini")) {
      return await complete(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {}, {
        system_instruction: { parts: [{ text: system }] },
        contents: rest.map((row) => ({ role: row.role === "assistant" ? "model" : "user", parts: [{ text: row.content }] })),
      });
    }
    const openai = (url: string, picked = model) => complete(url, { Authorization: `Bearer ${key}` }, { model: picked, max_tokens: 600, temperature: 0.4, messages });
    if (id.includes("grok")) return await openai("https://api.x.ai/v1/chat/completions");
    if (id.startsWith("gpt") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4")) return await openai("https://api.openai.com/v1/chat/completions");
    if (id.startsWith("llama") || id.includes("groq")) return await openai("https://api.groq.com/openai/v1/chat/completions", id.includes("/") ? model : "llama-3.3-70b-versatile");
    if (id.startsWith("deepseek")) return await openai("https://api.deepseek.com/chat/completions");
    if (id.startsWith("mistral")) return await openai("https://api.mistral.ai/v1/chat/completions");
    if (id.includes("nvidia") || id.includes("nemotron") || id.startsWith("openai/")) return await openai("https://integrate.api.nvidia.com/v1/chat/completions");
    if (id.includes("/")) return await openai("https://openrouter.ai/api/v1/chat/completions");
    return "";
  } catch {
    return "";
  }
}

async function askMind(mind: string, messages: { role: string; content: string }[]) {
  try {
    if (mind === "nvidia") {
      const key = process.env.NVIDIA_API_KEY || process.env.NVAPI_KEY || "";
      if (!key) return "";
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "openai/gpt-oss-20b", max_tokens: 400, temperature: 0.3, messages }),
      });
      if (!res.ok) return "";
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content || "";
    }
    if (mind === "openai") {
      const key = process.env.OPENAI_API_KEY || "";
      if (!key) return "";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 400, temperature: 0.3, messages }),
      });
      if (!res.ok) return "";
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content || "";
    }
    const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY || "";
    if (!key) return "";
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "grok-4.5", max_tokens: 400, temperature: 0.3, messages }),
    });
    if (!res.ok) return "";
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

export const speakVoice = createServerFn({ method: "POST" })
  .validator((input: { text?: string; key?: string; voice?: string }) => ({
    text: String(input?.text || "").trim().slice(0, 500),
    key: String(input?.key || "").trim().slice(0, 400),
    voice: String(input?.voice || "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const key = data.key || process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
    const voice = data.voice || "EXAVITQu4vr4xnSDxMaL";
    if (!key || !data.text) return { ok: false as const, audio: "" };
    for (const model_id of ["eleven_turbo_v2_5", "eleven_multilingual_v2", "eleven_flash_v2_5"]) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: data.text, model_id }),
      });
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return { ok: true as const, audio: btoa(binary) };
    }
    return { ok: false as const, audio: "" };
  });

export const cloneVoice = createServerFn({ method: "POST" })
  .validator((input: { name?: string; audio?: string; type?: string; key?: string }) => ({
    name: String(input?.name || "").trim().slice(0, 40),
    audio: String(input?.audio || "").slice(0, 8_000_000),
    type: String(input?.type || "audio/mpeg").slice(0, 60),
    key: String(input?.key || "").trim().slice(0, 400),
  }))
  .handler(async ({ data }) => {
    const key = data.key || process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
    if (!key) return { ok: false as const, id: "", text: "No ElevenLabs key is saved." };
    if (!data.name || data.audio.length < 1000) return { ok: false as const, id: "", text: "Add a name and a clear audio sample." };
    const bytes = Uint8Array.from(atob(data.audio), (char) => char.charCodeAt(0));
    const form = new FormData();
    form.set("name", data.name);
    form.set("description", "LifeOS instant clone");
    const ext = data.type.includes("wav") ? "wav" : data.type.includes("mp4") || data.type.includes("m4a") ? "m4a" : "mp3";
    form.set("files", new Blob([bytes], { type: data.type || "audio/mpeg" }), `sample.${ext}`);
    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": key }, body: form });
    const body = await res.json().catch(() => ({})) as { voice_id?: string; detail?: { message?: string } | string };
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
    if (!res.ok || !body.voice_id) return { ok: false as const, id: "", text: detail || "ElevenLabs refused the clone. Instant cloning has to be on for this key." };
    return { ok: true as const, id: body.voice_id, text: "Clone ready." };
  });

function songSections(lyrics: string, style: string) {
  const styles = style.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 4);
  const positive = styles.length ? styles : ["studio recording", "clear lead vocal"];
  return lyrics.split(/\n(?=\[[^\]]+\])/).map((block) => block.trim()).filter(Boolean).slice(0, 6).map((block) => {
    const name = block.match(/^\[([^\]]+)\]/)?.[1] || "Verse";
    const lines = block.replace(/^\[[^\]]+\]\s*/, "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 10);
    return {
      section_name: name.slice(0, 40),
      positive_local_styles: positive,
      negative_local_styles: ["muddy mix", "off pitch", "spoken word"],
      duration_ms: /chorus|hook/i.test(name) ? 16000 : 14000,
      lines: lines.length ? lines : ["instrumental"],
    };
  });
}

export const composeSong = createServerFn({ method: "POST" })
  .validator((input: { title?: string; style?: string; lyrics?: string; instrumental?: boolean; key?: string; engine?: string; replicate?: string; job?: string }) => ({
    title: String(input?.title || "").trim().slice(0, 80),
    style: String(input?.style || "").trim().slice(0, 240),
    lyrics: String(input?.lyrics || "").trim().slice(0, 2500),
    instrumental: Boolean(input?.instrumental),
    key: String(input?.key || "").trim().slice(0, 400),
    engine: input?.engine === "ace" ? "ace" as const : "eleven" as const,
    replicate: String(input?.replicate || "").trim().slice(0, 400),
    job: String(input?.job || "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    if (data.engine === "ace") return aceSong(data);
    return elevenSong(data);
  });

async function audioBase64(url: string) {
  const file = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!file.ok) return "";
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 1000 || bytes.length > 8_000_000) return "";
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

async function secret(name: string, ...alts: string[]) {
  for (const key of [name, ...alts]) {
    const live = process.env[key]?.trim();
    if (live) return live;
  }
  const { envValue } = await import("@/lib/lifeos/env-keys");
  for (const key of [name, ...alts]) {
    const saved = (await envValue(key)).trim();
    if (saved) return saved;
  }
  return "";
}

async function aceSong(data: { style: string; lyrics: string; instrumental: boolean; replicate: string; job: string }) {
  const token = data.replicate || await secret("REPLICATE_API_TOKEN");
  if (!token) return { ok: false as const, audio: "", error: "Add a Replicate key. ACE-Step runs there.", job: "" };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const response = data.job
    ? await fetch(`https://api.replicate.com/v1/predictions/${data.job}`, { headers, signal: AbortSignal.timeout(20000) })
    : await fetch("https://api.replicate.com/v1/models/lucataco/ace-step/predictions", {
      method: "POST",
      headers: { ...headers, Prefer: "wait=50" },
      signal: AbortSignal.timeout(55000),
      body: JSON.stringify({
        input: {
          tags: data.style || "modern pop, polished, studio",
          lyrics: data.instrumental ? "[instrumental]" : data.lyrics || "[instrumental]",
          duration: 48,
          number_of_steps: 36,
          seed: -1,
        },
      }),
    });
  const body = await response.json().catch(() => ({})) as { id?: string; status?: string; output?: string | string[]; error?: string };
  const output = Array.isArray(body.output) ? body.output[0] : body.output;
  if (typeof output === "string" && /^https?:\/\//.test(output)) {
    const audio = await audioBase64(output);
    return audio
      ? { ok: true as const, audio, error: "", job: "" }
      : { ok: false as const, audio: "", error: "ACE-Step finished but the file could not be saved.", job: "" };
  }
  if (body.status === "starting" || body.status === "processing") {
    return { ok: false as const, audio: "", error: "ACE-Step is still recording. Press Create again.", job: body.id || data.job };
  }
  return { ok: false as const, audio: "", error: String(body.error || "ACE-Step did not make the song.").slice(0, 240), job: "" };
}

async function elevenSong(data: { title: string; style: string; lyrics: string; instrumental: boolean; key: string }) {
    const key = data.key || process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
    if (!key) return { ok: false as const, audio: "", error: "Add an ElevenLabs key. That is the song engine.", job: "" };
    const sections = data.instrumental ? [] : songSections(data.lyrics, data.style);
    const planned = !data.instrumental && sections.length ? {
      composition_plan: {
        positive_global_styles: [...data.style.split(",").map((part) => part.trim()).filter(Boolean), "polished studio mix", "radio vocal"].slice(0, 8),
        negative_global_styles: ["amateur recording", "muddy", "clipping", "monotone"],
        sections,
      },
    } : {
      prompt: `${data.instrumental ? "Instrumental only, no vocals. " : "Full song with a lead vocal singing the words. "}Studio quality, tight arrangement, ${data.style || "modern pop"}. Title: ${data.title}. ${data.lyrics}`.slice(0, 4000),
      music_length_ms: 48000,
      force_instrumental: data.instrumental,
    };
    async function call(body: Record<string, unknown>) {
      return fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ model_id: "music_v2_5", ...body }),
        signal: AbortSignal.timeout(55000),
      });
    }
    let response = await call(planned);
    if (!response.ok && "composition_plan" in planned) {
      response = await call({
        prompt: `Studio quality ${data.style || "pop"} song titled ${data.title}. A lead vocal sings these lyrics:\n${data.lyrics.slice(0, 1500)}`.slice(0, 4000),
        music_length_ms: 48000,
        force_instrumental: false,
      });
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false as const, audio: "", error: text.replace(/<[^>]+>/g, " ").slice(0, 240) || "ElevenLabs did not make the song.", job: "" };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 1000) return { ok: false as const, audio: "", error: "The song file came back empty.", job: "" };
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return { ok: true as const, audio: btoa(binary), error: "", job: "" };
}

export type DayEvent = { title: string; when: string };

export const pullCalendar = createServerFn({ method: "GET" }).handler(async () => {
  const start = new Date();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  try {
    const result = await callTool(
      GoogleCalendarTools.search,
      { time_min: start.toISOString(), time_max: end.toISOString(), max_results: 8 },
      { connectorType: ConnectorType.GoogleCalendar },
    );
    const items = Array.isArray(result.data) ? result.data : [];
    const events = items.slice(0, 8).map((row) => {
      const item = row as { summary?: string; start?: { dateTime?: string; date?: string } };
      return { title: item.summary || "Event", when: item.start?.dateTime || item.start?.date || start.toISOString() };
    });
    if (!result.ok) return { events: [] as DayEvent[], note: result.errorMessage || "Calendar is not connected." };
    return { events, note: events.length ? "Today's calendar" : "No events today." };
  } catch {
    return { events: [] as DayEvent[], note: "Calendar is not connected." };
  }
});

export const googleCalendar = createServerFn({ method: "POST" })
  .validator((input: { token?: string; action?: string; id?: string; title?: string; date?: string; start?: string; end?: string; where?: string; who?: string; remind?: boolean }) => ({
    token: String(input?.token || "").trim().slice(0, 4000),
    action: input?.action === "create" || input?.action === "update" || input?.action === "delete" ? input.action : "list",
    id: String(input?.id || "").replace(/^gcal:/, "").slice(0, 220),
    title: String(input?.title || "").trim().slice(0, 180),
    date: String(input?.date || "").slice(0, 10),
    start: String(input?.start || "09:00").slice(0, 5),
    end: String(input?.end || "10:00").slice(0, 5),
    where: String(input?.where || "").trim().slice(0, 180),
    who: String(input?.who || "").trim().slice(0, 180),
    remind: Boolean(input?.remind),
  }))
  .handler(async ({ data }) => {
    if (!data.token) return { ok: false as const, error: "Reconnect Google in Integrations so the calendar can be read and written.", events: [] as { id: string; title: string; date: string; start: string; end: string; where: string; who: string }[], id: "" };
    const headers = { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" };
    const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const refused = "Reconnect Google in Integrations. The old login can only read the calendar.";
    if (data.action === "list") {
      const min = new Date(Date.now() - 30 * 86400000).toISOString();
      const max = new Date(Date.now() + 180 * 86400000).toISOString();
      const response = await fetch(`${base}?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}`, { headers });
      const body = await response.json() as { items?: { id?: string; summary?: string; location?: string; description?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[]; error?: { message?: string } };
      if (!response.ok) return { ok: false as const, error: response.status === 403 ? refused : body.error?.message || "Google Calendar refused the session.", events: [], id: "" };
      const events = (body.items || []).map((item) => {
        const start = item.start?.dateTime || "";
        const end = item.end?.dateTime || "";
        return {
          id: `gcal:${item.id || ""}`,
          title: item.summary || "Event",
          date: (start || item.start?.date || "").slice(0, 10),
          start: start.slice(11, 16),
          end: end.slice(11, 16),
          where: item.location || "",
          who: item.description || "",
        };
      }).filter((item) => item.id !== "gcal:" && item.date);
      return { ok: true as const, error: "", events, id: "" };
    }
    if (data.action === "delete") {
      if (!data.id) return { ok: false as const, error: "That event is only on this board.", events: [], id: "" };
      const response = await fetch(`${base}/${encodeURIComponent(data.id)}`, { method: "DELETE", headers });
      if (!response.ok && response.status !== 204 && response.status !== 410) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
        return { ok: false as const, error: response.status === 403 ? refused : body.error?.message || "Google Calendar did not delete it.", events: [], id: "" };
      }
      return { ok: true as const, error: "", events: [], id: data.id };
    }
    const zone = "America/New_York";
    const payload = {
      summary: data.title,
      location: data.where,
      description: data.who,
      start: { dateTime: `${data.date}T${data.start || "09:00"}:00`, timeZone: zone },
      end: { dateTime: `${data.date}T${data.end || "10:00"}:00`, timeZone: zone },
      reminders: data.remind ? { useDefault: true } : { useDefault: false },
    };
    const update = data.action === "update" && data.id;
    const response = await fetch(update ? `${base}/${encodeURIComponent(data.id)}` : base, {
      method: update ? "PATCH" : "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const body = await response.json() as { id?: string; error?: { message?: string } };
    if (!response.ok || !body.id) return { ok: false as const, error: response.status === 403 ? refused : body.error?.message || "Google Calendar did not save it.", events: [], id: "" };
    return { ok: true as const, error: "", events: [], id: `gcal:${body.id}` };
  });

export const makePicture = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; key?: string }) => ({
    prompt: String(input?.prompt || "").trim().slice(0, 500),
    key: String(input?.key || "").trim().slice(0, 400),
  }))
  .handler(async ({ data }) => {
    const apiKey = data.key || process.env.XAI_API_KEY || process.env.GROK_API_KEY || "";
    if (!apiKey || !data.prompt) return { ok: false as const, url: "", error: apiKey ? "Prompt required." : "Add an xAI key in Integrations." };
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "grok-2-image", prompt: data.prompt, n: 1 }),
    });
    if (!res.ok) return { ok: false as const, url: "", error: "xAI did not return an image." };
    const body = (await res.json()) as { data?: { url?: string }[] };
    const url = body.data?.[0]?.url || "";
    return { ok: Boolean(url), url, error: url ? "" : "No image URL came back." };
  });

export const editPicture = createServerFn({ method: "POST" })
  .validator((input: { prompt?: string; image?: string; key?: string; id?: string }) => ({
    prompt: String(input?.prompt || "").trim().slice(0, 800),
    image: String(input?.image || "").trim().slice(0, 2000),
    key: String(input?.key || "").trim().slice(0, 400),
    id: String(input?.id || "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const key = data.key || await secret("REPLICATE_API_TOKEN");
    if (!key) return { ok: false as const, url: "", id: "", state: "failed", error: "Add a Replicate key to edit an image from a prompt." };
    let id = data.id;
    if (!id) {
      if (!data.prompt) return { ok: false as const, url: "", id: "", state: "failed", error: "Write what should change." };
      if (!/^https:\/\//.test(data.image)) return { ok: false as const, url: "", id: "", state: "failed", error: "The image needs a public https link." };
      const started = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "wait=5" },
        body: JSON.stringify({ input: { prompt: data.prompt, input_image: data.image, aspect_ratio: "match_input_image", output_format: "jpg" } }),
      });
      const created = await started.json().catch(() => null) as { id?: string; status?: string; output?: string; error?: string; detail?: string } | null;
      if (!started.ok || !created?.id) return { ok: false as const, url: "", id: "", state: "failed", error: created?.error || created?.detail || "The image edit did not start." };
      id = created.id;
      if (created.status === "succeeded" && created.output) return { ok: true as const, url: String(created.output), id, state: "completed", error: "" };
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: { Authorization: `Bearer ${key}` } });
      const job = await status.json().catch(() => null) as { status?: string; output?: string | string[]; error?: string } | null;
      const url = Array.isArray(job?.output) ? job.output[0] : job?.output || "";
      if (job?.status === "succeeded" && url) return { ok: true as const, url: String(url), id, state: "completed", error: "" };
      if (job?.status === "failed" || job?.status === "canceled") return { ok: false as const, url: "", id, state: "failed", error: job?.error || "The image edit failed." };
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    return { ok: true as const, url: "", id, state: "dreaming", error: "" };
  });

export const freeImage = createServerFn({ method: "POST" })
  .validator((input: { prompt?: string; account?: string; token?: string }) => ({
    prompt: String(input?.prompt || "").trim().slice(0, 500),
    account: String(input?.account || "").trim().slice(0, 40),
    token: String(input?.token || "").trim().slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const account = data.account || process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "";
    const token = data.token || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "";
    if (!account || !token || !data.prompt) return { ok: false as const, url: "", error: "no-cf" };
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: data.prompt }),
      signal: AbortSignal.timeout(25000),
    });
    const body = await res.json().catch(() => null) as { result?: { image?: string }; errors?: { message?: string }[] } | null;
    const image = body?.result?.image || "";
    if (!res.ok || !image) return { ok: false as const, url: "", error: body?.errors?.[0]?.message || "Workers AI did not return an image." };
    return { ok: true as const, url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`, error: "" };
  });

export const wanClip = createServerFn({ method: "POST" })
  .validator((input: { prompt?: string; image?: string; key?: string; id?: string; aspect?: string }) => ({
    prompt: String(input?.prompt || "").trim().slice(0, 500),
    image: String(input?.image || "").trim().slice(0, 2000),
    key: String(input?.key || "").trim().slice(0, 400),
    id: String(input?.id || "").trim().slice(0, 80),
    aspect: ["16:9", "9:16", "1:1"].includes(String(input?.aspect || "")) ? String(input?.aspect) : "16:9",
  }))
  .handler(async ({ data }) => {
    const key = data.key || await secret("REPLICATE_API_TOKEN");
    if (!key) return { ok: false as const, url: "", id: "", state: "failed", error: "Add a Replicate key in Integrations. Wan runs there." };
    let id = data.id;
    if (!id) {
      if (!/^https:\/\//.test(data.image)) return { ok: false as const, url: "", id: "", state: "failed", error: "Wan needs an https image." };
      const started = await fetch("https://api.replicate.com/v1/models/wan-video/wan-2.2-i2v-fast/predictions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "wait=5" },
        body: JSON.stringify({ input: { prompt: data.prompt || "subtle natural motion", image: data.image, aspect_ratio: data.aspect, go_fast: true, num_frames: 81, resolution: "480p" } }),
      });
      const created = await started.json().catch(() => null) as { id?: string; status?: string; output?: string; error?: string; detail?: string } | null;
      if (!started.ok || !created?.id) return { ok: false as const, url: "", id: "", state: "failed", error: created?.error || created?.detail || "Wan did not start." };
      id = created.id;
      if (created.status === "succeeded" && created.output) return { ok: true as const, url: String(created.output), id, state: "completed", error: "" };
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await fetch(`https://api.replicate.com/v1/predictions/${id}`, { headers: { Authorization: `Bearer ${key}` } });
      const job = await status.json().catch(() => null) as { status?: string; output?: string | string[]; error?: string } | null;
      const url = Array.isArray(job?.output) ? job?.output[0] : job?.output || "";
      if (job?.status === "succeeded" && url) return { ok: true as const, url: String(url), id, state: "completed", error: "" };
      if (job?.status === "failed" || job?.status === "canceled") return { ok: false as const, url: "", id, state: "failed", error: job?.error || "Wan failed the clip." };
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    return { ok: true as const, url: "", id, state: "dreaming", error: "" };
  });

async function lumaFetch(key: string, path: string, init?: RequestInit) {
  return fetch(`https://api.lumalabs.ai/dream-machine/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
  });
}

export const makeClip = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; key?: string; id?: string; image?: string; aspect?: string; model?: string; duration?: string }) => ({
    prompt: String(input?.prompt || "").trim().slice(0, 800),
    key: String(input?.key || "").trim().slice(0, 400),
    id: String(input?.id || "").trim().slice(0, 80),
    image: String(input?.image || "").trim().slice(0, 2000),
    aspect: ["16:9", "9:16", "1:1", "4:3", "3:4"].includes(String(input?.aspect || "")) ? String(input?.aspect) : "16:9",
    model: String(input?.model || "") === "ray-flash-2" ? "ray-flash-2" : "ray-2",
    duration: String(input?.duration || "") === "5s" ? "5s" : "9s",
  }))
  .handler(async ({ data }) => {
    const key = data.key || await secret("LUMA_API_KEY", "VITE_LUMA_API_KEY");
    if (!key) return { ok: false as const, url: "", id: "", state: "failed", error: "Add a Luma key in Integrations." };
    let id = data.id;
    if (!id) {
      if (!data.prompt && !data.image) return { ok: false as const, url: "", id: "", state: "failed", error: "Prompt required." };
      const frame = /^https:\/\//.test(data.image) ? { keyframes: { frame0: { type: "image", url: data.image } } } : {};
      const started = await lumaFetch(key, "/generations", {
        method: "POST",
        body: JSON.stringify({ prompt: data.prompt || "Cinematic motion, sharp detail, natural light.", model: data.model, resolution: "720p", duration: data.duration, aspect_ratio: data.aspect, ...frame }),
      });
      const created = await started.json() as { id?: string; detail?: string; failure_reason?: string };
      if (!started.ok || !created.id) return { ok: false as const, url: "", id: "", state: "failed", error: created.detail || created.failure_reason || "Luma did not start the video." };
      id = created.id;
    }
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const status = await lumaFetch(key, `/generations/${id}`);
      const job = await status.json() as { state?: string; assets?: { video?: string }; failure_reason?: string };
      const url = job.assets?.video || "";
      if (job.state === "completed" && url) return { ok: true as const, url, id, state: "completed", error: "" };
      if (job.state === "failed") return { ok: false as const, url: "", id, state: "failed", error: job.failure_reason || "Luma failed the video." };
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    return { ok: true as const, url: "", id, state: "dreaming", error: "" };
  });

type SearchHit = { title: string; url: string; snippet: string };

function searchText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&/g, "&").replace(/"/g, '"').replace(/&#39;|'/g, "'").replace(/</g, "<").replace(/>/g, ">").replace(/\s+/g, " ").trim();
}

function duckLink(href: string) {
  const raw = href.replace(/&/g, "&");
  try {
    const url = new URL(raw, "https://duckduckgo.com");
    return url.searchParams.get("uddg") || (raw.startsWith("http") ? raw : "");
  } catch {
    return "";
  }
}

async function readJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "LifeOS/1.0", Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function duckResults(query: string, limit = 8): Promise<SearchHit[]> {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\//gi)].map((match) => searchText(match[1]));
    const hits: SearchHit[] = [];
    for (const match of html.matchAll(/<a\b([^>]*class="[^"]*result__a[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = duckLink(match[1].match(/href="([^"]+)"/i)?.[1] || "");
      const title = searchText(match[2]);
      if (!title || !/^https?:/i.test(href)) continue;
      hits.push({ title: title.slice(0, 160), url: href.slice(0, 400), snippet: `DuckDuckGo · ${(snippets[hits.length] || "").slice(0, 180)}` });
      if (hits.length >= limit) break;
    }
    return hits;
  } catch {
    return [];
  }
}

async function engineHits(url: string, source: string, limit = 4): Promise<SearchHit[]> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const hits: SearchHit[] = [];
    const seen = new Set<string>();
    for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      let next = match[1].replace(/&/g, "&");
      try {
        const parsed = new URL(next, url);
        const wrapped = parsed.searchParams.get("uddg") || parsed.searchParams.get("RU") || parsed.searchParams.get("u") || parsed.searchParams.get("q") || "";
        if (/^https?:/i.test(wrapped) && !/bing\.com$/i.test(parsed.hostname)) next = decodeURIComponent(wrapped);
        else if (/bing\.com$/i.test(parsed.hostname) && parsed.searchParams.get("u")) {
          const coded = (parsed.searchParams.get("u") || "").replace(/^a1/, "");
          const decoded = atob(coded);
          next = decoded.startsWith("http") ? decoded : parsed.href;
        } else next = parsed.href;
      } catch {
        continue;
      }
      if (!/^https?:\/\//i.test(next) || /google\.[^/]+\/(search|sorry)|bing\.com|search\.yahoo|dogpile\.com|search\.brave|accounts\.google|gstatic|schema\.org/i.test(next)) continue;
      const title = searchText(match[2]);
      if (title.length < 6 || seen.has(next)) continue;
      seen.add(next);
      hits.push({ title: title.slice(0, 160), url: next.slice(0, 400), snippet: source });
      if (hits.length >= limit) break;
    }
    return hits;
  } catch {
    return [];
  }
}

async function dogpileHits(query: string, key: string): Promise<{ hits: SearchHit[]; note: string }> {
  const { envValue } = await import("@/lib/lifeos/env-keys");
  const token = key || process.env.DOGPILE_API_KEY || await envValue("DOGPILE_API_KEY");
  if (!token) return { hits: [], note: "" };
  const base = (process.env.DOGPILE_API_URL || "https://developer.dogpile.com").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/api/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, depth: "basic" }),
      signal: AbortSignal.timeout(12000),
    });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : `Dogpile refused the key (${response.status}).`;
      return { hits: [], note: message };
    }
    const piles = [body.results, body.organic_results, (body.web as { results?: unknown } | undefined)?.results, (body.data as { results?: unknown } | undefined)?.results];
    const list = (piles.find(Array.isArray) || []) as Record<string, unknown>[];
    const hits = list.slice(0, 10).map((row) => {
      const title = String(row.title || row.name || "Result");
      const url = String(row.url || row.link || row.href || "");
      const snippet = String(row.snippet || row.description || row.content || row.text || "").replace(/\s+/g, " ").slice(0, 220);
      return { title: title.slice(0, 160), url: url.slice(0, 400), snippet: `Dogpile · ${snippet}` };
    }).filter((row) => /^https?:/i.test(row.url));
    return { hits, note: hits.length ? "" : "Dogpile answered, but there were no result links." };
  } catch {
    return { hits: [], note: "Dogpile did not answer." };
  }
}

function socialHits(query: string) {
  const sites: [string, string][] = [["facebook.com", "Facebook"], ["instagram.com", "Instagram"], ["snapchat.com", "Snapchat"], ["tiktok.com", "TikTok"], ["linkedin.com", "LinkedIn"]];
  return Promise.all(sites.map(async ([site, name]) => (await duckResults(`${query} site:${site}`, 2)).map((row) => ({ ...row, snippet: `${name} · ${row.snippet.replace(/^DuckDuckGo · /, "")}` }))));
}

function keepHits(groups: SearchHit[][]) {
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const group of groups) {
    for (const hit of group) {
      if (!hit.title || !hit.url || seen.has(hit.url)) continue;
      seen.add(hit.url);
      hits.push(hit);
      if (hits.length >= 40) return hits;
    }
  }
  return hits;
}

async function searxHits(query: string, categories: string, base: string): Promise<{ hits: SearchHit[]; note: string }> {
  const root = (base || process.env.SEARXNG_URL || "http://127.0.0.1:8888").replace(/\/$/, "");
  try {
    const response = await fetch(`${root}/search?q=${encodeURIComponent(query)}&format=json&language=en&categories=${encodeURIComponent(categories)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    const raw = await response.text();
    if (!response.ok || raw.trim().startsWith("<")) {
      return { hits: [], note: `SearXNG at ${root} did not return JSON.` };
    }
    const body = JSON.parse(raw) as { results?: { title?: string; url?: string; content?: string; engine?: string; engines?: string[] }[] };
    const hits = (body.results || []).slice(0, 20).map((row) => {
      const engines = (row.engines || []).filter(Boolean);
      const via = engines.length ? engines.slice(0, 3).join(", ") : row.engine || "SearXNG";
      return {
        title: String(row.title || "Result").slice(0, 160),
        url: String(row.url || "").slice(0, 400),
        snippet: `${via} · ${String(row.content || "").replace(/\s+/g, " ").slice(0, 180)}`,
      };
    }).filter((row) => /^https?:/i.test(row.url));
    return { hits, note: hits.length ? `SearXNG · ${hits.length} results` : "SearXNG answered with no results." };
  } catch {
    return { hits: [], note: `SearXNG is not running at ${root}. Use port 8888. The dashboard already uses 8080.` };
  }
}

export const lookup = createServerFn({ method: "POST" })
  .validator((input: string | { query?: string; kind?: string; key?: string; brave?: string; base?: string }) => {
    const raw = typeof input === "string" ? { query: input, kind: "web", key: "", brave: "", base: "" } : input;
    const kind = raw?.kind === "phone" || raw?.kind === "email" || raw?.kind === "image" ? raw.kind : "web";
    return {
      query: String(raw?.query || "").trim().slice(0, 180),
      kind,
      key: String(raw?.key || "").trim().slice(0, 400),
      brave: String(raw?.brave || "").trim().slice(0, 400),
      base: String(raw?.base || "").trim().slice(0, 200),
    };
  })
  .handler(async ({ data }) => {
    const query = data.query;
    if (!query) return { hits: [] as SearchHit[], note: "" };
    if (data.kind === "email" && !query.includes("@")) return { hits: [] as SearchHit[], note: "Enter a full email." };
    const digits = query.replace(/\D/g, "");
    if (data.kind === "phone" && digits.length < 7) return { hits: [] as SearchHit[], note: "Enter a full phone number." };
    const webQuery = data.kind === "phone" ? digits : query;
    const categories = data.kind === "image" ? "images" : "general";
    const searx = await searxHits(webQuery, categories, data.base);
    if (searx.hits.length) return { hits: searx.hits, note: searx.note };

    const encoded = encodeURIComponent(webQuery);
    const dogpile = await dogpileHits(webQuery, data.key);
    const [duck, google, bing, yahoo, social, wiki, wikiData, reddit, news, archive, books, places, apple, code, answers] = await Promise.all([
      duckResults(data.kind === "web" ? query : `"${webQuery}"`, 6),
      engineHits(`https://www.google.com/search?q=${encoded}&gbv=1&hl=en`, "Google", 4),
      engineHits(`https://www.bing.com/search?q=${encoded}`, "Bing", 4),
      engineHits(`https://search.yahoo.com/search?p=${encoded}`, "Yahoo", 4),
      socialHits(webQuery),
      readJson<[string, string[], string[], string[]]>(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=4&namespace=0&format=json`),
      readJson<{ search?: { label?: string; description?: string; concepturi?: string }[] }>(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=4`),
      readJson<{ data?: { children?: { data?: { title?: string; permalink?: string; selftext?: string; subreddit?: string } }[] } }>(`https://www.reddit.com/search.json?q=${encodeURIComponent(webQuery)}&limit=4&sort=relevance`, { "User-Agent": "LifeOS/1.0" }),
      readJson<{ hits?: { title?: string; url?: string; objectID?: string }[] }>(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=4`),
      readJson<{ response?: { docs?: { identifier?: string; title?: string }[] } }>(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&rows=3&page=1&output=json`),
      readJson<{ docs?: { title?: string; author_name?: string[]; key?: string }[] }>(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3`),
      readJson<{ display_name?: string; lat?: string; lon?: string }[]>(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=2`, { "User-Agent": "LifeOS/1.0 (personal dashboard)" }),
      readJson<{ results?: { trackName?: string; artistName?: string; collectionViewUrl?: string; artworkUrl100?: string }[] }>(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=3`),
      readJson<{ items?: { full_name?: string; html_url?: string; description?: string }[] }>(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=3`, { Accept: "application/vnd.github+json" }),
      readJson<{ items?: { title?: string; link?: string }[] }>(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=3`),
    ]);

    const groups: SearchHit[][] = [
      dogpile.hits,
      google,
      bing,
      yahoo,
      ...social,
      duck,
      (wiki?.[1] || []).map((title, index) => ({ title, url: wiki?.[3]?.[index] || "", snippet: `Wikipedia · ${wiki?.[2]?.[index] || ""}` })),
      (wikiData?.search || []).map((row) => ({ title: row.label || "Wikidata", url: row.concepturi || "", snippet: `Wikidata · ${row.description || ""}` })),
      (reddit?.data?.children || []).map((row) => ({ title: row.data?.title || "Reddit", url: row.data?.permalink ? `https://www.reddit.com${row.data.permalink}` : "", snippet: `Reddit · r/${row.data?.subreddit || ""} ${(row.data?.selftext || "").slice(0, 140)}` })),
      (news?.hits || []).map((row) => ({ title: row.title || "Hacker News", url: row.url || (row.objectID ? `https://news.ycombinator.com/item?id=${row.objectID}` : ""), snippet: "Hacker News" })),
      (archive?.response?.docs || []).map((row) => ({ title: row.title || "Internet Archive", url: row.identifier ? `https://archive.org/details/${row.identifier}` : "", snippet: "Internet Archive" })),
      (books?.docs || []).map((row) => ({ title: row.title || "Open Library", url: row.key ? `https://openlibrary.org${row.key}` : "", snippet: `Open Library · ${(row.author_name || []).slice(0, 2).join(", ")}` })),
      (Array.isArray(places) ? places : []).map((row) => ({ title: row.display_name || "Place", url: row.lat && row.lon ? `https://www.openstreetmap.org/?mlat=${row.lat}&mlon=${row.lon}` : "", snippet: "OpenStreetMap" })),
      (apple?.results || []).map((row) => ({ title: row.trackName || "Apple", url: row.collectionViewUrl || "", snippet: `Apple · ${row.artistName || ""}` })),
      (code?.items || []).map((row) => ({ title: row.full_name || "GitHub", url: row.html_url || "", snippet: `GitHub · ${row.description || ""}` })),
      (answers?.items || []).map((row) => ({ title: row.title || "Stack Overflow", url: row.link || "", snippet: "Stack Overflow" })),
    ];

    if (data.kind === "email") {
      const { createHash } = await import("node:crypto");
      const hash = createHash("md5").update(query.toLowerCase()).digest("hex");
      const gravatar = await readJson<{ entry?: { displayName?: string; aboutMe?: string; profileUrl?: string; name?: { formatted?: string } }[] }>(`https://en.gravatar.com/${hash}.json`);
      const person = gravatar?.entry?.[0];
      if (person?.profileUrl) groups.unshift([{ title: person.displayName || person.name?.formatted || query, url: person.profileUrl, snippet: `Gravatar · ${person.aboutMe || "Profile for this email"}` }]);
      const users = await readJson<{ items?: { login?: string; html_url?: string }[] }>(`https://api.github.com/search/users?q=${encodeURIComponent(`${query} in:email`)}&per_page=3`, { Accept: "application/vnd.github+json" });
      groups.push((users?.items || []).map((row) => ({ title: row.login || "GitHub user", url: row.html_url || "", snippet: "GitHub · email match" })));
      groups.push(await duckResults(`"${query}" site:linkedin.com`, 3));
    }
    if (data.kind === "phone") {
      const pretty = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length > 10 ? digits.slice(-10) : digits;
      const shown = pretty.length === 10 ? `(${pretty.slice(0, 3)}) ${pretty.slice(3, 6)}-${pretty.slice(6)}` : query;
      groups.unshift([{ title: shown, url: `tel:${pretty}`, snippet: "Number" }]);
      groups.push(await duckResults(`"${shown}"`, 3));
      groups.push(await duckResults(`"${pretty}" site:linkedin.com`, 2));
    }

    const hits = keepHits(groups);
    const missing = data.key || process.env.DOGPILE_API_KEY ? "" : "Add the Dogpile key in Integrations for live results.";
    return { hits, note: [searx.note, dogpile.note, hits.length ? "" : missing || "Nothing came back from the public sources."].filter(Boolean).join(" ") };
  });

export const inspectSite = createServerFn({ method: "POST" })
  .validator((url: string) => {
    const value = String(url || "").trim();
    if (!/^https?:\/\//i.test(value)) throw new Error("Use a full http URL");
    return value.slice(0, 300);
  })
  .handler(async ({ data }) => {
    const res = await fetch(data, { redirect: "follow", headers: { "User-Agent": "LifeOS/1" } });
    const html = (await res.text()).slice(0, 200_000);
    const title = html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() || "";
    const description = html.match(/name=["']description["'][^>]*content=["']([^"']*)/i)?.[1]
      || html.match(/content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1]
      || "";
    const h1 = (html.match(/<h1\b/gi) || []).length;
    return { ok: res.ok, status: res.status, title: title.slice(0, 140), description: description.slice(0, 200), h1 };
  });

function effortOf(title: string) {
  return /survey|cashback|beer money|beermoney|microtask|swagbucks|user testing|print on demand|affiliate|template|digital download|gpt|flip/i.test(title) ? "low" as const : "medium" as const;
}

export const findPictures = createServerFn({ method: "POST" })
  .validator((input: { query?: string; kind?: string }) => ({
    query: String(input?.query || "").trim().slice(0, 80),
    kind: input?.kind === "gif" ? "gif" : "photo",
  }))
  .handler(async ({ data }) => {
    const empty = [] as { title: string; url: string; thumb: string; page: string }[];
    if (!data.query) return { images: empty };
    const signal = AbortSignal.timeout(8000);
    const headers = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
    const home = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(data.query)}&iax=images&ia=images`, { headers, signal }).catch(() => null);
    const html = home ? await home.text() : "";
    const token = html.match(/vqd="([^"]+)"/)?.[1] || html.match(/vqd=([\d-]+)/)?.[1] || "";
    if (!token) return { images: empty };
    const filter = data.kind === "gif" ? "type:gif" : "type:photo";
    const result = await fetch(`https://duckduckgo.com/i.js?o=json&l=us-en&q=${encodeURIComponent(data.query)}&vqd=${encodeURIComponent(token)}&f=,,,${filter}&p=1`, { headers: { ...headers, Referer: "https://duckduckgo.com/" }, signal }).catch(() => null);
    if (!result?.ok) return { images: empty };
    const body = await result.json() as { results?: { title?: string; image?: string; thumbnail?: string; url?: string }[] };
    const images = (body.results || []).slice(0, 36).map((row) => ({
      title: String(row.title || "Image").slice(0, 120),
      url: String(row.image || ""),
      thumb: String(row.thumbnail || row.image || ""),
      page: String(row.url || ""),
    })).filter((row) => /^https?:/i.test(row.url));
    return { images };
  });

async function visualMatches(pageUrl: string, source: string, original: string) {
  try {
    const response = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const found = new Set<string>();
    const images: { title: string; url: string; thumb: string }[] = [];
    const patterns = [/murl":"(https:[^&"]+)/g, /"murl":"(https:[^"]+)"/g, /img_href":"(https:[^"]+)"/g, /"url":"(https:\\\/\\\/[^"]+)"/g];
    for (const pattern of patterns) {
      for (const match of html.matchAll(pattern)) {
        const raw = match[1].replace(/\\\//g, "/").replace(/\\u0026/g, "&").replace(/&/g, "&");
        if (!/^https:\/\//i.test(raw) || raw === original || found.has(raw)) continue;
        found.add(raw);
        images.push({ title: source, url: raw, thumb: raw });
        if (images.length >= 8) return images;
      }
    }
    return images;
  } catch {
    return [];
  }
}

export const reverseImage = createServerFn({ method: "POST" })
  .validator((input: { url?: string; dataUrl?: string }) => ({
    url: /^https?:\/\//i.test(String(input?.url || "")) ? String(input?.url).trim().slice(0, 500) : "",
    dataUrl: String(input?.dataUrl || "").startsWith("data:image/") ? String(input?.dataUrl).slice(0, 900_000) : "",
  }))
  .handler(async ({ data }) => {
    const hits: SearchHit[] = [];
    const images: { title: string; url: string; thumb: string }[] = [];
    if (!data.url && !data.dataUrl) return { hits, images, note: "Paste an image URL or upload an image." };
    if (data.url) {
      const encoded = encodeURIComponent(data.url);
      const [bing, yandex] = await Promise.all([
        visualMatches(`https://www.bing.com/images/search?q=imgurl:${encoded}&view=detailv2&iss=sbi&form=SBIIRP`, "Bing", data.url),
        visualMatches(`https://yandex.com/images/search?rpt=imageview&url=${encoded}`, "Yandex", data.url),
      ]);
      images.push(...bing, ...yandex);
      hits.push(
        { title: "Google Lens", url: `https://lens.google.com/uploadbyurl?url=${encoded}`, snippet: "Open reverse search" },
        { title: "Bing", url: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encoded}`, snippet: "Open reverse search" },
        { title: "Yandex", url: `https://yandex.com/images/search?rpt=imageview&url=${encoded}`, snippet: "Open reverse search" },
        { title: "TinEye", url: `https://tineye.com/search?url=${encoded}`, snippet: "Open reverse search" },
      );
    }
    const sauce = data.url
      ? await readJson<{ results?: { header?: { similarity?: string; thumbnail?: string }; data?: { title?: string; source?: string; ext_urls?: string[] } }[] }>(`https://saucenao.com/search.php?output_type=2&numres=6&url=${encodeURIComponent(data.url)}`)
      : await (async () => {
        try {
          const bytes = Uint8Array.from(atob(data.dataUrl.split(",")[1] || ""), (char) => char.charCodeAt(0));
          const form = new FormData();
          form.set("output_type", "2");
          form.set("numres", "6");
          form.set("file", new Blob([bytes]), "image.jpg");
          const response = await fetch("https://saucenao.com/search.php", { method: "POST", body: form, signal: AbortSignal.timeout(12000) });
          if (!response.ok) return null;
          return await response.json() as { results?: { header?: { similarity?: string; thumbnail?: string }; data?: { title?: string; source?: string; ext_urls?: string[] } }[] };
        } catch {
          return null;
        }
      })();
    for (const row of sauce?.results || []) {
      const score = Number(row.header?.similarity || 0);
      if (score < 50) continue;
      const page = row.data?.ext_urls?.[0] || "";
      if (!page) continue;
      hits.push({ title: row.data?.title || row.data?.source || "SauceNAO match", url: page, snippet: `SauceNAO · ${score}%` });
      if (row.header?.thumbnail) images.push({ title: row.data?.title || "Match", url: page, thumb: row.header.thumbnail });
    }
    if (data.url) {
      const traced = await readJson<{ result?: { filename?: string; episode?: string | number; similarity?: number; video?: string; image?: string }[] }>(`https://api.trace.moe/search?anilistInfo&url=${encodeURIComponent(data.url)}`);
      for (const row of traced?.result || []) {
        if ((row.similarity || 0) < 0.85 || !row.video) continue;
        hits.push({ title: `${row.filename || "Scene"}${row.episode ? ` · ep ${row.episode}` : ""}`, url: row.video, snippet: `trace.moe · ${Math.round((row.similarity || 0) * 100)}%` });
        if (row.image) images.push({ title: row.filename || "Scene", url: row.video, thumb: row.image });
      }
    }
    return { hits, images, note: images.length ? "" : data.url ? "No matching pictures were returned. The Lens, Bing, Yandex, and TinEye links still open that image." : "No match on the upload. Paste a public image URL to also search Bing and Yandex." };
  });

export const findIdeas = createServerFn({ method: "GET" }).handler(async () => {
  const ideas: { title: string; url: string; source: string; effort: "low" | "medium" }[] = [];
  const seen = new Set<string>();
  const add = (title: string, url: string, source: string) => {
    const name = title.replace(/\s+/g, " ").trim().slice(0, 160);
    const key = name.toLowerCase();
    if (!name || seen.has(key) || name.length < 8) return;
    if (/guaranteed|giveaway|seed phrase|dm me|telegram|whatsapp|crypto airdrop/i.test(name)) return;
    seen.add(key);
    ideas.push({ title: name, url: url.slice(0, 300), source, effort: effortOf(name) });
  };
  await Promise.all([
    fetch("https://hn.algolia.com/api/v1/search?query=side%20hustle&tags=story&hitsPerPage=8")
      .then((res) => res.ok ? res.json() : null)
      .then((body: { hits?: { title?: string; url?: string; objectID?: string }[] } | null) => {
        for (const hit of body?.hits || []) add(hit.title || "", hit.url || `https://news.ycombinator.com/item?id=${hit.objectID || ""}`, "Hacker News");
      })
      .catch(() => undefined),
    ...["beermoney", "sidehustle", "WorkOnline"].map((sub) =>
      fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=8`, { headers: { "User-Agent": "LifeOS-Lucid/1.0" } })
        .then((res) => res.ok ? res.json() : null)
        .then((body: { data?: { children?: { data?: { stickied?: boolean; title?: string; permalink?: string } }[] } } | null) => {
          for (const child of body?.data?.children || []) {
            if (child.data?.stickied) continue;
            add(child.data?.title || "", `https://www.reddit.com${child.data?.permalink || ""}`, `r/${sub}`);
          }
        })
        .catch(() => undefined),
    ),
  ]);
  return { ideas: ideas.slice(0, 24) };
});

export const marketQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const crypto: { symbol: string; price: number; change: number }[] = [];
  const stocks: { symbol: string; price: number; change: number }[] = [];
  const names: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", ripple: "XRP", dogecoin: "DOGE" };
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,dogecoin&vs_currencies=usd&include_24hr_change=true");
    const body = await response.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
    for (const [id, symbol] of Object.entries(names)) {
      crypto.push({ symbol, price: Number(body[id]?.usd) || 0, change: Number(body[id]?.usd_24h_change) || 0 });
    }
  } catch { /* quotes stay empty */ }
  await Promise.all(["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META"].map(async (symbol) => {
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
      const body = await response.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[] } };
      const meta = body.chart?.result?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice) || 0;
      const prev = Number(meta?.chartPreviousClose) || price;
      if (price) stocks.push({ symbol, price, change: prev ? ((price - prev) / prev) * 100 : 0 });
    } catch { /* skip this symbol */ }
  }));
  return { crypto, stocks };
});

const COIN_IDS: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", DOGE: "dogecoin", ADA: "cardano", AVAX: "avalanche-2", LINK: "chainlink", DOT: "polkadot", LTC: "litecoin" };

export const watchQuote = createServerFn({ method: "POST" })
  .validator((input: { symbol?: string; kind?: string }) => ({
    symbol: String(input?.symbol || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12),
    kind: input?.kind === "crypto" ? "crypto" as const : "stock" as const,
  }))
  .handler(async ({ data }) => {
    if (!data.symbol) return { ok: false as const, error: "Enter a symbol." };
    try {
      if (data.kind === "stock") {
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(data.symbol)}?interval=1d&range=1d`);
        const body = await response.json() as { chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[] } };
        const meta = body.chart?.result?.[0]?.meta;
        const price = Number(meta?.regularMarketPrice) || 0;
        const prev = Number(meta?.chartPreviousClose) || price;
        if (!price) return { ok: false as const, error: "No stock quote for that symbol." };
        return { ok: true as const, quote: { symbol: data.symbol, price, change: prev ? ((price - prev) / prev) * 100 : 0 } };
      }
      const id = COIN_IDS[data.symbol] || data.symbol.toLowerCase();
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`);
      const body = await response.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
      const price = Number(body[id]?.usd) || 0;
      if (!price) return { ok: false as const, error: "No crypto quote for that symbol." };
      return { ok: true as const, quote: { symbol: data.symbol, price, change: Number(body[id]?.usd_24h_change) || 0 } };
    } catch {
      return { ok: false as const, error: "The quote service did not answer." };
    }
  });

export const locateArea = createServerFn({ method: "POST" })
  .validator((input: { kind?: string; zip?: string; county?: string; state?: string; miles?: string; center?: string; place?: string }) => ({
    kind: input?.kind === "county" || input?.kind === "radius" || input?.kind === "place" ? input.kind : "zip",
    zip: String(input?.zip || "").trim().slice(0, 12),
    county: String(input?.county || "").trim().slice(0, 60),
    state: String(input?.state || "").trim().slice(0, 40),
    miles: String(input?.miles || "").trim().slice(0, 6),
    center: String(input?.center || "").trim().slice(0, 80),
    place: String(input?.place || "").trim().slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const headers = { "User-Agent": "LifeOS-Maps/1.0", Accept: "application/json" };
    const query = data.kind === "county"
      ? `${data.county} County, ${data.state || "USA"}`
      : data.kind === "place"
        ? `${data.place}${data.state ? `, ${data.state}` : ""}`
        : data.kind === "radius"
          ? (data.center || data.zip)
          : data.zip;
    if (!query) return { ok: false as const, error: "Enter a zip, county, neighborhood, or a center for the radius." };
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("polygon_geojson", "1");
    if (data.kind === "zip") {
      url.searchParams.set("postalcode", data.zip);
      url.searchParams.set("country", "us");
    } else url.searchParams.set("q", query);
    const response = await fetch(url, { headers });
    const rows = await response.json() as { display_name?: string; lat?: string; lon?: string; boundingbox?: string[]; geojson?: { type?: string } }[];
    const hit = rows[0];
    if (!hit?.lat || !hit.lon) return { ok: false as const, error: "No area came back for that search." };
    const box = (hit.boundingbox || []).map(Number);
    return {
      ok: true as const,
      label: hit.display_name || query,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      miles: Number(data.miles) || 0,
      bbox: box.length === 4 ? box : null,
      geojson: hit.geojson && hit.geojson.type && hit.geojson.type !== "Point" ? hit.geojson : null,
    };
  });

export const telegramBot = createServerFn({ method: "POST" })
  .validator((input: { token?: string; chat?: string; text?: string }) => ({
    token: String(input?.token || "").trim().slice(0, 120),
    chat: String(input?.chat || "").trim().slice(0, 40),
    text: String(input?.text || "").trim().slice(0, 500),
  }))
  .handler(async ({ data }) => {
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(data.token)) return { ok: false as const, bot: "", error: "That is not a bot token." };
    const base = `https://api.telegram.org/bot${data.token}`;
    if (!data.text) {
      const info = await fetch(`${base}/getMe`);
      const body = await info.json() as { ok?: boolean; result?: { username?: string; first_name?: string }; description?: string };
      if (!body.ok) return { ok: false as const, bot: "", error: body.description || "Telegram did not answer." };
      return { ok: true as const, bot: body.result?.username ? `@${body.result.username}` : body.result?.first_name || "bot", error: "" };
    }
    if (!data.chat) return { ok: false as const, bot: "", error: "A chat id is required." };
    const sent = await fetch(`${base}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: data.chat, text: data.text }),
    });
    const body = await sent.json() as { ok?: boolean; description?: string };
    return body.ok ? { ok: true as const, bot: "", error: "" } : { ok: false as const, bot: "", error: body.description || "Send failed." };
  });

type LiveChat = { id: string; who: string; text: string; mine: boolean; platform: string };

export const pullChats = createServerFn({ method: "POST" })
  .validator((input: { telegram?: string; facebook?: string }) => ({
    telegram: String(input?.telegram || "").trim().slice(0, 200),
    facebook: String(input?.facebook || "").trim().slice(0, 4000),
  }))
  .handler(async ({ data }) => {
    const messages: LiveChat[] = [];
    const notes: string[] = [];
    const token = data.telegram || process.env.TELEGRAM_BOT_TOKEN || "";
    if (/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=40&allowed_updates=${encodeURIComponent("[\"message\"]")}`);
      const body = await response.json() as { ok?: boolean; description?: string; result?: { update_id: number; message?: { message_id: number; text?: string; chat: { id: number; first_name?: string; last_name?: string; username?: string }; from?: { is_bot?: boolean; first_name?: string } } }[] };
      if (!body.ok) notes.push(body.description || "Telegram did not return chats.");
      else {
        for (const update of body.result || []) {
          const message = update.message;
          const text = message?.text?.trim();
          if (!message || !text) continue;
          const who = [message.chat.first_name, message.chat.last_name].filter(Boolean).join(" ") || message.chat.username || "Telegram";
          messages.push({
            id: `tg:${message.chat.id}:${message.message_id}`,
            who,
            text,
            mine: Boolean(message.from?.is_bot),
            platform: "telegram",
          });
        }
        notes.push(`Telegram ${messages.length} message${messages.length === 1 ? "" : "s"}.`);
      }
    } else notes.push("Telegram bot token is not saved.");

    if (data.facebook) {
      const headers = { Authorization: `Bearer ${data.facebook}` };
      const pages = await fetch("https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token", { headers });
      const listed = await pages.json() as { data?: { id: string; name?: string; access_token?: string }[]; error?: { message?: string } };
      if (!pages.ok) notes.push(listed.error?.message || "Reconnect Facebook so Messenger can be read.");
      else if (!listed.data?.length) notes.push("Facebook is connected, but no Page was returned.");
      else {
        let count = 0;
        for (const page of listed.data.slice(0, 3)) {
          if (!page.access_token) continue;
          for (const kind of ["messenger", "instagram"] as const) {
            const url = `https://graph.facebook.com/v23.0/${page.id}/conversations?platform=${kind === "instagram" ? "instagram" : "messenger"}&fields=participants,messages.limit(8){id,message,from,created_time}&access_token=${encodeURIComponent(page.access_token)}`;
            const response = await fetch(url);
            const body = await response.json() as { data?: { participants?: { data?: { name?: string; id?: string }[] }; messages?: { data?: { id?: string; message?: string; from?: { name?: string; id?: string } }[] } }[]; error?: { message?: string } };
            if (!response.ok) { notes.push(body.error?.message || `${kind} refused the Page token.`); continue; }
            for (const conversation of body.data || []) {
              const people = conversation.participants?.data || [];
              const other = people.find((person) => person.id && person.id !== page.id);
              const who = other?.name || "Facebook";
              for (const message of conversation.messages?.data || []) {
                const text = message.message?.trim();
                if (!message.id || !text) continue;
                messages.push({
                  id: `fb:${page.id}:${other?.id || "0"}:${message.id}`,
                  who,
                  text,
                  mine: message.from?.id === page.id,
                  platform: kind === "instagram" ? "instagram" : "messenger",
                });
                count += 1;
              }
            }
          }
        }
        notes.push(`Meta ${count} message${count === 1 ? "" : "s"}.`);
      }
    } else notes.push("Facebook is not connected. Reconnect it for Messenger and Instagram.");

    const apiKey = process.env.NYLAS_API_KEY || "";
    if (apiKey) {
      const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
      const listed = await fetch("https://api.us.nylas.com/v3/grants?limit=10", { headers });
      const grants = await listed.json() as { data?: { id: string; email?: string }[]; error?: { message?: string } };
      const board = ["chris@ceogps.com", "chrisgr33ninc@gmail.com", "cagednreality@icloud.com"];
      const mine = (grants.data || []).filter((row) => board.includes((row.email || "").toLowerCase()));
      const use = mine.length ? mine : (grants.data || []).slice(0, 3);
      if (!listed.ok || !use.length) notes.push(grants.error?.message || "Nylas has no mailbox for texts.");
      else {
        let count = 0;
        for (const grant of use) {
        const response = await fetch(`https://api.us.nylas.com/v3/grants/${grant.id}/messages?limit=30`, { headers });
        const mail = await response.json() as { data?: { id?: string; subject?: string; snippet?: string; from?: { email?: string }[]; to?: { email?: string }[] }[]; error?: { message?: string } };
        if (!response.ok) { notes.push(mail.error?.message || `${grant.email || "Mailbox"} did not return text mail.`); continue; }
          for (const row of mail.data || []) {
            const from = (row.from || []).map((item) => item.email || "").join(" ");
            const to = (row.to || []).map((item) => item.email || "").join(" ");
            const blob = `${from} ${to} ${row.subject || ""} ${row.snippet || ""}`;
            const nums = [...blob.matchAll(/\d{10,11}/g)].map((hit) => hit[0].replace(/\D/g, "").replace(/^1/, "").slice(-10)).filter((num) => num.length === 10 && num !== "4702223939" && num !== "4708150666");
            const phone = nums[0] || "";
            const voice = /voice\.google\.com|google voice|text message from/i.test(blob);
            const mobile = /tmomail\.net/i.test(blob);
            if (!voice && !mobile) continue;
            const who = phone ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` : voice ? "Google Voice · 470-222-3939" : "SMS · 470-815-0666";
            messages.push({
              id: `${voice && !mobile ? "gv" : "tm"}:${row.id || blob.slice(0, 40)}`,
              who,
              text: row.snippet || row.subject || "Text",
              mine: board.some((email) => from.toLowerCase().includes(email)),
              platform: voice && !mobile ? "voice" : "sms",
            });
            count += 1;
          }
        }
        notes.push(`${use.map((row) => row.email).filter(Boolean).join(", ") || "Mailboxes"} ${count} text${count === 1 ? "" : "s"}.`);
      }
    }

    return { ok: messages.length > 0, text: notes.join(" "), messages };
  });

export const sendChat = createServerFn({ method: "POST" })
  .validator((input: { platform?: string; route?: string; text?: string; telegram?: string; facebook?: string }) => ({
    platform: String(input?.platform || "").slice(0, 20),
    route: String(input?.route || "").trim().slice(0, 400),
    text: String(input?.text || "").trim().slice(0, 500),
    telegram: String(input?.telegram || "").trim().slice(0, 200),
    facebook: String(input?.facebook || "").trim().slice(0, 4000),
  }))
  .handler(async ({ data }) => {
    if (!data.text) return { ok: false as const, error: "Message is empty." };
    if (data.platform === "telegram") {
      const token = data.telegram || process.env.TELEGRAM_BOT_TOKEN || "";
      const chat = data.route.split(":")[1] || "";
      if (!/^\d+:[A-Za-z0-9_-]+$/.test(token) || !chat) return { ok: false as const, error: "Telegram needs a bot token and an existing chat." };
      const sent = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: data.text }),
      });
      const body = await sent.json() as { ok?: boolean; description?: string; result?: { message_id?: number } };
      if (!body.ok) return { ok: false as const, error: body.description || "Telegram did not send." };
      return { ok: true as const, error: "", id: `tg:${chat}:${body.result?.message_id || Date.now()}` };
    }
    if (data.platform === "messenger" || data.platform === "instagram") {
      const [, pageId, recipient] = data.route.split(":");
      if (!data.facebook || !pageId || !recipient) return { ok: false as const, error: "Reconnect Facebook, then open a thread that already exists." };
      const pages = await fetch("https://graph.facebook.com/v23.0/me/accounts?fields=id,access_token", { headers: { Authorization: `Bearer ${data.facebook}` } });
      const listed = await pages.json() as { data?: { id: string; access_token?: string }[]; error?: { message?: string } };
      const page = listed.data?.find((row) => row.id === pageId);
      if (!page?.access_token) return { ok: false as const, error: listed.error?.message || "That Page token is missing." };
      const sent = await fetch(`https://graph.facebook.com/v23.0/${page.id}/messages?access_token=${encodeURIComponent(page.access_token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: recipient }, message: { text: data.text }, messaging_type: "RESPONSE" }),
      });
      const body = await sent.json() as { message_id?: string; error?: { message?: string } };
      if (!sent.ok) return { ok: false as const, error: body.error?.message || "Messenger did not send." };
      return { ok: true as const, error: "", id: `fb:${page.id}:${recipient}:${body.message_id || Date.now()}` };
    }
    if (data.platform === "voice") {
      const messageId = data.route.replace(/^(gv|sms):/, "");
      if (!messageId || /^\d+$/.test(messageId)) return { ok: false as const, error: "Open a text that already came in to (470) 222-3939. Replying to that thread sends from that number." };
      const apiKey = process.env.NYLAS_API_KEY || "";
      if (!apiKey) return { ok: false as const, error: "Nylas key is not on the server." };
      const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" };
      const listed = await fetch("https://api.us.nylas.com/v3/grants?limit=10", { headers });
      const grants = await listed.json() as { data?: { id: string; email?: string }[]; error?: { message?: string } };
      const grant = (grants.data || []).find((row) => (row.email || "").toLowerCase() === "cagednreality@icloud.com")
        || (grants.data || []).find((row) => (row.email || "").toLowerCase().includes("cagednreality"));
      if (!grant) return { ok: false as const, error: grants.error?.message || "cagednreality@icloud.com is not on Nylas." };
      const sent = await fetch(`https://api.us.nylas.com/v3/grants/${grant.id}/messages/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reply_to_message_id: messageId, body: data.text }),
      });
      const mail = await sent.json() as { data?: { id?: string }; error?: { message?: string } };
      if (!sent.ok) return { ok: false as const, error: mail.error?.message || "Google Voice did not send the reply." };
      return { ok: true as const, error: "", id: `gv:${mail.data?.id || Date.now()}` };
    }
    if (data.platform === "sms" || data.platform === "email") {
      const apiKey = process.env.NYLAS_API_KEY || "";
      if (!apiKey) return { ok: false as const, error: "Nylas key is not on the server." };
      const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" };
      const listed = await fetch("https://api.us.nylas.com/v3/grants?limit=10", { headers });
      const grants = await listed.json() as { data?: { id: string; email?: string }[]; error?: { message?: string } };
      const grant = (grants.data || []).find((row) => (row.email || "").toLowerCase() === "cagednreality@icloud.com")
        || (grants.data || []).find((row) => (row.email || "").toLowerCase().includes("cagednreality"))
        || (grants.data || [])[0];
      if (!grant) return { ok: false as const, error: grants.error?.message || "No Nylas mailbox is connected." };
      const digits = data.route.replace(/\D/g, "").slice(-10);
      const to = data.platform === "sms"
        ? (digits.length === 10 ? `${digits}@tmomail.net` : "")
        : (data.route.includes("@") ? data.route : "cagednreality@icloud.com");
      if (!to) return { ok: false as const, error: "The T-Mobile number is missing." };
      const sent = await fetch(`https://api.us.nylas.com/v3/grants/${grant.id}/messages/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          subject: data.platform === "sms" ? "Text" : "Forward",
          body: data.text,
          to: [{ email: to }],
        }),
      });
      const mail = await sent.json() as { data?: { id?: string }; error?: { message?: string } };
      if (!sent.ok) return { ok: false as const, error: mail.error?.message || "Nylas did not send." };
      return { ok: true as const, error: "", id: `mail:${mail.data?.id || Date.now()}` };
    }
    return { ok: false as const, error: "WhatsApp and Discord open in their own apps. There is no send key for them." };
  });

function youtubeHits(node: unknown, out: { id: string; title: string; author: string }[]) {
  if (!node || typeof node !== "object" || out.length >= 8) return;
  if (Array.isArray(node)) {
    node.forEach((item) => youtubeHits(item, out));
    return;
  }
  const row = node as Record<string, unknown>;
  const video = row.videoRenderer as { videoId?: string; title?: { runs?: { text?: string }[] }; ownerText?: { runs?: { text?: string }[] } } | undefined;
  if (video?.videoId && !out.some((item) => item.id === video.videoId)) {
    out.push({
      id: video.videoId,
      title: video.title?.runs?.[0]?.text || "Video",
      author: video.ownerText?.runs?.[0]?.text || "",
    });
  }
  Object.values(row).forEach((value) => youtubeHits(value, out));
}

export const youtubeSearch = createServerFn({ method: "POST" })
  .validator((input: { query?: string; key?: string }) => ({
    query: String(input?.query || "").trim().slice(0, 120),
    key: String(input?.key || "").trim().slice(0, 200),
  }))
  .handler(async ({ data }) => {
    if (!data.query) return { videos: [] as { id: string; title: string; author: string }[], error: "Type a search." };
    const key = data.key || process.env.YOUTUBE_DATA_V3_API_KEY || process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || "";
    if (key) {
      try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(data.query)}&key=${encodeURIComponent(key)}`);
        const body = await response.json() as { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[] };
        const videos = (body.items || []).map((row) => ({
          id: row.id?.videoId || "",
          title: row.snippet?.title || "Video",
          author: row.snippet?.channelTitle || "",
        })).filter((row) => row.id);
        if (videos.length) return { videos, error: "" };
      } catch { /* try the public search */ }
    }
    try {
      const response = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: "2.20251001.00.00", hl: "en", gl: "US" } },
          query: data.query,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const videos: { id: string; title: string; author: string }[] = [];
      youtubeHits(await response.json(), videos);
      if (videos.length) return { videos, error: "" };
    } catch { /* no results */ }
    return { videos: [] as { id: string; title: string; author: string }[], error: "YouTube search did not answer." };
  });

export const pullSocial = createServerFn({ method: "POST" })
  .validator((input: { facebook?: string; youtube?: string; youtubeHandle?: string; reddit?: string; x?: string; linkedin?: string; tiktok?: string }) => ({
    facebook: String(input?.facebook || "").slice(0, 4000),
    youtube: String(input?.youtube || "").slice(0, 200),
    youtubeHandle: String(input?.youtubeHandle || "").replace(/^@/, "").slice(0, 60),
    reddit: String(input?.reddit || "").replace(/^u\//i, "").replace(/^@/, "").slice(0, 40),
    x: String(input?.x || "").slice(0, 4000),
    linkedin: String(input?.linkedin || "").slice(0, 4000),
    tiktok: String(input?.tiktok || "").slice(0, 4000),
  }))
  .handler(async ({ data }) => {
    const rows: { id: string; handle: string; followers: number; following: number; likes: number; comments: number; views: number }[] = [];
    const notes: string[] = [];
    if (data.facebook) {
      try {
        const pages = await fetch(`https://graph.facebook.com/v23.0/me/accounts?fields=id,name,fan_count,followers_count,access_token&access_token=${encodeURIComponent(data.facebook)}`, { signal: AbortSignal.timeout(8000) });
        const body = await pages.json() as { data?: { id?: string; name?: string; fan_count?: number; followers_count?: number; access_token?: string }[]; error?: { message?: string } };
        if (!pages.ok) notes.push(body.error?.message || "Facebook did not return pages.");
        const page = body.data?.[0];
        if (page?.id) {
          rows.push({ id: "facebook", handle: page.name || "Facebook", followers: Number(page.followers_count || page.fan_count) || 0, following: 0, likes: Number(page.fan_count) || 0, comments: 0, views: 0 });
          const ig = await fetch(`https://graph.facebook.com/v23.0/${page.id}?fields=instagram_business_account{username,followers_count,follows_count,media_count}&access_token=${encodeURIComponent(page.access_token || data.facebook)}`, { signal: AbortSignal.timeout(8000) });
          const instagram = await ig.json() as { instagram_business_account?: { username?: string; followers_count?: number; follows_count?: number; media_count?: number } };
          const account = instagram.instagram_business_account;
          if (account) rows.push({ id: "instagram", handle: account.username ? `@${account.username}` : "Instagram", followers: Number(account.followers_count) || 0, following: Number(account.follows_count) || 0, likes: 0, comments: 0, views: Number(account.media_count) || 0 });
        }
      } catch {
        notes.push("Facebook did not answer.");
      }
    }
    const youtubeKey = data.youtube || process.env.YOUTUBE_DATA_V3_API_KEY || process.env.YOUTUBE_API_KEY || "";
    if (youtubeKey && data.youtubeHandle && data.youtubeHandle !== "yourhandle") {
      try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=${encodeURIComponent(data.youtubeHandle)}&key=${encodeURIComponent(youtubeKey)}`, { signal: AbortSignal.timeout(8000) });
        const body = await response.json() as { items?: { snippet?: { title?: string }; statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string } }[]; error?: { message?: string } };
        const channel = body.items?.[0];
        if (channel?.statistics) {
          rows.push({ id: "youtube", handle: `@${data.youtubeHandle}`, followers: Number(channel.statistics.subscriberCount) || 0, following: 0, likes: Number(channel.statistics.videoCount) || 0, comments: 0, views: Number(channel.statistics.viewCount) || 0 });
        } else notes.push(body.error?.message || "YouTube channel was not found.");
      } catch {
        notes.push("YouTube did not answer.");
      }
    }
    if (data.reddit && data.reddit !== "yourhandle") {
      try {
        const response = await fetch(`https://www.reddit.com/user/${encodeURIComponent(data.reddit)}/about.json`, { headers: { "User-Agent": "LifeOS/1.0" }, signal: AbortSignal.timeout(8000) });
        const body = await response.json() as { data?: { name?: string; total_karma?: number; link_karma?: number; comment_karma?: number; subreddit?: { subscribers?: number } } };
        if (body.data) {
          rows.push({ id: "reddit", handle: `u/${data.reddit}`, followers: Number(body.data.subreddit?.subscribers || body.data.total_karma) || 0, following: 0, likes: Number(body.data.link_karma) || 0, comments: Number(body.data.comment_karma) || 0, views: 0 });
        }
      } catch {
        notes.push("Reddit did not answer.");
      }
    }
    if (data.x) {
      try {
        const response = await fetch("https://api.x.com/2/users/me?user.fields=public_metrics,username", { headers: { Authorization: `Bearer ${data.x}` }, signal: AbortSignal.timeout(8000) });
        const body = await response.json() as { data?: { username?: string; public_metrics?: { followers_count?: number; following_count?: number; like_count?: number; tweet_count?: number } }; detail?: string };
        const metrics = body.data?.public_metrics;
        if (metrics) rows.push({ id: "x", handle: body.data?.username ? `@${body.data.username}` : "@x", followers: Number(metrics.followers_count) || 0, following: Number(metrics.following_count) || 0, likes: Number(metrics.like_count) || 0, comments: 0, views: Number(metrics.tweet_count) || 0 });
        else notes.push(body.detail || "X did not return account numbers.");
      } catch {
        notes.push("X did not answer.");
      }
    }
    if (data.linkedin) {
      try {
        const response = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${data.linkedin}` }, signal: AbortSignal.timeout(8000) });
        const body = await response.json() as { name?: string; error?: string };
        if (response.ok) rows.push({ id: "linkedin", handle: body.name || "LinkedIn", followers: 0, following: 0, likes: 0, comments: 0, views: 0 });
        else notes.push(body.error || "LinkedIn did not return the profile.");
      } catch {
        notes.push("LinkedIn did not answer.");
      }
    }
    if (data.tiktok) {
      try {
        const response = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=username,follower_count,following_count,likes_count,video_count", { headers: { Authorization: `Bearer ${data.tiktok}` }, signal: AbortSignal.timeout(8000) });
        const body = await response.json() as { data?: { user?: { username?: string; follower_count?: number; following_count?: number; likes_count?: number; video_count?: number } }; error?: { message?: string } };
        const user = body.data?.user;
        if (user) rows.push({ id: "tiktok", handle: user.username ? `@${user.username}` : "@tiktok", followers: Number(user.follower_count) || 0, following: Number(user.following_count) || 0, likes: Number(user.likes_count) || 0, comments: 0, views: Number(user.video_count) || 0 });
        else notes.push(body.error?.message || "TikTok did not return account numbers.");
      } catch {
        notes.push("TikTok did not answer.");
      }
    }
    if (!rows.length && !notes.length) notes.push("Connect Facebook, or add the X, LinkedIn, TikTok, YouTube, or Reddit account, then sync.");
    return { rows, note: notes.join(" ") };
  });

export const publishSocial = createServerFn({ method: "POST" })
  .validator((input: { text?: string; platforms?: string[]; facebook?: string; image?: string; x?: string; linkedin?: string; redditToken?: string; subreddit?: string; tiktok?: string }) => ({
    text: String(input?.text || "").trim().slice(0, 5000),
    platforms: (Array.isArray(input?.platforms) ? input.platforms : []).map((item) => String(item)).filter(Boolean).slice(0, 8),
    facebook: String(input?.facebook || "").slice(0, 4000),
    image: String(input?.image || "").trim().slice(0, 2000),
    x: String(input?.x || "").slice(0, 4000),
    linkedin: String(input?.linkedin || "").slice(0, 4000),
    redditToken: String(input?.redditToken || "").slice(0, 4000),
    subreddit: String(input?.subreddit || "").replace(/^r\//i, "").slice(0, 40),
    tiktok: String(input?.tiktok || "").slice(0, 4000),
  }))
  .handler(async ({ data }) => {
    const sent: string[] = [];
    const notes: string[] = [];
    const want = new Set(data.platforms);
    if (!data.text) return { sent, note: "Write the post first." };
    if ((want.has("facebook") || want.has("instagram")) && !data.facebook) notes.push("Reconnect Facebook in Integrations. Posting needs a fresh connect.");
    if ((want.has("facebook") || want.has("instagram")) && data.facebook) {
      try {
        const pages = await fetch(`https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(data.facebook)}`, { signal: AbortSignal.timeout(8000) });
        const body = await pages.json() as { data?: { id?: string; name?: string; access_token?: string }[]; error?: { message?: string } };
        const page = body.data?.find((row) => row.id && row.access_token);
        if (!pages.ok || !page) notes.push(body.error?.message || "No Facebook page is on this login.");
        else {
          if (want.has("facebook")) {
            const posted = await fetch(`https://graph.facebook.com/v23.0/${page.id}/feed`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: data.text, access_token: page.access_token }),
              signal: AbortSignal.timeout(8000),
            });
            const result = await posted.json() as { id?: string; error?: { message?: string } };
            if (posted.ok && result.id) sent.push("Facebook");
            else notes.push(result.error?.message || "Facebook refused the post.");
          }
          if (want.has("instagram")) {
            const lookup = await fetch(`https://graph.facebook.com/v23.0/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(page.access_token || "")}`, { signal: AbortSignal.timeout(8000) });
            const instagram = await lookup.json() as { instagram_business_account?: { id?: string }; error?: { message?: string } };
            const igId = instagram.instagram_business_account?.id;
            if (!igId) notes.push(instagram.error?.message || "That Facebook page has no Instagram account.");
            else if (!/^https?:\/\//i.test(data.image)) notes.push("Instagram needs a public image URL.");
            else {
              const container = await fetch(`https://graph.facebook.com/v23.0/${igId}/media`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_url: data.image, caption: data.text, access_token: page.access_token }),
                signal: AbortSignal.timeout(12000),
              });
              const made = await container.json() as { id?: string; error?: { message?: string } };
              if (!container.ok || !made.id) notes.push(made.error?.message || "Instagram did not take the image.");
              else {
                const live = await fetch(`https://graph.facebook.com/v23.0/${igId}/media_publish`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ creation_id: made.id, access_token: page.access_token }),
                  signal: AbortSignal.timeout(12000),
                });
                const published = await live.json() as { id?: string; error?: { message?: string } };
                if (live.ok && published.id) sent.push("Instagram");
                else notes.push(published.error?.message || "Instagram did not publish.");
              }
            }
          }
        }
      } catch {
        notes.push("Facebook did not answer.");
      }
    }
    if (want.has("x")) {
      if (!data.x) notes.push("Add the X user token in Integrations.");
      else {
        try {
          const posted = await fetch("https://api.x.com/2/tweets", { method: "POST", headers: { Authorization: `Bearer ${data.x}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: data.text.slice(0, 280) }), signal: AbortSignal.timeout(8000) });
          const body = await posted.json() as { data?: { id?: string }; detail?: string; title?: string };
          if (posted.ok && body.data?.id) sent.push("X");
          else notes.push(body.detail || body.title || "X refused the post.");
        } catch {
          notes.push("X did not answer.");
        }
      }
    }
    if (want.has("linkedin")) {
      if (!data.linkedin) notes.push("Add the LinkedIn token in Integrations.");
      else {
        try {
          const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${data.linkedin}` }, signal: AbortSignal.timeout(8000) });
          const who = await me.json() as { sub?: string };
          if (!who.sub) notes.push("LinkedIn token was refused.");
          else {
            const posted = await fetch("https://api.linkedin.com/rest/posts", {
              method: "POST",
              headers: { Authorization: `Bearer ${data.linkedin}`, "Content-Type": "application/json", "LinkedIn-Version": "202607", "X-Restli-Protocol-Version": "2.0.0" },
              body: JSON.stringify({ author: `urn:li:person:${who.sub}`, commentary: data.text, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }),
              signal: AbortSignal.timeout(10000),
            });
            if (posted.ok || posted.status === 201) sent.push("LinkedIn");
            else notes.push("LinkedIn refused the post.");
          }
        } catch {
          notes.push("LinkedIn did not answer.");
        }
      }
    }
    if (want.has("reddit")) {
      if (!data.redditToken) notes.push("Add the Reddit token in Integrations.");
      else if (!data.subreddit) notes.push("Enter a subreddit.");
      else {
        try {
          const posted = await fetch("https://oauth.reddit.com/api/submit", {
            method: "POST",
            headers: { Authorization: `Bearer ${data.redditToken}`, "User-Agent": "LifeOS/1.0", "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ sr: data.subreddit, kind: "self", title: data.text.slice(0, 300), text: data.text, api_type: "json" }),
            signal: AbortSignal.timeout(10000),
          });
          const body = await posted.json() as { json?: { errors?: unknown[] } };
          const errors = body.json?.errors || [];
          if (posted.ok && !errors.length) sent.push("Reddit");
          else notes.push("Reddit refused the post.");
        } catch {
          notes.push("Reddit did not answer.");
        }
      }
    }
    if (want.has("tiktok")) {
      if (!data.tiktok) notes.push("Add the TikTok token in Integrations.");
      else if (!/^https?:\/\//i.test(data.image)) notes.push("TikTok needs a public image URL.");
      else {
        try {
          const posted = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
            method: "POST",
            headers: { Authorization: `Bearer ${data.tiktok}`, "Content-Type": "application/json" },
            body: JSON.stringify({ post_info: { title: data.text.slice(0, 90), description: data.text.slice(0, 4000), privacy_level: "PUBLIC_TO_EVERYONE" }, source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: [data.image] }, post_mode: "DIRECT_POST", media_type: "PHOTO" }),
            signal: AbortSignal.timeout(12000),
          });
          const body = await posted.json() as { data?: { publish_id?: string }; error?: { code?: string; message?: string } };
          if (posted.ok && body.data?.publish_id) sent.push("TikTok");
          else notes.push(body.error?.message || "TikTok refused the post.");
        } catch {
          notes.push("TikTok did not answer.");
        }
      }
    }
    if (want.has("youtube")) notes.push("YouTube does not accept a text post. Use Sync for the channel numbers.");
    if (want.has("snapchat")) notes.push("Snapchat has no post API. The account can still be tracked by hand.");
    const note = [...(sent.length ? [`Posted to ${sent.join(" and ")}.`] : []), ...notes].join(" ");
    return { sent, note: note || "Nothing was sent." };
  });

function dayStamp(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

export const pullAnalytics = createServerFn({ method: "POST" })
  .validator((input: { google?: string; property?: string; site?: string; facebook?: string; x?: string; linkedin?: string; tiktok?: string; bdKey?: string; bdSite?: string; godaddy?: string; godaddySecret?: string }) => ({
    google: String(input?.google || "").slice(0, 4000),
    property: String(input?.property || "").replace(/\D/g, "").slice(0, 20),
    site: String(input?.site || "").trim().slice(0, 200),
    facebook: String(input?.facebook || "").slice(0, 4000),
    x: String(input?.x || "").slice(0, 4000),
    linkedin: String(input?.linkedin || "").slice(0, 4000),
    tiktok: String(input?.tiktok || "").slice(0, 4000),
    bdKey: String(input?.bdKey || "").slice(0, 200),
    bdSite: String(input?.bdSite || "").trim().slice(0, 200),
    godaddy: String(input?.godaddy || "").slice(0, 200),
    godaddySecret: String(input?.godaddySecret || "").slice(0, 200),
  }))
  .handler(async ({ data }) => {
    const rows: { id: string; label: string; value: number; points: number[] }[] = [];
    const notes: string[] = [];
    if (data.google && data.property) {
      try {
        const live = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${data.property}:runRealtimeReport`, {
          method: "POST",
          headers: { Authorization: `Bearer ${data.google}`, "Content-Type": "application/json" },
          body: JSON.stringify({ metrics: [{ name: "activeUsers" }] }),
          signal: AbortSignal.timeout(10000),
        });
        const body = await live.json() as { rows?: { metricValues?: { value?: string }[] }[]; error?: { message?: string } };
        if (live.ok) rows.push({ id: "ga-live", label: "GA active now", value: Number(body.rows?.[0]?.metricValues?.[0]?.value) || 0, points: [] });
        else notes.push(body.error?.message || "Google Analytics refused the property.");
        const week = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${data.property}:runReport`, {
          method: "POST",
          headers: { Authorization: `Bearer ${data.google}`, "Content-Type": "application/json" },
          body: JSON.stringify({ dateRanges: [{ startDate: "7daysAgo", endDate: "today" }], metrics: [{ name: "sessions" }], dimensions: [{ name: "date" }] }),
          signal: AbortSignal.timeout(10000),
        });
        const report = await week.json() as { rows?: { metricValues?: { value?: string }[] }[] };
        const points = (report.rows || []).map((row) => Number(row.metricValues?.[0]?.value) || 0);
        if (points.length) rows.push({ id: "ga-sessions", label: "GA sessions", value: points.reduce((sum, point) => sum + point, 0), points });
      } catch {
        notes.push("Google Analytics did not answer.");
      }
    } else if (!data.property) notes.push("Add the GA4 property ID.");
    else notes.push("Reconnect Google so Analytics and Search Console are allowed.");
    if (data.google && data.site) {
      try {
        const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(data.site)}/searchAnalytics/query`, {
          method: "POST",
          headers: { Authorization: `Bearer ${data.google}`, "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: dayStamp(10), endDate: dayStamp(2), dimensions: ["date"], rowLimit: 10 }),
          signal: AbortSignal.timeout(10000),
        });
        const body = await response.json() as { rows?: { clicks?: number; impressions?: number }[]; error?: { message?: string } };
        if (!response.ok) notes.push(body.error?.message || "Search Console refused that site.");
        else {
          const clicks = (body.rows || []).map((row) => Number(row.clicks) || 0);
          const impressions = (body.rows || []).map((row) => Number(row.impressions) || 0);
          if (clicks.length) rows.push({ id: "gsc-clicks", label: "Search clicks", value: clicks.reduce((sum, point) => sum + point, 0), points: clicks });
          if (impressions.length) rows.push({ id: "gsc-impressions", label: "Search impressions", value: impressions.reduce((sum, point) => sum + point, 0), points: impressions });
        }
      } catch {
        notes.push("Search Console did not answer.");
      }
    }
    if (data.facebook) {
      try {
        const pages = await fetch(`https://graph.facebook.com/v23.0/me/accounts?fields=id,name,fan_count,followers_count,access_token&access_token=${encodeURIComponent(data.facebook)}`, { signal: AbortSignal.timeout(8000) });
        const body = await pages.json() as { data?: { id?: string; fan_count?: number; followers_count?: number; access_token?: string }[]; error?: { message?: string } };
        const page = body.data?.[0];
        if (!page?.id) notes.push(body.error?.message || "No Facebook page on this login.");
        else {
          rows.push({ id: "fb-followers", label: "Facebook followers", value: Number(page.followers_count || page.fan_count) || 0, points: [] });
          const insight = await fetch(`https://graph.facebook.com/v23.0/${page.id}/insights?metric=page_impressions,page_post_engagements&period=day&access_token=${encodeURIComponent(page.access_token || data.facebook)}`, { signal: AbortSignal.timeout(8000) });
          const stats = await insight.json() as { data?: { name?: string; values?: { value?: number }[] }[] };
          for (const metric of stats.data || []) {
            const points = (metric.values || []).map((item) => Number(item.value) || 0).slice(-7);
            if (!points.length) continue;
            rows.push({ id: metric.name === "page_post_engagements" ? "fb-engagement" : "fb-impressions", label: metric.name === "page_post_engagements" ? "Facebook engagement" : "Facebook impressions", value: points.at(-1) || 0, points });
          }
          const ig = await fetch(`https://graph.facebook.com/v23.0/${page.id}?fields=instagram_business_account{followers_count,media_count}&access_token=${encodeURIComponent(page.access_token || data.facebook)}`, { signal: AbortSignal.timeout(8000) });
          const instagram = await ig.json() as { instagram_business_account?: { id?: string; followers_count?: number; media_count?: number } };
          const account = instagram.instagram_business_account;
          if (account?.id) {
            rows.push({ id: "ig-followers", label: "Instagram followers", value: Number(account.followers_count) || 0, points: [] });
            const reach = await fetch(`https://graph.facebook.com/v23.0/${account.id}/insights?metric=reach&period=day&metric_type=total_value&access_token=${encodeURIComponent(page.access_token || data.facebook)}`, { signal: AbortSignal.timeout(8000) });
            const reachBody = await reach.json() as { data?: { total_value?: { value?: number } }[] };
            const value = Number(reachBody.data?.[0]?.total_value?.value);
            if (Number.isFinite(value)) rows.push({ id: "ig-reach", label: "Instagram reach", value, points: [] });
          }
        }
      } catch {
        notes.push("Facebook did not answer.");
      }
    }
    if (data.x) {
      try {
        const response = await fetch("https://api.x.com/2/users/me?user.fields=public_metrics", { headers: { Authorization: `Bearer ${data.x}` }, signal: AbortSignal.timeout(8000) });
        const body = await response.json() as { data?: { public_metrics?: { followers_count?: number; tweet_count?: number } }; detail?: string };
        const metrics = body.data?.public_metrics;
        if (metrics) {
          rows.push({ id: "x-followers", label: "X followers", value: Number(metrics.followers_count) || 0, points: [] });
          rows.push({ id: "x-posts", label: "X posts", value: Number(metrics.tweet_count) || 0, points: [] });
        } else notes.push(body.detail || "X did not return numbers.");
      } catch {
        notes.push("X did not answer.");
      }
    }
    if (data.tiktok) {
      try {
        const response = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count,video_count", { headers: { Authorization: `Bearer ${data.tiktok}` }, signal: AbortSignal.timeout(8000) });
        const body = await response.json() as { data?: { user?: { follower_count?: number; likes_count?: number; video_count?: number } }; error?: { message?: string } };
        const user = body.data?.user;
        if (user) {
          rows.push({ id: "tt-followers", label: "TikTok followers", value: Number(user.follower_count) || 0, points: [] });
          rows.push({ id: "tt-likes", label: "TikTok likes", value: Number(user.likes_count) || 0, points: [] });
        } else notes.push(body.error?.message || "TikTok did not return numbers.");
      } catch {
        notes.push("TikTok did not answer.");
      }
    }
    if (data.linkedin) {
      try {
        const response = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${data.linkedin}` }, signal: AbortSignal.timeout(8000) });
        if (response.ok) rows.push({ id: "li-connected", label: "LinkedIn", value: 1, points: [] });
        else notes.push("LinkedIn token was refused. Member analytics are not on this key.");
      } catch {
        notes.push("LinkedIn did not answer.");
      }
    }
    if (data.bdKey && data.bdSite) {
      const site = /^https?:/i.test(data.bdSite) ? data.bdSite.replace(/\/$/, "") : `https://${data.bdSite.replace(/\/$/, "")}`;
      for (const [path, id, label] of [["user", "bd-members", "Directory members"], ["leads", "bd-leads", "Directory leads"]] as const) {
        try {
          const response = await fetch(`${site}/api/v2/${path}/count`, { headers: { "X-Api-Key": data.bdKey }, signal: AbortSignal.timeout(10000) });
          const body = await response.json() as { total?: number; count?: number; message?: string };
          if (response.ok) rows.push({ id, label, value: Number(body.total ?? body.count) || 0, points: [] });
          else notes.push(body.message || "Brilliant Directories refused the key.");
        } catch {
          notes.push("Brilliant Directories did not answer.");
        }
      }
    }
    if (data.godaddy) {
      try {
        const auth = data.godaddySecret ? `sso-key ${data.godaddy}:${data.godaddySecret}` : `Bearer ${data.godaddy}`;
        const response = await fetch("https://api.godaddy.com/v1/domains?statuses=ACTIVE&limit=100", { headers: { Authorization: auth, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
        const body = await response.json() as { domain?: string; expires?: string }[] | { message?: string };
        if (!response.ok || !Array.isArray(body)) notes.push((body as { message?: string }).message || "GoDaddy has no website analytics API. Domain list was refused.");
        else rows.push({ id: "gd-domains", label: "GoDaddy domains", value: body.length, points: [] });
      } catch {
        notes.push("GoDaddy did not answer.");
      }
    }
    return { rows, note: notes.join(" ") };
  });

const COMMUNITY: { id: string; label: string; query: (service: string, city: string) => string }[] = [
  { id: "nextdoor", label: "Nextdoor", query: (service, city) => `site:nextdoor.com ("looking for" OR "need a" OR "anyone know" OR "recommendations") ${service}${city ? ` ${city}` : ""}` },
  { id: "facebook", label: "Facebook groups", query: (service, city) => `site:facebook.com/groups ("looking for" OR "need a" OR "recommendations") ${service}${city ? ` ${city}` : ""}` },
  { id: "reddit", label: "Reddit", query: (service, city) => `site:reddit.com ("looking for" OR "need a" OR "recommendations") ${service}${city ? ` ${city}` : ""}` },
  { id: "offerup", label: "OfferUp", query: (service, city) => `site:offerup.com ${service}${city ? ` ${city}` : ""}` },
];

export const findCommunity = createServerFn({ method: "POST" })
  .validator((input: { service?: string; city?: string; sources?: string[]; groups?: { label?: string; url?: string }[] }) => ({
    service: String(input?.service || "").trim().slice(0, 80),
    city: String(input?.city || "").trim().slice(0, 40),
    sources: (Array.isArray(input?.sources) ? input.sources : []).map((item) => String(item)).slice(0, 6),
    groups: (Array.isArray(input?.groups) ? input.groups : []).map((row) => ({
      label: String(row?.label || "").slice(0, 80),
      url: String(row?.url || "").slice(0, 240),
    })).filter((row) => /facebook\.com\/groups\//i.test(row.url)).slice(0, 20),
  }))
  .handler(async ({ data }) => {
    if (!data.service) return { posts: [] as { title: string; url: string; snippet: string; source: string }[], note: "Type the service people are asking for." };
    const want = new Set(data.sources.length ? data.sources : COMMUNITY.map((row) => row.id).concat("craigslist"));
    const city = /^(national|usa|us|all)$/i.test(data.city) ? "" : data.city;
    const jobs: Promise<{ title: string; url: string; snippet: string; source: string }[]>[] = [];
    for (const source of COMMUNITY) {
      if (!want.has(source.id)) continue;
      jobs.push(duckResults(source.query(data.service, city), 5).then((hits) => hits.map((hit) => ({ title: hit.title, url: hit.url, snippet: hit.snippet.replace(/^DuckDuckGo · /, ""), source: source.label }))));
    }
    if (want.has("facebook")) {
      for (const group of data.groups) {
        const slug = group.url.split("/groups/")[1]?.split(/[/?#]/)[0] || "";
        if (!slug) continue;
        jobs.push(duckResults(`site:facebook.com/groups/${slug} ("looking for" OR "need" OR "recommend") ${data.service}`, 4).then((hits) => hits.map((hit) => ({ title: hit.title, url: hit.url, snippet: hit.snippet.replace(/^DuckDuckGo · /, ""), source: group.label || slug }))));
      }
    }
    if (want.has("craigslist")) {
      jobs.push(duckResults(`site:craigslist.org ("looking for" OR "need a" OR "wanted") ${data.service}${city ? ` ${city}` : ""}`, 6).then((hits) => hits.map((hit) => ({ title: hit.title, url: hit.url, snippet: hit.snippet.replace(/^DuckDuckGo · /, ""), source: "Craigslist" }))));
      if (city) {
        const town = city.toLowerCase().split(",")[0].trim().replace(/[^a-z]/g, "") || "";
        if (town) {
          jobs.push((async () => {
            const posts: { title: string; url: string; snippet: string; source: string }[] = [];
            for (const section of ["ccc", "hss", "bbb"]) {
              try {
                const response = await fetch(`https://${town}.craigslist.org/search/${section}?query=${encodeURIComponent(data.service)}&format=rss`, {
                  headers: { "User-Agent": "LifeOS/1.0" },
                  signal: AbortSignal.timeout(8000),
                });
                if (!response.ok) continue;
                const xml = await response.text();
                for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
                  const block = item[1];
                  const title = searchText(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
                  const url = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim();
                  const snippet = searchText(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "").slice(0, 180);
                  if (!title || !url.startsWith("http")) continue;
                  posts.push({ title: title.slice(0, 140), url: url.slice(0, 400), snippet, source: "Craigslist" });
                  if (posts.length >= 8) return posts;
                }
              } catch { /* next section */ }
            }
            return posts;
          })());
        }
      }
    }
    const settled = await Promise.all(jobs);
    const seen = new Set<string>();
    const posts = settled.flat().filter((row) => {
      if (!row.url || seen.has(row.url)) return false;
      seen.add(row.url);
      return true;
    }).slice(0, 40);
    return { posts, note: posts.length ? "" : "No public posts matched. Facebook only returns posts those groups already make public." };
  });
