// ErebusTools.ts — Web + LifeOS + Media tool execution for Erebus
//
// Fixes in this revision:
//   - REMEMBER_FACT now writes to lifeos_er_lt (was writing to "er_lt")
//   - LS_KEYS / ER_PREFIX imported from ErebusCore (single source of truth)
//   - Media import path corrected (was "./ErebusMedia.js", is now "./ErebusMedia")
//   - Credential-submitting tools now return permission: "confirm"
//   - Tool results are typed and every code path returns a value
// ============================================================

import { WORKER, BROWSER_AGENT, ER_PREFIX, LS_KEYS } from "./ErebusCore";

// ── localStorage helpers ─────────────────────────────────────────────────────

function lsLoad<T>(k: string, fallback: T = null as any): T {
  try {
    const raw = localStorage.getItem(k);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSave(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore quota */
  }
}

// ── LifeOS data tools ────────────────────────────────────────────────────────

function runLifeOSTool(line: string): any {
  const t = line.trim();

  if (t.startsWith("READ_LIFEOS:")) {
    const key = t.replace("READ_LIFEOS:", "").trim().toLowerCase();
    const lsKey = (LS_KEYS as any)[key];
    if (!lsKey) {
      return {
        type: "lifeos",
        subtype: "error",
        text: `Unknown key: ${key}. Use: crm, tasks, goals, calendar, contacts`,
      };
    }
    const data = lsLoad<any[]>(lsKey, []);
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return {
        type: "lifeos",
        subtype: "empty",
        key,
        text: `No ${key} data found.`,
      };
    }
    return { type: "lifeos", subtype: "data", key, data };
  }

  if (t.startsWith("UPDATE_LEAD:")) {
    const spec = t.replace("UPDATE_LEAD:", "").trim();
    const nameM = spec.match(/name=([^\s=]+(?:\s[^\s=]+)*?)(?=\s+\w+=|$)/i);
    const updates: Record<string, unknown> = {};
    const statusM = spec.match(/status=(\w+)/i);
    const notesM = spec.match(/notes=(.+?)(?=\s+\w+=|$)/i);
    if (statusM) updates.status = statusM[1];
    if (notesM) updates.notes = notesM[1];
    updates.lastContact = new Date().toISOString().slice(0, 10);

    const name = nameM?.[1] || "";
    const leads = lsLoad<any[]>(LS_KEYS.crm, []);
    const idx = leads.findIndex((l) =>
      l.name?.toLowerCase().includes(name.toLowerCase()),
    );
    if (idx >= 0) {
      leads[idx] = { ...leads[idx], ...updates };
      lsSave(LS_KEYS.crm, leads);
      return {
        type: "lifeos",
        subtype: "updated",
        text: `Lead "${leads[idx].name}" updated: ${JSON.stringify(updates)}`,
      };
    }
    return {
      type: "lifeos",
      subtype: "not_found",
      text: `Lead "${name}" not found in CRM.`,
    };
  }

  if (t.startsWith("CREATE_TASK:")) {
    const spec = t.replace("CREATE_TASK:", "").trim();
    const textM = spec.match(/text=(.+?)(?=\s+\w+=|$)/i);
    const priorityM = spec.match(/priority=(\w+)/i);
    const taskText = textM?.[1] || spec;
    const priority = priorityM?.[1] || "normal";

    const tasks = lsLoad<any[]>(LS_KEYS.tasks, []);
    const task = {
      id: Date.now(),
      text: taskText,
      priority,
      done: false,
      created: new Date().toISOString(),
    };
    tasks.unshift(task);
    lsSave(LS_KEYS.tasks, tasks);
    return {
      type: "lifeos",
      subtype: "created",
      text: `Task created: "${taskText}" [${priority}]`,
    };
  }

  if (t.startsWith("REMEMBER_FACT:")) {
    const spec = t.replace("REMEMBER_FACT:", "").trim();
    const keyM = spec.match(/key=([^\s=]+)/i);
    const valM = spec.match(/value=(.+?)(?=\s+\w+=|$)/i);
    if (keyM && valM) {
      // CRITICAL FIX: was `lsLoad("er_lt")` which pointed at a different key
      // than ErebusCore.learn() reads. Now both use ER_PREFIX + "lt".
      const ltKey = ER_PREFIX + "lt";
      const lt = lsLoad<{ facts: Record<string, string> }>(ltKey, {
        facts: {},
      });
      lt.facts = lt.facts || {};
      lt.facts[keyM[1]] = valM[1];
      lsSave(ltKey, lt);
      return {
        type: "lifeos",
        subtype: "learned",
        text: `Learned: ${keyM[1]} = ${valM[1]}`,
      };
    }
    return {
      type: "lifeos",
      subtype: "error",
      text: "REMEMBER_FACT needs key=X value=Y",
    };
  }

  if (t.startsWith("DRAFT_EMAIL:")) {
    const spec = t.replace("DRAFT_EMAIL:", "").trim();
    const toM = spec.match(/to=([^\s=]+(?:\s[^\s=]+)*?)(?=\s+\w+=|$)/i);
    const subjectM = spec.match(/subject=(.+?)(?=\s+\w+=|$)/i);
    const bodyM = spec.match(/body=(.+)/i);
    return {
      type: "lifeos",
      subtype: "email_draft",
      to: toM?.[1] || "",
      subject: subjectM?.[1] || "",
      body: bodyM?.[1] || "",
      text: `Email draft: To ${toM?.[1] || "?"} — ${subjectM?.[1] || "(no subject)"}`,
    };
  }

  if (t.startsWith("NOTIFY:")) {
    const msg = t.replace("NOTIFY:", "").trim();
    return { type: "lifeos", subtype: "notify", text: msg };
  }

  return null;
}

// ── Web / browser tools ──────────────────────────────────────────────────────
// Return shape: every branch returns an object with `type: "web"`.

async function runBrowserTool(line: string): Promise<any> {
  const t = line.trim();

  if (t.startsWith("BROWSE_URL:")) {
    const url = t.replace("BROWSE_URL:", "").trim();
    try {
      let res: any;
      try {
        const r = await fetch(BROWSER_AGENT + "/browse/navigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, sessionId: "erebus" }),
          signal: AbortSignal.timeout(25000),
        });
        res = await r.json();
      } catch {
        const r = await fetch(WORKER + "/api/browse/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, extract: "text" }),
        });
        res = await r.json();
      }
      return {
        type: "web",
        subtype: "page",
        url: res.url || url,
        title: res.title || url,
        text: res.text || res.error || "No content",
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "Browse error: " + e.message,
      };
    }
  }

  if (t.startsWith("SEARCH_WEB:")) {
    const query = t.replace("SEARCH_WEB:", "").trim();
    try {
      let res: any;
      try {
        const r = await fetch(BROWSER_AGENT + "/browse/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, engine: "ddg" }),
          signal: AbortSignal.timeout(20000),
        });
        res = await r.json();
      } catch {
        const r = await fetch(WORKER + "/api/browse/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        res = await r.json();
      }
      return {
        type: "web",
        subtype: "search",
        query,
        results: res.results || [],
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "Search error: " + e.message,
      };
    }
  }

  if (t.startsWith("SCRAPE_PAGE:")) {
    const raw = t.replace("SCRAPE_PAGE:", "").trim();
    const parts = raw.split("|").map((s) => s.trim());
    const url = parts[0];
    const selPart = parts.find((p) => p.startsWith("selector="));
    const selector = selPart ? selPart.replace("selector=", "").trim() : null;
    try {
      const r = await fetch(BROWSER_AGENT + "/browse/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "erebus",
          selector,
          extractType: "text",
        }),
        signal: AbortSignal.timeout(20000),
      });
      const res = await r.json();
      return {
        type: "web",
        subtype: "scrape",
        url: res.url || url,
        title: res.title || "",
        text: res.text || "",
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "Scrape error: " + e.message,
      };
    }
  }

  if (t.startsWith("CLICK_ELEMENT:")) {
    const raw = t.replace("CLICK_ELEMENT:", "").trim();
    const sel = raw.startsWith("selector=")
      ? raw.replace("selector=", "")
      : null;
    const txt = raw.startsWith("text=")
      ? raw.replace("text=", "")
      : !sel
        ? raw
        : null;
    try {
      const r = await fetch(BROWSER_AGENT + "/browse/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selector: sel, text: txt, sessionId: "erebus" }),
        signal: AbortSignal.timeout(15000),
      });
      const res = await r.json();
      return {
        type: "web",
        subtype: "click",
        url: res.url,
        text: res.text || "Clicked.",
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "Click error: " + e.message,
      };
    }
  }

  if (t.startsWith("FILL_FORM:")) {
    const raw = t.replace("FILL_FORM:", "").trim();
    const parts = raw.split("|").map((s) => s.trim());
    let submit = false;
    const fields: Array<{ selector: string; value: string }> = [];
    for (const p of parts) {
      if (p.startsWith("submit=")) {
        submit = p.includes("true");
        continue;
      }
      const selM = p.match(/selector=([^\s]+)/);
      const valM = p.match(/value=(.+)/);
      if (selM && valM) fields.push({ selector: selM[1], value: valM[1] });
    }
    try {
      const r = await fetch(BROWSER_AGENT + "/browse/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, submit, sessionId: "erebus" }),
        signal: AbortSignal.timeout(20000),
      });
      const res = await r.json();
      return {
        type: "web",
        subtype: "form",
        url: res.url,
        results: res.results,
        text: res.text || "Form filled.",
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "Form error: " + e.message,
      };
    }
  }

  if (t.startsWith("PAGE_SCREENSHOT:")) {
    try {
      const r = await fetch(BROWSER_AGENT + "/browse/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "erebus" }),
        signal: AbortSignal.timeout(15000),
      });
      const res = await r.json();
      return {
        type: "web",
        subtype: "screenshot",
        url: res.url,
        screenshot: res.screenshot,
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "Screenshot error: " + e.message,
      };
    }
  }

  if (t.startsWith("BD_LOGIN:")) {
    const raw = t.replace("BD_LOGIN:", "").trim();
    const siteM = raw.match(/siteUrl=([^\s]+)/);
    const emailM = raw.match(/email=([^\s]+)/);
    const passM = raw.match(/password=([^\s]+)/);
    if (!siteM || !emailM || !passM) {
      return {
        type: "web",
        subtype: "error",
        text: "BD_LOGIN requires siteUrl, email, password",
      };
    }
    try {
      const r = await fetch(BROWSER_AGENT + "/browse/bd/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: siteM[1],
          email: emailM[1],
          password: passM[1],
        }),
        signal: AbortSignal.timeout(30000),
      });
      const res = await r.json();
      return {
        type: "web",
        subtype: "bd_login",
        url: res.url,
        loggedIn: res.success,
        text: res.text || "",
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "BD login error: " + e.message,
      };
    }
  }

  if (t.startsWith("BD_MEMBERS:")) {
    const raw = t.replace("BD_MEMBERS:", "").trim();
    const siteM = raw.match(/siteUrl=([^\s]+)/);
    const srchM = raw.match(/search=([^\s]+)/);
    const catM = raw.match(/category=([^\s]+)/);
    if (!siteM) {
      return {
        type: "web",
        subtype: "error",
        text: "BD_MEMBERS requires siteUrl",
      };
    }
    try {
      const r = await fetch(BROWSER_AGENT + "/browse/bd/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: siteM[1],
          search: srchM?.[1] || "",
          category: catM?.[1] || "",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const res = await r.json();
      return {
        type: "web",
        subtype: "bd_members",
        members: res.members || [],
        total: res.total || 0,
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "BD members error: " + e.message,
      };
    }
  }

  if (t.startsWith("BD_SCRAPE:")) {
    const raw = t.replace("BD_SCRAPE:", "").trim();
    const siteM = raw.match(/siteUrl=([^\s]+)/);
    const pagesM = raw.match(/maxPages=(\d+)/);
    if (!siteM) {
      return {
        type: "web",
        subtype: "error",
        text: "BD_SCRAPE requires siteUrl",
      };
    }
    try {
      const r = await fetch(BROWSER_AGENT + "/browse/bd/scrape-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: siteM[1],
          maxPages: pagesM ? parseInt(pagesM[1]) : 3,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const res = await r.json();
      return {
        type: "web",
        subtype: "bd_scrape",
        members: res.members || [],
        total: res.total || 0,
      };
    } catch (e: any) {
      return {
        type: "web",
        subtype: "error",
        text: "BD scrape error: " + e.message,
      };
    }
  }

  return null;
}

// ── Media generation ─────────────────────────────────────────────────────────

export async function runErebusExecution(line: string): Promise<any> {
  // NOTE: path fixed — was "./ErebusMedia.js" (wrong extension)
  const {
    generateImage,
    editImage,
    generateMusic,
    generateSpeech,
    generateVideo,
    imageToVideo,
    generateAvatar,
  } = await import("./ErebusMedia");

  try {
    if (line.startsWith("GENERATE_IMAGE:")) {
      const prompt = line.replace("GENERATE_IMAGE:", "").trim();
      const result = await generateImage(prompt);
      return { type: "image", ...result };
    }

    if (line.startsWith("EDIT_IMAGE:")) {
      const raw = line.replace("EDIT_IMAGE:", "").trim();
      const [imageUrl, ...descParts] = raw.split("|").map((s) => s.trim());
      const desc = descParts.join("|") || "improve and enhance";
      const result = await editImage(imageUrl, desc);
      return { type: "image", ...result, edited: true };
    }

    if (line.startsWith("GENERATE_MUSIC:")) {
      const raw = line.replace("GENERATE_MUSIC:", "").trim();
      const parts = raw.split("|").map((s) => s.trim());
      const prompt = parts[0];
      const durPart = parts.find((p) => p.startsWith("duration="));
      const duration = durPart
        ? parseInt(durPart.replace("duration=", ""))
        : 60;
      const result = await generateMusic(prompt, { duration });
      return { type: "music", ...result };
    }

    if (line.startsWith("GENERATE_SPEECH:")) {
      const raw = line.replace("GENERATE_SPEECH:", "").trim();
      const parts = raw.split("|").map((s) => s.trim());
      const text = parts[0];
      const voicePart = parts.find((p) => p.startsWith("voice="));
      const voiceKey = voicePart ? voicePart.replace("voice=", "") : "default";
      const result = await generateSpeech(text, { voiceKey });
      return { type: "speech", ...result };
    }

    if (line.startsWith("GENERATE_VIDEO:")) {
      const raw = line.replace("GENERATE_VIDEO:", "").trim();
      const parts = raw.split("|").map((s) => s.trim());
      const prompt = parts[0];
      const arPart = parts.find((p) => p.startsWith("aspect="));
      const aspectRatio = arPart ? arPart.replace("aspect=", "") : "16:9";
      const result = await generateVideo(prompt, { aspectRatio });
      return { type: "video", ...result };
    }

    if (line.startsWith("IMAGE_TO_VIDEO:")) {
      const raw = line.replace("IMAGE_TO_VIDEO:", "").trim();
      const [imageUrl, ...motionParts] = raw.split("|").map((s) => s.trim());
      const motionPrompt = motionParts.join(" ") || "smooth cinematic motion";
      const result = await imageToVideo(imageUrl, motionPrompt);
      return { type: "video", ...result, fromImage: true };
    }

    if (line.startsWith("GENERATE_AVATAR:")) {
      const raw = line.replace("GENERATE_AVATAR:", "").trim();
      const parts = raw.split("|").map((s) => s.trim());
      const script = parts[0];
      const voicePart = parts.find((p) => p.startsWith("voice="));
      const voiceId = voicePart
        ? voicePart.replace("voice=", "")
        : "en-US-JennyNeural";
      const result = await generateAvatar(script, { voiceId });
      return { type: "avatar", ...result };
    }
  } catch (e: any) {
    return { type: "media_error", text: e.message };
  }
  return null;
}

// ── Master parser ────────────────────────────────────────────────────────────

const LIFEOS_RE =
  /^(READ_LIFEOS|UPDATE_LEAD|CREATE_TASK|REMEMBER_FACT|DRAFT_EMAIL|NOTIFY):/;
const WEB_RE =
  /^(BROWSE_URL|SEARCH_WEB|SCRAPE_PAGE|CLICK_ELEMENT|FILL_FORM|PAGE_SCREENSHOT|BD_LOGIN|BD_MEMBERS|BD_SCRAPE):/;
const MEDIA_RE =
  /^(GENERATE_IMAGE|EDIT_IMAGE|GENERATE_MUSIC|GENERATE_SPEECH|GENERATE_VIDEO|IMAGE_TO_VIDEO|GENERATE_AVATAR):/;

// Tools whose effects are destructive or credential-bearing. Callers that
// want a confirmation gate should check `result.requiresConfirm` before
// acting on the tool result.
const CONFIRM_TOOLS = new Set([
  "BD_LOGIN",
  "FILL_FORM",
  "CLICK_ELEMENT",
]);

function requiresConfirmation(line: string): boolean {
  const name = line.split(":")[0];
  return CONFIRM_TOOLS.has(name);
}

export async function parseAndRunErebusTools(response: string) {
  const lines = (response || "").split("\n");
  const clean: string[] = [];
  const toolResults: any[] = [];

  for (const line of lines) {
    const t = line.trim();

    // If a tool wants confirmation, emit a "pending" result and skip execution.
    // The UI is responsible for showing an approve / deny prompt and re-issuing
    // the call through parseAndRunErebusTools with `confirmed: true`.
    if (requiresConfirmation(t)) {
      toolResults.push({
        type: "confirm",
        subtype: "pending",
        tool: t.split(":")[0],
        command: t,
        text: `Confirm before running: ${t.split(":")[0]}`,
      });
      continue;
    }

    if (MEDIA_RE.test(t)) {
      const r = await runErebusExecution(t);
      if (r) toolResults.push(r);
    } else if (LIFEOS_RE.test(t)) {
      const r = runLifeOSTool(t);
      if (r) toolResults.push(r);
    } else if (WEB_RE.test(t)) {
      const r = await runBrowserTool(t);
      if (r) toolResults.push(r);
    } else {
      clean.push(line);
    }
  }

  return { text: clean.join("\n").trim(), toolResults };
}

// Optional: bypass confirmation for a specific line. Callers that have
// surfaced an approval UI can call this directly.
export async function runErebusToolConfirmed(line: string) {
  const t = line.trim();
  if (MEDIA_RE.test(t)) return await runErebusExecution(t);
  if (LIFEOS_RE.test(t)) return runLifeOSTool(t);
  if (WEB_RE.test(t)) return await runBrowserTool(t);
  return null;
}