import { boardFacts } from "./facts";
import type { Memory } from "./memory";
import { PACK } from "./skills/pack-index";
import checkSkill from "./skills/check-work.md?raw";
import reviewSkill from "./skills/code-review.md?raw";
import createSkill from "./skills/create-skill.md?raw";
import imagineSkill from "./skills/imagine.md?raw";
import helpSkill from "./skills/help.md?raw";

export type Skill = { id: string; group: string; name: string; live: boolean; note: string };

export const AGENT_SKILLS: Skill[] = [
  { id: "search", group: "Browser", name: "Web search", live: true, note: "Live results from the same sources as OmniSearch." },
  { id: "page", group: "Browser", name: "Page read", live: true, note: "Reads a public http page title and description." },
  { id: "youtube", group: "Browser", name: "YouTube search", live: true, note: "Search only. It does not click through a browser." },
  { id: "contacts", group: "Data", name: "Contact book", live: true, note: "Searches the saved personal and CRM contacts." },
  { id: "finance", group: "Finance", name: "Finance sheet", live: true, note: "Accounts, bills, products, invoices, and scores on the board." },
  { id: "quote", group: "Finance", name: "Market quote", live: true, note: "One live stock or crypto symbol." },
  { id: "csv", group: "Data", name: "CSV read", live: true, note: "Summarizes a pasted table. It does not write Excel on disk." },
  { id: "task", group: "Data", name: "Add task", live: true, note: "Saves a task on the board." },
  { id: "note", group: "Content", name: "Save note", live: true, note: "Saves a note on the board." },
  { id: "reason", group: "Reasoning", name: "Board reasoning", live: true, note: "Answers only from the saved sheet and the tool result." },
  { id: "code-review", group: "Code", name: "Code review", live: true, note: "Reads code you paste. It does not run it." },
  { id: "stack", group: "Code", name: "React, Node, TypeScript, Cloudflare", live: true, note: "Advises on this stack. It does not edit the repo from the dock." },
  { id: "playwright", group: "Browser", name: "Playwright / Puppeteer", live: false, note: "No browser driver is connected." },
  { id: "perplexity", group: "Browser", name: "Perplexity", live: false, note: "Needs a Perplexity key. Web search is the live fallback." },
  { id: "apify", group: "Browser", name: "Apify", live: false, note: "Needs an Apify token." },
  { id: "python", group: "Code", name: "Python interpreter", live: false, note: "No sandbox is connected. Pasted code is reviewed, not executed." },
  { id: "shell", group: "Code", name: "Shell / computer use", live: false, note: "The dock cannot run commands on your computer." },
  { id: "git", group: "Code", name: "Git / GitHub write", live: false, note: "Public GitHub search works. Commits and pull requests do not." },
  { id: "sql", group: "Data", name: "SQL database", live: false, note: "No database session is attached to the agent." },
  { id: "vector", group: "Data", name: "Pinecone / Qdrant / Milvus", live: false, note: "No vector database is connected." },
  { id: "mail", group: "Comms", name: "Gmail / Outlook send", live: false, note: "Drafts can be saved as notes. Sending is not connected here." },
  { id: "slack", group: "Comms", name: "Slack / Discord", live: false, note: "No webhook is connected." },
  { id: "twilio", group: "Comms", name: "Twilio SMS", live: false, note: "Needs a Twilio key." },
  { id: "zapier", group: "Workflow", name: "Zapier / Make / n8n", live: false, note: "No automation webhook is connected." },
  { id: "pdf", group: "Media", name: "PDF / DOCX toolkit", live: false, note: "Office notes are HTML. A PDF engine is not connected." },
  { id: "image", group: "Media", name: "Image generation", live: true, note: "Use Image mode on the Erebus dock." },
  { id: "ffmpeg", group: "Media", name: "FFmpeg / Remotion", live: false, note: "Not available from the agent dock." },
  { id: "crm-api", group: "Sales", name: "Salesforce / HubSpot", live: false, note: "The CRM panel is the live book. Those APIs are not connected." },
  { id: "tickets", group: "Sales", name: "Jira / Linear / ServiceNow", live: false, note: "No ticket API is connected." },
  { id: "social", group: "Social", name: "Social posting", live: false, note: "Drafts stay on the board. Posting stays on the Social panel." },
  { id: "marketing", group: "Marketing", name: "Marketing tools", live: true, note: "Uses the saved board. The Marketing panel still runs the campaigns." },
  { id: "debug", group: "Code", name: "Debugging", live: true, note: "Reads the error you paste and the board. It does not attach a debugger." },
  { id: "auth", group: "App skills", name: "auth", live: true, note: "From the skills folder. Guidance only." },
  { id: "design-ui", group: "App skills", name: "design-ui", live: true, note: "From the skills folder. Guidance only." },
  { id: "xai-api", group: "App skills", name: "xai-api", live: true, note: "From the skills folder. Grok is the default mind." },
  { id: "neon", group: "App skills", name: "neon", live: false, note: "From the skills folder. This board does not use Neon." },
  { id: "threejs", group: "App skills", name: "threejs", live: true, note: "From the skills folder. Guidance only." },
  { id: "check-work", group: "Loaded", name: "Check work", live: true, note: "Ends with VERDICT: PASS or FAIL. Say /skill check-work." },
  { id: "code-review", group: "Loaded", name: "Strict code review", live: true, note: "Structure review. It does not rewrite the repo from the dock." },
  { id: "create-skill", group: "Loaded", name: "Create skill", live: true, note: "Drafts a skill. It does not write the repo from the dock." },
  { id: "imagine", group: "Loaded", name: "Imagine", live: true, note: "Image rules. Exact text and charts stay in code. Real people need a reference." },
  { id: "help", group: "Loaded", name: "Help", live: false, note: "Grok config is C:/Users/chris/.grok. This dashboard cannot read that folder." },
  ...PACK.map((row) => ({ id: row.id, group: "LifeApp", name: row.name, live: row.live, note: row.note })),
];

const BOOKS = [
  { id: "check-work", name: "Check work", keys: ["check work", "check-work", "self-verify"], body: checkSkill },
  { id: "code-review", name: "Strict code review", keys: ["code review", "maintainability"], body: reviewSkill },
  { id: "create-skill", name: "Create skill", keys: ["create skill", "create-skill"], body: createSkill },
  { id: "imagine", name: "Imagine", keys: ["imagine", "image gen", "image_gen"], body: imagineSkill },
  { id: "help", name: "Help", keys: ["/help", "grok help"], body: helpSkill },
  ...PACK.map((row) => ({ id: row.id, name: row.name, keys: [row.id], body: row.body })),
];

export function matchedSkill(text: string) {
  const q = text.toLowerCase();
  const asked = q.match(/^\/skill\s+([a-z0-9-]+)/);
  const hit = asked
    ? BOOKS.find((book) => book.id === asked[1]) || BOOKS.find((book) => book.id.startsWith(asked[1])) || BOOKS.find((book) => book.name.toLowerCase().includes(asked[1]))
    : BOOKS.find((book) => book.keys.some((key) => (key.includes("-") || key.includes(" ") || key.length >= 10) && q.includes(key)));
  if (!hit) return "";
  const body = hit.body.replace(/^---[\s\S]*?---\n/, "").slice(0, 4500);
  return `Loaded skill ${hit.name}. Follow it. Do not store tokens in the browser, do not run a shell, and do not claim a tool ran if it is off.\n${body}`;
}

export type ToolHit = { text: string; task?: string; noteTitle?: string; noteBody?: string; play?: string; spoken?: string };

function youtubeAsk(text: string) {
  if (!/you\s*tube|\byt\b|pull up (?:a |the )?(?:song|video|track)|play (?:a |the )?(?:song|video|track|music)/i.test(text)) return "";
  const named = text.match(/(?:play|pull up|put on|open|find|search(?: for)?|queue)\s+(.+)/i)?.[1] || text;
  const query = named
    .replace(/\b(on youtube|on you tube|on yt|youtube|you tube|please|for me|a song|the song|some music|a video|the video)\b/gi, " ")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (query || "popular songs").slice(0, 80);
}

export function skillBrief() {
  return "Live commands: /search, /page, /contacts, /finance, /quote, /youtube, /task, /note, /csv, /skill. A loaded skill is guidance. Never claim a shell, browser driver, SSH session, deploy, or send action ran unless a live command returned it.";
}

function csvSummary(text: string) {
  const rows = text.split(/\r?\n/).map((line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, "")));
  const head = rows[0] || [];
  return `CSV ${Math.max(0, rows.length - 1)} rows, ${head.length} columns: ${head.slice(0, 12).join(", ") || "none"}.`;
}

export async function runAgentTool(data: Memory, text: string): Promise<ToolHit | null> {
  const line = text.trim();
  const search = line.match(/^(?:\/search|\/web|search the web:?|look up)\s+(.+)/i);
  if (search) {
    const { lookup } = await import("@/lib/lifeos/sync");
    const result = await lookup({ data: { query: search[1].slice(0, 180), kind: "web", key: data.keys.find((row) => row.name === "Dogpile")?.value || "" } });
    const hits = result.hits.slice(0, 8).map((hit) => `${hit.title} — ${hit.url}`).join("\n");
    return { text: `Web search for ${search[1]}:\n${hits || result.note || "No results."}` };
  }
  const page = line.match(/^(?:\/page|\/scrape|read page)\s+(https?:\/\/\S+)/i);
  if (page) {
    const { inspectSite } = await import("@/lib/lifeos/sync");
    const result = await inspectSite({ data: page[1] });
    return { text: `Page ${result.status}: ${result.title || "No title"}. ${result.description || "No description."}` };
  }
  const videoQuery = youtubeAsk(line) || (line.match(/^(?:\/youtube|youtube)\s+(.+)/i)?.[1] || "");
  if (videoQuery) {
    const { youtubeSearch } = await import("@/lib/lifeos/sync");
    const result = await youtubeSearch({ data: { query: videoQuery.slice(0, 80) } });
    const first = result.videos?.[0];
    const hits = (result.videos || []).slice(0, 6).map((row) => `${row.title} — https://www.youtube.com/watch?v=${row.id}`).join("\n");
    return {
      text: `YouTube:\n${hits || result.error || "No videos."}`,
      play: videoQuery.slice(0, 80),
      spoken: first ? `Playing ${first.title} on YouTube.` : "I couldn't find that on YouTube.",
    };
  }
  const person = line.match(/^(?:\/contacts?|find contact)\s+(.+)/i);
  if (person) {
    const q = person[1].toLowerCase();
    const rows = data.contacts.filter((row) => `${row.name} ${row.company} ${row.phone} ${row.email} ${row.city}`.toLowerCase().includes(q)).slice(0, 12);
    return { text: rows.length ? rows.map((row) => `${row.name} | ${row.phone || ""} | ${row.email || ""} | ${row.company || ""} | ${row.kind}`).join("\n") : `No contact matched ${person[1]}. ${data.contacts.length} are saved.` };
  }
  if (/^\/finance\b/i.test(line) || /^finance sheet$/i.test(line)) {
    return { text: boardFacts(data, "accounts bills invoices products scores").split("\nContact book:")[0] };
  }
  const quote = line.match(/^(?:\/quote|quote|price of)\s+([A-Za-z0-9.-]{1,12})/i);
  if (quote) {
    const symbol = quote[1].toUpperCase();
    const kind = ["BTC", "ETH", "SOL", "XRP", "DOGE"].includes(symbol) ? "crypto" : "stock";
    const { watchQuote } = await import("@/lib/lifeos/sync");
    const result = await watchQuote({ data: { symbol, kind } });
    return { text: result.ok ? `${result.quote.symbol} ${result.quote.price} (${result.quote.change.toFixed(2)}%)` : result.error };
  }
  const task = line.match(/^\/task\s+(.+)/i);
  if (task) return { text: `Task saved: ${task[1].slice(0, 140)}`, task: task[1].slice(0, 140) };
  const note = line.match(/^\/note\s+([^\n]{1,80})\n?([\s\S]*)/i);
  if (note) return { text: `Note saved: ${note[1]}`, noteTitle: note[1].trim(), noteBody: (note[2] || note[1]).trim().slice(0, 4000) };
  if (/^\/csv\b/i.test(line)) return { text: csvSummary(line.replace(/^\/csv\s*/i, "")) };
  if (/^\/code\b|^```/.test(line)) return { text: "Code was not executed. The shell and Python sandbox are not connected. Ask for a review and I will answer from the paste." };
  const skill = matchedSkill(line);
  if (skill && /^\/skill\b/i.test(line)) return { text: skill };
  return null;
}
