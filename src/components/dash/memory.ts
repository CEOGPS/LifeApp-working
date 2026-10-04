import { useCallback, useEffect, useState } from "react";
import { emptyBoard, sanitizeBoard, type Board } from "@/lib/lifeos/board";

export type Contact = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  kind: "personal" | "crm";
  avatar: string;
  stage: string;
};

export type Entry = { id: string; title: string; body: string; at: string };
export type MailFolder = "inbox" | "sent" | "drafts" | "spam" | "archive" | "trash";
export type MailItem = Entry & { folder: MailFolder; to: string; from: string; starred: boolean };
export type EmailAccount = { id: string; provider: "gmail" | "outlook" | "yahoo" | "imap"; email: string; name: string };
export type EmailList = { id: string; name: string; description: string; subscribers: string[] };
export type EmailCampaign = {
  id: string;
  name: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  listIds: string[];
  status: "draft" | "scheduled" | "sent";
  scheduledFor: string;
  sentAt: string;
  sent: number;
  opens: number;
  clicks: number;
  bounces: number;
  at: string;
};
export type EmailDomain = {
  id: string;
  domain: string;
  selector: string;
  policy: "none" | "quarantine" | "reject";
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  checkedAt: string;
};
export type EmailHub = { accounts: EmailAccount[]; lists: EmailList[]; campaigns: EmailCampaign[]; domains: EmailDomain[] };
export type ChatLine = { id: string; who: string; text: string; mine: boolean };
export type SongIdea = { id: string; title: string; note: string };
export type Idea = { id: string; title: string; note: string; approved: boolean };
export type KeyRow = { id: string; name: string; value: string };

export type Memory = Board & {
  contacts: Contact[];
  journal: Entry[];
  mail: MailItem[];
  thread: ChatLine[];
  projects: Entry[];
  vault: Entry[];
  legal: Entry[];
  media: Entry[];
  songs: SongIdea[];
  ideas: Idea[];
  keys: KeyRow[];
  query: string;
  emailHub: EmailHub;
};

const KEY = "lifeos.shell.v1";
const BACKUP = "lifeos.shell.backup";
const VAULT_KEY = "lifeos.vault.v1";
const AT = "lifeos.savedAt";
const DEVICE = "lifeos.device";

function id() {
  return crypto.randomUUID();
}

export function seed(): Memory {
  return {
    ...emptyBoard(),
    contacts: [],
    journal: [],
    mail: [],
    thread: [
      {
        id: "hello",
        who: "Nyx",
        text: "I'm here. Ask about the board. I will only use what is saved on it.",
        mine: false,
      },
    ],
    projects: [],
    vault: [],
    legal: [],
    media: [],
    songs: [],
    ideas: [
      { id: "idea-1", title: "Local listing photos", note: "Offer a same-week photo pack to businesses already in Leads.", approved: false },
    ],
    keys: [],
    query: "",
    emailHub: { accounts: [], lists: [], campaigns: [], domains: [] },
  };
}

function entry(row: unknown): Entry | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Entry;
  return {
    id: String(r.id || id()).slice(0, 40),
    title: String(r.title || "").slice(0, 120),
    body: String(r.body || "").slice(0, 8000),
    at: String(r.at || new Date().toISOString()).slice(0, 40),
  };
}

function mailItem(row: unknown): MailItem | null {
  const base = entry(row);
  if (!base) return null;
  const r = row as Partial<MailItem>;
  const folder = r.folder === "sent" || r.folder === "drafts" || r.folder === "trash" || r.folder === "spam" || r.folder === "archive" ? r.folder : "inbox";
  return { ...base, folder, to: String(r.to || "").slice(0, 120), from: String(r.from || "").slice(0, 120), starred: Boolean(r.starred) };
}

function emails(value: unknown) {
  return String(value || "").split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)).slice(0, 500);
}

function hub(value: unknown): EmailHub {
  const raw = value && typeof value === "object" ? (value as EmailHub) : { accounts: [], lists: [], campaigns: [], domains: [] };
  const list = <T,>(rows: unknown, map: (row: unknown) => T | null) =>
    Array.isArray(rows) ? rows.map(map).filter((row): row is T => row !== null).slice(0, 100) : [];
  return {
    accounts: list(raw.accounts, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as EmailAccount;
      const provider = r.provider === "outlook" || r.provider === "yahoo" || r.provider === "imap" ? r.provider : "gmail";
      const email = String(r.email || "").slice(0, 120);
      if (!email) return null;
      return { id: String(r.id || id()).slice(0, 40), provider, email, name: String(r.name || email).slice(0, 80) };
    }),
    lists: list(raw.lists, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as EmailList;
      const name = String(r.name || "").slice(0, 80);
      if (!name) return null;
      return { id: String(r.id || id()).slice(0, 40), name, description: String(r.description || "").slice(0, 200), subscribers: emails(Array.isArray(r.subscribers) ? r.subscribers.join(" ") : "") };
    }),
    campaigns: list(raw.campaigns, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as EmailCampaign;
      const name = String(r.name || "").slice(0, 80);
      if (!name) return null;
      const status = r.status === "scheduled" || r.status === "sent" ? r.status : "draft";
      return {
        id: String(r.id || id()).slice(0, 40),
        name,
        fromName: String(r.fromName || "").slice(0, 80),
        fromEmail: String(r.fromEmail || "").slice(0, 120),
        subject: String(r.subject || "").slice(0, 140),
        body: String(r.body || "").slice(0, 8000),
        listIds: Array.isArray(r.listIds) ? r.listIds.map((item) => String(item).slice(0, 40)).slice(0, 30) : [],
        status,
        scheduledFor: String(r.scheduledFor || "").slice(0, 40),
        sentAt: String(r.sentAt || "").slice(0, 40),
        sent: Number(r.sent) || 0,
        opens: Number(r.opens) || 0,
        clicks: Number(r.clicks) || 0,
        bounces: Number(r.bounces) || 0,
        at: String(r.at || new Date().toISOString()).slice(0, 40),
      };
    }),
    domains: list(raw.domains, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as EmailDomain;
      const domain = String(r.domain || "").toLowerCase().slice(0, 80);
      if (!domain.includes(".")) return null;
      const policy = r.policy === "quarantine" || r.policy === "reject" ? r.policy : "none";
      return { id: String(r.id || id()).slice(0, 40), domain, selector: String(r.selector || "lifeos").slice(0, 40), policy, spf: Boolean(r.spf), dkim: Boolean(r.dkim), dmarc: Boolean(r.dmarc), checkedAt: String(r.checkedAt || "").slice(0, 40) };
    }),
  };
}

export function sanitizeMemory(input: unknown): Memory {
  const base = seed();
  const board = sanitizeBoard(input);
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const list = <T,>(value: unknown, map: (row: unknown) => T | null) =>
    Array.isArray(value) ? value.map(map).filter((row): row is T => row !== null).slice(0, 200) : [];
  return {
    ...board,
    contacts: list(raw.contacts, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Contact;
      return {
        id: String(r.id || id()).slice(0, 40),
        name: String(r.name || "").slice(0, 80),
        company: String(r.company || "").slice(0, 80),
        email: String(r.email || "").slice(0, 120),
        phone: String(r.phone || "").slice(0, 40),
        city: String(r.city || "").slice(0, 60),
        kind: r.kind === "crm" ? "crm" : "personal",
        avatar: String(r.avatar || "").slice(0, 500),
        stage: String(r.stage || "New").slice(0, 40),
      };
    }),
    journal: list(raw.journal, entry),
    mail: list(raw.mail, mailItem),
    thread: list(raw.thread, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as ChatLine;
      return {
        id: String(r.id || id()).slice(0, 40),
        who: String(r.who || "Nyx").slice(0, 40),
        text: String(r.text || "").slice(0, 1000),
        mine: Boolean(r.mine),
      };
    }),
    projects: list(raw.projects, entry),
    vault: list(raw.vault, entry),
    legal: list(raw.legal, entry),
    media: list(raw.media, entry),
    songs: list(raw.songs, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as SongIdea;
      return { id: String(r.id || id()).slice(0, 40), title: String(r.title || "").slice(0, 80), note: String(r.note || "").slice(0, 500) };
    }),
    ideas: list(raw.ideas, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Idea;
      return {
        id: String(r.id || id()).slice(0, 40),
        title: String(r.title || "").slice(0, 80),
        note: String(r.note || "").slice(0, 500),
        approved: Boolean(r.approved),
      };
    }),
    keys: list(raw.keys, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as KeyRow;
      return { id: String(r.id || id()).slice(0, 40), name: String(r.name || "").slice(0, 60), value: String(r.value || "").slice(0, 400) };
    }),
    query: String(raw.query || "").slice(0, 120),
    emailHub: hub(raw.emailHub),
  };
}

function readVault(): Entry[] {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows.map(entry).filter((row): row is Entry => row !== null) : [];
  } catch {
    return [];
  }
}

function unionById<T extends { id: string }>(local: T[], remote: T[]) {
  const map = new Map<string, T>();
  for (const row of local) map.set(row.id, row);
  for (const row of remote) if (!map.has(row.id)) map.set(row.id, row);
  return [...map.values()];
}

function read(): Memory {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(BACKUP);
    const next = raw ? sanitizeMemory(JSON.parse(raw)) : seed();
    const vault = readVault();
    if (vault.length) next.vault = vault;
    return next;
  } catch {
    return seed();
  }
}

let memory = seed();
let statusText = "This browser";
let hydrated = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function deviceId() {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem(DEVICE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE, id);
  }
  return id;
}

export function bootMemory() {
  memory = read();
  emit();
}

function rememberLocal() {
  localStorage.setItem(VAULT_KEY, JSON.stringify(memory.vault));
  localStorage.setItem(KEY, JSON.stringify(memory));
  const backup = { ...memory, keys: [], vault: [] };
  localStorage.setItem(BACKUP, JSON.stringify(backup));
  localStorage.setItem(AT, String(Date.now()));
}

function schedulePush() {
  if (!hydrated) return;
  clearTimeout(pushTimer);
  statusText = "Syncing";
  emit();
  pushTimer = setTimeout(() => {
    void pushNow();
  }, 600);
}

async function pushNow() {
  try {
    const { pushBoard } = await import("@/lib/lifeos/sync");
    const copy = { ...memory, keys: [], vault: [] };
    const result = await pushBoard({ data: { device: deviceId(), payload: JSON.stringify(copy) } });
    if (result.at) localStorage.setItem(AT, String(result.at));
    statusText = "Synced";
  } catch {
    statusText = "Saved on this browser";
  }
  emit();
}

export async function hydrateMemory() {
  bootMemory();
  try {
    const { pullBoard } = await import("@/lib/lifeos/sync");
    const remote = await pullBoard({ data: deviceId() });
    const localAt = Number(localStorage.getItem(AT) || 0);
    if (remote?.payload && remote.at > localAt) {
      const incoming = sanitizeMemory(JSON.parse(remote.payload));
      incoming.logo = memory.logo || incoming.logo;
      incoming.banner = memory.banner || incoming.banner;
      incoming.notes = unionById(memory.notes, incoming.notes);
      incoming.tasks = unionById(memory.tasks, incoming.tasks);
      incoming.leads = unionById(memory.leads, incoming.leads);
      incoming.notifs = unionById(memory.notifs, incoming.notifs);
      incoming.jobs = unionById(memory.jobs, incoming.jobs);
      incoming.accounts = unionById(memory.accounts, incoming.accounts);
      incoming.products = unionById(memory.products, incoming.products);
      incoming.expenses = unionById(memory.expenses, incoming.expenses);
      incoming.events = unionById(memory.events, incoming.events);
      incoming.links = unionById(memory.links, incoming.links);
      incoming.tracks = unionById(memory.tracks, incoming.tracks);
      incoming.social = unionById(memory.social, incoming.social);
      incoming.marketing = unionById(memory.marketing, incoming.marketing);
      incoming.contacts = unionById(memory.contacts, incoming.contacts);
      incoming.journal = unionById(memory.journal, incoming.journal);
      incoming.mail = unionById(memory.mail, incoming.mail);
      incoming.thread = unionById(memory.thread, incoming.thread);
      incoming.projects = unionById(memory.projects, incoming.projects);
      incoming.legal = unionById(memory.legal, incoming.legal);
      incoming.media = unionById(memory.media, incoming.media);
      incoming.songs = unionById(memory.songs, incoming.songs);
      incoming.ideas = unionById(memory.ideas, incoming.ideas);
      incoming.keys = memory.keys;
      incoming.query = memory.query || incoming.query;
      incoming.vault = readVault().length ? readVault() : memory.vault;
      incoming.emailHub = {
        accounts: unionById(memory.emailHub.accounts, incoming.emailHub.accounts),
        lists: unionById(memory.emailHub.lists, incoming.emailHub.lists),
        campaigns: unionById(memory.emailHub.campaigns, incoming.emailHub.campaigns),
        domains: unionById(memory.emailHub.domains, incoming.emailHub.domains),
      };
      memory = incoming;
      rememberLocal();
      statusText = "Synced";
    } else {
      statusText = "Saved on this browser";
    }
  } catch {
    statusText = "Saved on this browser";
  }
  hydrated = true;
  emit();
}

export function adoptDevice(next: string) {
  const id = next.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  localStorage.setItem(DEVICE, id);
  localStorage.setItem(AT, "0");
  hydrated = false;
  void hydrateMemory();
  return true;
}

export function updateMemory(recipe: (prev: Memory) => Memory) {
  memory = recipe(memory);
  rememberLocal();
  emit();
  schedulePush();
}

export function useMemory() {
  const [data, setData] = useState(memory);
  const [status, setStatus] = useState(statusText);
  useEffect(() => {
    const listener = () => {
      setData(memory);
      setStatus(statusText);
    };
    listeners.add(listener);
    void hydrateMemory();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const update = useCallback((recipe: (prev: Memory) => Memory) => updateMemory(recipe), []);
  return { data, update, status };
}

export function newId() {
  return id();
}
