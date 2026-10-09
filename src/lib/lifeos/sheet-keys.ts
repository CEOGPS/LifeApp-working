export const SERVICE_ENV: Record<string, string[]> = {
  NVIDIA: ["NVIDIA_API_KEY", "NVAPI_KEY", "VITE_NVIDIA_API_KEY"],
  ElevenLabs: ["ELEVENLABS_API_KEY", "VITE_ELEVENLABS_API_KEY"],
  "Cloudflare Account": ["CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"],
  "Cloudflare Token": ["CF_API_TOKEN", "CLOUDFLARE_API_TOKEN"],
  Luma: ["LUMA_API_KEY", "VITE_LUMA_API_KEY"],
  Nylas: ["NYLAS_API_KEY", "NYLAS_GRANT_KEY_CEOGPS", "NYLAS_GRANT_KEY_CAGEDNREALITY", "NYLAS_GRANT_KEY_CHRISGR33NINC"],
  Discord: ["DISCORD_CLIENT_SECRET"],
  Bing: ["BING_SEARCH_API_KEY", "BING_API_KEY"],
  Brave: ["BRAVE_SEARCH_API_KEY", "BRAVE_API_KEY"],
  Dogpile: ["DOGPILE_API_KEY"],
  Instagram: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_API_KEY", "INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"],
  LinkedIn: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_API_KEY"],
  Snapchat: ["SNAPCHAT_API_KEY", "SNAPCHAT_ACCESS_TOKEN"],
  TikTok: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_API_KEY"],
  Yahoo: ["YAHOO_API_KEY", "YAHOO_CLIENT_SECRET"],
  Reddit: ["REDDIT_ACCESS_TOKEN", "REDDIT_API_KEY"],
  X: ["X_ACCESS_TOKEN", "TWITTER_ACCESS_TOKEN"],
  YouTube: ["YOUTUBE_DATA_V3_API_KEY", "VITE_YOUTUBE_API_KEY", "YOUTUBE_API_KEY"],
  OpenAI: ["OPENAI_API_KEY", "VITE_OPENAI_API_KEY", "VOICE_TOOLS_OPENAI_KEY"],
  Anthropic: ["ANTHROPIC_API_KEY"],
  xAI: ["XAI_API_KEY", "GROK_API_KEY"],
  "Grok (xAI)": ["XAI_API_KEY", "GROK_API_KEY"],
  Telegram: ["TELEGRAM_BOT_TOKEN"],
  "Google Analytics": ["GA_PROPERTY_ID", "GOOGLE_ANALYTICS_PROPERTY"],
  "Search Console": ["SEARCH_CONSOLE_SITE", "GSC_SITE_URL"],
  "Brilliant Directories": ["BRILLIANT_API_KEY", "BD_API_KEY"],
  "Brilliant Site": ["BRILLIANT_SITE", "BD_SITE"],
  GoDaddy: ["GODADDY_API_KEY", "GODADDY_KEY"],
  "GoDaddy Secret": ["GODADDY_API_SECRET", "GODADDY_SECRET"],
  Supabase: ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  "Facebook App ID": ["FACEBOOK_APP_ID", "VITE_FACEBOOK_APP_ID"],
  SendGrid: ["SENDGRID_API_KEY"],
  Brevo: ["BREVO_API_KEY"],
  Spotify: ["SPOTIFY_CLIENT_SECRET", "SPOTIFY_CLIENT_ID"],
  Replicate: ["REPLICATE_API_TOKEN", "VITE_REPLICATE_API_KEY"],
  Stripe: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
  Hermes: ["HERMES_API_KEY"],
  Qwen: ["QWEN_API_KEY", "DASHSCOPE_API_KEY"],
  "Google Maps": ["GOOGLE_MAPS_API_KEY", "VITE_GOOGLE_MAPS_API_KEY"],
  Twilio: ["TWILIO_AUTH_TOKEN", "TWILIO_ACCOUNT_SID"],
  Groq: ["GROQ_API_KEY"],
  OpenRouter: ["OPENROUTER_API_KEY"],
  DeepSeek: ["DEEPSEEK_API_KEY"],
  Mistral: ["MISTRAL_API_KEY"],
  "Hugging Face": ["HUGGINGFACE_API_KEY", "HF_TOKEN"],
  Airtable: ["AIRTABLE_API_TOKEN"],
  Alibaba: ["ALIBABA_CLOUD_ACCESS_KEY_ID"],
  Browserbase: ["BROWSERBASE_API_KEY"],
  ClickUp: ["CLICKUP_API_TOKEN"],
  Cloudflare: ["CLOUDFLARE_GLOBAL_API_KEY"],
  Cron: ["CRON_API_KEY"],
  Dropbox: ["DROPBOX_ACCESS_TOKEN", "DROPBOX_APP_KEY"],
  Exa: ["EXA_API_KEY"],
  Firebase: ["FIREBASE_BROWSER_API_KEY"],
  Genies: ["GENIES_CLIENT_SECRET"],
  GitHub: ["GITHUB_PERSONAL_ACCESS_TOKEN", "GITHUB_CLIENT_SECRET", "GITHUB_OAUTH_CLIENT_SECRET"],
  "Google AI (Gemini)": ["GEMINI_API_KEY"],
  "Gmail (OAuth)": ["GMAIL_API_KEY"],
  Jotform: ["JOTFORM_API_KEY"],
  Kling: ["KLING_API_KEY"],
  Linear: ["LINEAR_API_KEY"],
  LunarCrush: ["LUNAR_CRUSH_API_KEY"],
  "Make (Integromat)": ["MAKE_COM_API_KEY"],
  "Meta LLaMA": ["METALLAMA_API_KEY"],
  Notion: ["NOTION_API_KEY"],
  "Ollama (local)": ["OLLAMA_API_KEY"],
  PocketBase: ["POCKETBASE_API_KEY"],
  Runwav: ["RUNWAY_API_KEY"],
  Slack: ["SLACK_OAUTH_TOKEN"],
  "Stability AI": ["STABILITY_AI_API_KEY"],
  Vercel: ["AI_GATEWAY_KEY"],
  "Azure AI": ["AZURE_CLIENT_ID"],
  Firecrawl: ["VITE_FIRECRAWL_API_KEY", "FIRECRAWL_API_KEY"],
  GLM: ["GLM_API_KEY"],
  Kimi: ["KIMI_API_KEY"],
  Meta: ["META_PAGE_ACCESS_TOKEN", "META_APP_SECRET", "META_APP_ID"],
  Microsoft: ["MICROSOFT_CLIENT_SECRET", "MICROSOFT_CLIENT_ID"],
  Parallel: ["PARALLEL_API_KEY"],
  Weather: ["OPEN_WEATHER_MAP_API_KEY", "VITE_WEATHER_API_KEY"],
  Xiaomi: ["XIAOMI_API_KEY"],
  Zoom: ["ZOOM_CLIENT_SECRET", "ZOOM_CLIENT_ID"],
};

function normKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function addPair(bag: Record<string, string>, name: string, value: string) {
  const key = name.trim().replace(/^export\s+/i, "");
  let next = value.trim().replace(/^\uFEFF/, "");
  if ((next.startsWith('"') && next.endsWith('"')) || (next.startsWith("'") && next.endsWith("'"))) next = next.slice(1, -1);
  if (!key || !next || next.length < 4) return;
  if (/^(your[-_ ]?key|changeme|todo|xxx+|placeholder|none|null|undefined)$/i.test(next)) return;
  if (!bag[key]) bag[key] = next.slice(0, 2000);
}

function cellsOf(line: string) {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim().replace(/^"|"$/g, ""));
  if (line.includes(",") && !line.includes("=")) return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
  return [line];
}

function parseSheet(text: string) {
  const bag: Record<string, string> = {};
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const record = row as Record<string, unknown>;
        const named = String(record.name || record.service || record.integration || "");
        const value = String(record.value || record.secret || record.token || record.apiKey || record.api_key || "");
        if (named && value) addPair(bag, named, value);
        else for (const [key, item] of Object.entries(record)) if (typeof item === "string") addPair(bag, key, item);
      }
      return bag;
    } catch { /* plain text below */ }
  }
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && !line.startsWith("//") && !line.startsWith("["));
  const header = cellsOf(lines[0] || "").map((cell) => cell.toLowerCase().replace(/[^a-z_]/g, ""));
  const nameCol = header.findIndex((cell) => ["name", "service", "integration", "platform", "key", "env", "variable"].includes(cell));
  const valueCol = header.findIndex((cell) => ["value", "secret", "token", "apikey", "api_key", "keyvalue"].includes(cell));
  if (lines.length > 1 && nameCol >= 0 && valueCol >= 0 && nameCol !== valueCol) {
    for (const line of lines.slice(1)) {
      const cells = cellsOf(line);
      addPair(bag, cells[nameCol] || "", cells[valueCol] || "");
    }
    return bag;
  }
  for (const line of lines) {
    const cells = cellsOf(line);
    if (cells.length >= 2 && !line.includes("=")) {
      addPair(bag, cells[0], cells.slice(1).join(line.includes("\t") ? "\t" : ","));
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0) {
      addPair(bag, line.slice(0, eq), line.slice(eq + 1));
      continue;
    }
    const colon = line.indexOf(":");
    if (colon > 0 && !line.slice(0, colon).includes("/")) addPair(bag, line.slice(0, colon), line.slice(colon + 1));
  }
  return bag;
}

export function sheetKeys(text: string, names: string[]) {
  const alias = new Map<string, string>();
  for (const [service, keys] of Object.entries(SERVICE_ENV)) {
    alias.set(normKey(service), service);
    for (const key of keys) alias.set(normKey(key), service);
  }
  for (const name of names) alias.set(normKey(name), name);
  const found: { name: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const [raw, value] of Object.entries(parseSheet(text))) {
    const service = alias.get(normKey(raw));
    if (!service || seen.has(service)) continue;
    seen.add(service);
    found.push({ name: service, value });
  }
  return found;
}
