export type Note = { id: string; title: string; body: string };
export type Task = { id: string; title: string; done: boolean };
export type Lead = { id: string; name: string; source: string; status: string; url?: string; note?: string };
export type Notif = { id: string; text: string; source: string; seen: boolean };
export type AgentJob = { id: string; agent: string; task: string; active: boolean };
export type Account = { id: string; name: string; balance: number; prior: number; kind?: string; institution?: string; last4?: string };
export type Product = { id: string; name: string; cost: number; revenue: number };
export type Expense = { id: string; name: string; amount: number; paid: boolean; fixed: boolean; category?: string };
export type WeekEvent = { id: string; day: number; title: string; date?: string; start?: string; end?: string; where?: string; who?: string; remind?: boolean };
export type QuickLink = { id: string; label: string; href: string };
export type Track = { id: string; title: string; url: string; artist: string; album: string; playlist: string; page: string; art: string };
export type Series = { id: string; label: string; points: number[] };

export type Board = {
  logo: string;
  banner: string;
  notes: Note[];
  tasks: Task[];
  leads: Lead[];
  notifs: Notif[];
  jobs: AgentJob[];
  accounts: Account[];
  products: Product[];
  fico: number;
  vantage: number;
  expenses: Expense[];
  events: WeekEvent[];
  links: QuickLink[];
  tracks: Track[];
  social: Series[];
  marketing: Series[];
};

export const emptyBoard = (): Board => ({
  logo: "",
  banner: "",
  notes: [],
  tasks: [],
  leads: [
    { id: "lead-nextdoor", name: "Neighborhood intro ask", source: "Nextdoor", status: "New" },
    { id: "lead-group", name: "Local group recommendation", source: "Facebook Groups", status: "Warm" },
  ],
  notifs: [
    { id: "n1", text: "Two warm leads have no next step.", source: "Leads", seen: false },
    { id: "n2", text: "Phone bill is still unpaid this cycle.", source: "Budget", seen: false },
  ],
  jobs: [
    { id: "j1", agent: "Erebus", task: "Read the board each morning", active: true },
    { id: "j2", agent: "Kranos", task: "Queue the unpaid bills", active: false },
  ],
  accounts: [
    { id: "a1", name: "Bank", balance: 4200, prior: 3900 },
    { id: "a2", name: "Stripe", balance: 860, prior: 640 },
    { id: "a3", name: "Cards", balance: -1200, prior: -1480 },
    { id: "a4", name: "Cash App", balance: 140, prior: 90 },
    { id: "a5", name: "Venmo", balance: 75, prior: 60 },
    { id: "a6", name: "OnePay", balance: 310, prior: 300 },
    { id: "a7", name: "Credit Karma", balance: 0, prior: 0 },
  ],
  products: [
    { id: "p1", name: "Listings", cost: 200, revenue: 900 },
    { id: "p2", name: "Retainers", cost: 400, revenue: 1800 },
  ],
  fico: 712,
  vantage: 698,
  expenses: [
    { id: "e1", name: "Rent", amount: 1450, paid: true, fixed: true },
    { id: "e2", name: "Phone", amount: 85, paid: false, fixed: true },
  ],
  events: [],
  links: [],
  tracks: [],
  social: [
    { id: "s1", label: "Followers", points: [120, 128, 131, 140, 138, 150, 156] },
    { id: "s2", label: "Reach", points: [800, 640, 910, 1000, 870, 1200, 1100] },
  ],
  marketing: [
    { id: "m1", label: "Site visits", points: [40, 55, 48, 70, 66, 80, 74] },
    { id: "m2", label: "Leads", points: [2, 1, 3, 2, 4, 3, 5] },
  ],
});

function arr<T>(value: unknown, map: (row: unknown) => T | null, max = 80): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(map).filter((row): row is T => row !== null).slice(0, max);
}

function text(value: unknown, max: number) {
  return String(value ?? "").slice(0, max);
}

function num(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function sanitizeBoard(input: unknown): Board {
  const base = emptyBoard();
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    logo: text(raw.logo, 500_000),
    banner: text(raw.banner, 500_000),
    notes: arr(raw.notes, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Note;
      const title = text(r.title, 80);
      const office = title.startsWith("Doc ·") || title.startsWith("Sheet ·");
      return { id: text(r.id, 40) || crypto.randomUUID(), title, body: text(r.body, office ? 20000 : 4000) };
    }),
    tasks: arr(raw.tasks, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Task;
      return { id: text(r.id, 40) || crypto.randomUUID(), title: text(r.title, 140), done: Boolean(r.done) };
    }),
    leads: arr(raw.leads, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Lead;
      const name = text(r.name, 120);
      if (!name) return null;
      return {
        id: text(r.id, 40) || crypto.randomUUID(),
        name,
        source: text(r.source, 80),
        status: text(r.status, 40) || "New",
        url: text(r.url, 400),
        note: text(r.note, 400),
      };
    }, 200),
    notifs: arr(raw.notifs, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Notif;
      return { id: text(r.id, 40) || crypto.randomUUID(), text: text(r.text, 200), source: text(r.source, 40), seen: Boolean(r.seen) };
    }),
    jobs: arr(raw.jobs, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as AgentJob;
      return { id: text(r.id, 40) || crypto.randomUUID(), agent: text(r.agent, 40), task: text(r.task, 160), active: Boolean(r.active) };
    }),
    accounts: arr(raw.accounts, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Account;
      return {
        id: text(r.id, 40) || crypto.randomUUID(),
        name: text(r.name, 40),
        balance: num(r.balance, -1_000_000, 10_000_000, 0),
        prior: num(r.prior, -1_000_000, 10_000_000, 0),
        kind: text((r as Account).kind, 24),
        institution: text((r as Account).institution, 40),
        last4: text((r as Account).last4, 4).replace(/\D/g, ""),
      };
    }),
    products: arr(raw.products, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Product;
      return {
        id: text(r.id, 40) || crypto.randomUUID(),
        name: text(r.name, 40),
        cost: num(r.cost, 0, 10_000_000, 0),
        revenue: num(r.revenue, 0, 10_000_000, 0),
      };
    }),
    fico: num(raw.fico, 300, 850, base.fico),
    vantage: num(raw.vantage, 300, 850, base.vantage),
    expenses: arr(raw.expenses, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Expense;
      return {
        id: text(r.id, 40) || crypto.randomUUID(),
        name: text(r.name, 60),
        amount: num(r.amount, 0, 1_000_000, 0),
        paid: Boolean(r.paid),
        fixed: Boolean(r.fixed),
        category: text((r as Expense).category, 24),
      };
    }),
    events: arr(raw.events, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as WeekEvent;
      const date = text(r.date, 10);
      const start = text(r.start, 5);
      const end = text(r.end, 5);
      return {
        id: text(r.id, 40) || crypto.randomUUID(),
        day: num(r.day, 0, 6, 0),
        title: text(r.title, 80),
        ...( /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {} ),
        ...( /^\d{2}:\d{2}$/.test(start) ? { start } : {} ),
        ...( /^\d{2}:\d{2}$/.test(end) ? { end } : {} ),
        ...( text(r.where, 80) ? { where: text(r.where, 80) } : {} ),
        ...( text(r.who, 80) ? { who: text(r.who, 80) } : {} ),
        ...( r.remind ? { remind: true } : {} ),
      };
    }),
    links: arr(raw.links, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as QuickLink;
      const href = text(r.href, 300);
      if (!/^https?:\/\//i.test(href)) return null;
      return { id: text(r.id, 40) || crypto.randomUUID(), label: text(r.label, 60), href };
    }),
    tracks: arr(raw.tracks, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Track;
      const url = text(r.url, 2000);
      const page = text(r.page, 2000);
      const local = url.startsWith("idb:");
      if (url && !local && !/^https?:\/\//i.test(url)) return null;
      if (!url && !/^https?:\/\//i.test(page)) return null;
      return {
        id: text(r.id, 40) || crypto.randomUUID(),
        title: text(r.title, 120),
        url,
        artist: text(r.artist, 80),
        album: text(r.album, 80),
        playlist: text(r.playlist, 40) || "Library",
        page,
        art: text(r.art, 400),
      };
    }, 400),
    social: series(raw.social, base.social),
    marketing: series(raw.marketing, base.marketing),
  };
}

function series(value: unknown, fallback: Series[]): Series[] {
  const rows = arr(value, (row) => {
    if (!row || typeof row !== "object") return null;
    const r = row as Series;
    const points = Array.isArray(r.points) ? r.points.slice(0, 7).map((n) => num(n, 0, 1_000_000, 0)) : [];
    while (points.length < 7) points.push(0);
    return { id: text(r.id, 40) || crypto.randomUUID(), label: text(r.label, 40), points };
  });
  return rows.length ? rows.slice(0, 4) : fallback;
}

export function band(score: number) {
  if (score < 580) return "Poor";
  if (score < 670) return "Fair";
  if (score < 740) return "Good";
  return "Great";
}

export function moneyTips(board: Board) {
  const unpaid = board.expenses.filter((row) => !row.paid);
  const debt = board.accounts.filter((row) => row.balance < 0);
  const tips = [];
  if (unpaid.length) tips.push(`Pay ${unpaid.map((row) => row.name).join(", ")} before adding new spend.`);
  if (debt.length) tips.push(`${debt[0].name} is negative. Extra cash should hit that before savings.`);
  if (board.fico < 740) tips.push("Keep card use under 30% of the limit to move the FICO band.");
  if (!tips.length) tips.push("Balances are ahead of last quarter. Leave the surplus parked, not spent.");
  return tips.slice(0, 3);
}

export function insights(board: Board) {
  const open = board.tasks.filter((row) => !row.done).length;
  const warm = board.leads.filter((row) => row.status !== "Closed").length;
  const net = board.accounts.reduce((sum, row) => sum + row.balance, 0);
  return [
    `${open} open tasks and ${warm} open leads. Close one lead before adding another task.`,
    `Net across the seven accounts is $${net.toLocaleString()}.`,
    board.notes.length ? `Newest note: ${board.notes[0].title || "Untitled"}.` : "No notes yet. A note gives Erebus something personal to use.",
  ];
}

export const LIFE_HACKS = [
  { title: "2-Minute Rule", body: "If it takes under two minutes, do it now." },
  { title: "Pay Yourself First", body: "Move 10% aside before any other spend." },
  { title: "Batch Email", body: "Open mail at three set times, not all day." },
  { title: "48-Hour Cart", body: "Wait two days on anything that is not a bill or a job." },
  { title: "3 Big Rocks", body: "Three tasks finish the day. The rest can wait." },
  { title: "Mirror Test", body: "If you would not say it in person, do not send it." },
];

export function lifeHacks(board: Board) {
  const hacks = [
    "Block the first 25 minutes after wake-up for the oldest unpaid bill or oldest lead.",
  ];
  if (board.events.length === 0) hacks.push("Put one real appointment on the 7-day strip so the week is not only tasks.");
  if (board.links.length === 0) hacks.push("Pin the sheet you open every morning in Quicklinks so you stop hunting for it.");
  hacks.push("One compliment or check-in to a saved contact beats another hour in a feed.");
  return hacks.slice(0, 3);
}
