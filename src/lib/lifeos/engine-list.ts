export type Engine = {
  id: string;
  name: string;
  panels: string[];
  mode: "board" | "key" | "http" | "skip";
  url: string;
  health: string;
  key?: string;
  note: string;
};

export const ENGINES: Engine[] = [
  { id: "mem0", name: "Mem0", panels: ["AI Hub"], mode: "board", url: "", health: "", note: "Facts stay on the board and go to Supabase with it." },
  { id: "letta", name: "Letta", panels: ["AI Hub"], mode: "skip", url: "", health: "", note: "Not added beside Erebus. It would replace the agent loop." },
  { id: "browser-use", name: "Browser Use", panels: ["AI Hub", "Lucid"], mode: "http", url: "http://127.0.0.1:7788", health: "/health", note: "Clicks a real browser when that service is running." },
  { id: "crawl4ai", name: "Crawl4AI", panels: ["Lucid"], mode: "http", url: "http://127.0.0.1:11235", health: "/health", note: "Paste a page URL. Lucid reads the text. It does not open accounts." },
  { id: "n8n", name: "n8n", panels: ["Lucid"], mode: "http", url: "http://127.0.0.1:5678", health: "/healthz", note: "Runs an approved job. Set N8N_WEBHOOK_URL to send one." },
  { id: "ace-step", name: "ACE-Step", panels: ["Music Einstein"], mode: "key", url: "", health: "", key: "REPLICATE_API_TOKEN", note: "Already the song engine. The Create button uses it." },
  { id: "yue", name: "YuE", panels: ["Music Einstein"], mode: "http", url: "http://127.0.0.1:8091", health: "/health", note: "Longer songs. Needs the YuE service on this machine." },
  { id: "diffrhythm", name: "DiffRhythm", panels: ["Music Einstein"], mode: "http", url: "http://127.0.0.1:8092", health: "/health", note: "Fast full songs. Needs the DiffRhythm service on this machine." },
  { id: "wan", name: "Wan 2.2", panels: ["Creator"], mode: "key", url: "", health: "", key: "REPLICATE_API_TOKEN", note: "Already the Wan button. No Luma required." },
  { id: "ltx", name: "LTX-2", panels: ["Creator"], mode: "http", url: "http://127.0.0.1:8093", health: "/health", note: "Video with sound. Needs the LTX service on a larger GPU." },
  { id: "musetalk", name: "MuseTalk", panels: ["Creator"], mode: "http", url: "http://127.0.0.1:8094", health: "/health", note: "Still plus a voice file. Needs MuseTalk running locally." },
  { id: "liveportrait", name: "LivePortrait", panels: ["Creator"], mode: "http", url: "http://127.0.0.1:8095", health: "/health", note: "Moves a portrait. It does not write the words." },
  { id: "postiz", name: "Postiz", panels: ["Social"], mode: "http", url: "http://127.0.0.1:5000", health: "/", note: "Scheduler beside Social. This button does not publish." },
  { id: "seonaut", name: "SEOnaut", panels: ["Marketing"], mode: "http", url: "http://127.0.0.1:9000", health: "/", note: "Full-site audit. The page check in Marketing still runs without it." },
  { id: "umami", name: "Umami", panels: ["Marketing"], mode: "http", url: "http://127.0.0.1:3100", health: "/api/heartbeat", note: "Site stats on 3100 so it does not take the dashboard port." },
  { id: "ghostfolio", name: "Ghostfolio", panels: ["Finance"], mode: "http", url: "http://127.0.0.1:3333", health: "/api/v1/health", note: "Holdings stay on the finance board. Ghostfolio is not a second panel." },
  { id: "actual", name: "Actual", panels: ["Finance"], mode: "http", url: "http://127.0.0.1:5006", health: "/", note: "Budget accounts stay on the finance board." },
];
