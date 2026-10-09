import { useCallback, useEffect, useState } from "react";
import { emptyBoard, sanitizeBoard, type Board } from "@/lib/lifeos/board";
import { fmtDateInput, fmtPhone } from "./format";

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  kind: "personal" | "crm";
  avatar: string;
  stage: string;
  deal: string;
  note: string;
  birthday: string;
  address: string;
  state: string;
  zip: string;
  emails: string[];
  phones: string[];
  websites: string[];
  socials: string[];
  jobTitle: string;
  source: string;
  tag: string;
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
export type ChatLine = { id: string; who: string; text: string; mine: boolean; platform?: string };
export type SongIdea = { id: string; title: string; note: string; lyrics?: string; liked?: boolean; pub?: boolean; cover?: string; audio?: string; video?: string };
export type Idea = {
  id: string;
  title: string;
  note: string;
  approved: boolean;
  status: "new" | "approved" | "ready" | "running" | "paused" | "dropped";
  source: string;
  effort: "low" | "medium";
  email: string;
  funding: string;
  log: string;
};
export type Deal = {
  id: string;
  ideaId: string;
  client: string;
  email: string;
  phone: string;
  status: "lead" | "proposed" | "active" | "paid" | "closed";
  amount: number;
  paid: boolean;
  next: string;
};
export type KeyRow = { id: string; name: string; value: string };
export type Fact = { id: string; text: string; source: string; at: string };
export type SocialAccount = {
  id: "instagram" | "facebook" | "x" | "tiktok" | "linkedin" | "youtube" | "reddit" | "snapchat";
  name: string;
  handle: string;
  bio: string;
  followers: number;
  following: number;
  likes: number;
  comments: number;
  views: number;
  connected: boolean;
  history: number[];
};
export type SocialPost = { id: string; text: string; platforms: SocialAccount["id"][]; at: string; scheduled: string; sent: string };
export type StatRow = { id: string; label: string; value: number; points: number[] };
export type GroupSource = { id: string; label: string; url: string };

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
  deals: Deal[];
  keys: KeyRow[];
  facts: Fact[];
  query: string;
  emailHub: EmailHub;
  socialAccounts: SocialAccount[];
  socialPosts: SocialPost[];
  stats: StatRow[];
  groups: GroupSource[];
};

const KEY = "lifeos.shell.v1";
const BACKUP = "lifeos.shell.backup";
const VAULT_KEY = "lifeos.vault.v1";
const AT = "lifeos.savedAt";
const DEVICE = "lifeos.device";
const BANNER_KEY = "lifeos.banner";
const LOGO_KEY = "lifeos.logo";
const KEYS_KEY = "lifeos.keys.v1";

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
      { id: "idea-1", title: "Local listing photos", note: "", approved: false, status: "new", source: "Manual", effort: "low", email: "", funding: "", log: "Offer a same-week photo pack to businesses already in Leads." },
    ],
    deals: [],
    keys: [],
    facts: [],
    query: "",
    emailHub: { accounts: [], lists: [], campaigns: [], domains: [] },
    socialAccounts: [],
    socialPosts: [],
    stats: [],
    groups: [],
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
  const list = <T,>(value: unknown, map: (row: unknown) => T | null, keep: "head" | "tail" = "head", max = 200) => {
    const rows = Array.isArray(value) ? value.map(map).filter((row): row is T => row !== null) : [];
    return keep === "tail" ? rows.slice(-max) : rows.slice(0, max);
  };
  const texts = (value: unknown, max = 12) => (Array.isArray(value) ? value : []).map((item) => String(item || "").trim().slice(0, 160)).slice(0, max);
  return {
    ...board,
    contacts: list(raw.contacts, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Contact;
      const emails = texts(r.emails);
      const email = emails.find((item) => item.includes("@")) || (String(r.email || "").includes("@") ? String(r.email).slice(0, 120) : "");
      if (email && !emails.includes(email)) emails.unshift(email);
      const phones = texts(r.phones).map((item) => fmtPhone(item));
      const phone = fmtPhone(phones.find((item) => /\d/.test(item)) || String(r.phone || ""));
      if (phone && !phones.includes(phone)) phones.unshift(phone);
      const firstName = String(r.firstName || "").slice(0, 60);
      const lastName = String(r.lastName || "").slice(0, 60);
      const combined = `${firstName} ${lastName}`.trim();
      const name = combined || String(r.name || "").slice(0, 80);
      return {
        id: String(r.id || id()).slice(0, 40),
        firstName: firstName || name.split(" ").slice(0, -1).join(" ") || name,
        lastName: lastName || (name.includes(" ") ? name.split(" ").slice(-1).join(" ") : ""),
        name,
        company: String(r.company || "").slice(0, 80),
        email,
        phone,
        city: String(r.city || "").slice(0, 60),
        kind: r.kind === "crm" ? "crm" : "personal",
        avatar: String(r.avatar || "").slice(0, 500),
        stage: String(r.stage || "New").slice(0, 40),
        deal: String(r.deal || "").slice(0, 20),
        note: String(r.note || "").slice(0, 2000),
        birthday: fmtDateInput(String(r.birthday || "")).slice(0, 20),
        address: String(r.address || "").slice(0, 160),
        state: String(r.state || "").slice(0, 40),
        zip: String(r.zip || "").slice(0, 12),
        emails,
        phones,
        websites: texts(r.websites),
        socials: texts(r.socials),
        jobTitle: String(r.jobTitle || "").slice(0, 80),
        source: String(r.source || "").slice(0, 80),
        tag: String(r.tag || "").slice(0, 40),
      };
    }, "head", 100000),
    journal: list(raw.journal, (row) => {
      const item = entry(row);
      if (!item) return null;
      return { ...item, body: String((row as Entry).body || "").slice(0, 100_000) };
    }, "head", 500),
    mail: list(raw.mail, mailItem),
    thread: list(raw.thread, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as ChatLine;
      return {
        id: String(r.id || id()).slice(0, 40),
        who: String(r.who || "Nyx").slice(0, 40),
        text: String(r.text || "").slice(0, 1000),
        mine: Boolean(r.mine),
        platform: String((r as { platform?: string }).platform || "").slice(0, 20),
      };
    }, "tail"),
    projects: list(raw.projects, entry),
    vault: list(raw.vault, entry),
    legal: list(raw.legal, entry),
    media: list(raw.media, (row) => {
      const item = entry(row);
      if (!item || !row || typeof row !== "object") return null;
      return { ...item, body: String((row as Entry).body || "").slice(0, 1_500_000) };
    }, "head", 400),
    songs: list(raw.songs, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as SongIdea;
      return {
        id: String(r.id || id()).slice(0, 40),
        title: String(r.title || "").slice(0, 80),
        note: String(r.note || "").slice(0, 240),
        lyrics: String(r.lyrics || "").slice(0, 4000),
        liked: Boolean(r.liked),
        pub: Boolean(r.pub),
        cover: String(r.cover || "").slice(0, 2000),
        audio: /^https?:\/\//i.test(String(r.audio || "")) ? String(r.audio).slice(0, 2000) : String(r.audio || "").startsWith("data:audio") ? String(r.audio).slice(0, 300000) : "",
        video: String(r.video || "").slice(0, 2000),
      };
    }),
    ideas: list(raw.ideas, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Idea;
      return {
        id: String(r.id || id()).slice(0, 40),
        title: String(r.title || "").slice(0, 160),
        note: String(r.note || "").slice(0, 500),
        approved: Boolean(r.approved) || ["approved", "ready", "running", "paused"].includes(String(r.status)),
        status: ["new", "approved", "ready", "running", "paused", "dropped"].includes(String(r.status)) ? r.status : r.approved ? "approved" : "new",
        source: String(r.source || "Manual").slice(0, 40),
        effort: r.effort === "medium" ? "medium" : "low",
        email: String(r.email || "").slice(0, 120),
        funding: String(r.funding || "").slice(0, 80),
        log: String(r.log || "").slice(0, 2000),
      };
    }),
    deals: list(raw.deals, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Deal;
      const client = String(r.client || "").trim().slice(0, 80);
      if (!client) return null;
      const amount = Math.round((Number(r.amount) || 0) * 100) / 100;
      const status = ["lead", "proposed", "active", "paid", "closed"].includes(String(r.status)) ? r.status : "lead";
      return {
        id: String(r.id || id()).slice(0, 40),
        ideaId: String(r.ideaId || "").slice(0, 40),
        client,
        email: String(r.email || "").slice(0, 120),
        phone: fmtPhone(String(r.phone || "")).slice(0, 20),
        status,
        amount: Math.min(1_000_000, Math.max(0, amount)),
        paid: Boolean(r.paid) || status === "paid",
        next: String(r.next || "").slice(0, 160),
      };
    }),
    keys: list(raw.keys, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as KeyRow;
      const name = String(r.name || "").trim().slice(0, 80);
      const value = String(r.value || "").trim().slice(0, 8000);
      if (!name || !value) return null;
      return { id: String(r.id || id()).slice(0, 40), name, value };
    }, "head", 400),
    facts: list(raw.facts, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Fact;
      const text = String(r.text || "").trim().slice(0, 500);
      if (!text) return null;
      return { id: String(r.id || id()).slice(0, 40), text, source: String(r.source || "Board").slice(0, 40), at: String(r.at || "").slice(0, 40) };
    }, "head", 200),
    query: String(raw.query || "").slice(0, 120),
    emailHub: hub(raw.emailHub),
    socialAccounts: list(raw.socialAccounts, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as SocialAccount;
      const ids = ["instagram", "facebook", "x", "tiktok", "linkedin", "youtube", "reddit", "snapchat"] as const;
      if (!ids.includes(r.id)) return null;
      const history = (Array.isArray(r.history) ? r.history : []).map((point) => Number(point) || 0).filter((point) => point >= 0).slice(-12);
      return {
        id: r.id,
        name: String(r.name || r.id).slice(0, 40),
        handle: String(r.handle || "").slice(0, 80),
        bio: String(r.bio || "").slice(0, 240),
        followers: Math.max(0, Number(r.followers) || 0),
        following: Math.max(0, Number(r.following) || 0),
        likes: Math.max(0, Number(r.likes) || 0),
        comments: Math.max(0, Number(r.comments) || 0),
        views: Math.max(0, Number(r.views) || 0),
        connected: Boolean(r.connected),
        history,
      };
    }, "head", 8),
    socialPosts: list(raw.socialPosts, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as SocialPost;
      const ids = ["instagram", "facebook", "x", "tiktok", "linkedin", "youtube", "reddit", "snapchat"] as const;
      const platforms = (Array.isArray(r.platforms) ? r.platforms : []).filter((item): item is SocialAccount["id"] => ids.includes(item as SocialAccount["id"])).slice(0, 8);
      const text = String(r.text || "").slice(0, 2000);
      if (!text) return null;
      return { id: String(r.id || id()).slice(0, 40), text, platforms, at: String(r.at || "").slice(0, 40), scheduled: String(r.scheduled || "").slice(0, 40), sent: String(r.sent || "").slice(0, 120) };
    }, "head", 80),
    stats: list(raw.stats, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as StatRow;
      const label = String(r.label || "").slice(0, 60);
      if (!label) return null;
      const points = (Array.isArray(r.points) ? r.points : []).map((point) => Number(point) || 0).slice(-14);
      return { id: String(r.id || id()).slice(0, 40), label, value: Number(r.value) || points.at(-1) || 0, points };
    }, "head", 24),
    groups: list(raw.groups, (row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as GroupSource;
      const url = String(r.url || "").trim().slice(0, 240);
      if (!/^https?:\/\/(www\.)?facebook\.com\/groups\/[^/?#]+/i.test(url)) return null;
      const slug = url.split("/groups/")[1]?.split(/[/?#]/)[0] || "";
      return { id: String(r.id || slug).slice(0, 40), label: String(r.label || slug).slice(0, 80), url: url.split("?")[0] };
    }, "head", 40),
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

function absorb(base: Memory, raw: unknown) {
  const incoming = sanitizeMemory(raw);
  return {
    ...base,
    logo: base.logo || incoming.logo,
    banner: base.banner || incoming.banner,
    notes: unionById(base.notes, incoming.notes),
    tasks: unionById(base.tasks, incoming.tasks),
    leads: unionById(base.leads, incoming.leads),
    notifs: unionById(base.notifs, incoming.notifs),
    jobs: unionById(base.jobs, incoming.jobs),
    accounts: unionById(base.accounts, incoming.accounts),
    products: unionById(base.products, incoming.products),
    expenses: unionById(base.expenses, incoming.expenses),
    events: unionById(base.events, incoming.events),
    links: unionById(base.links, incoming.links),
    tracks: unionById(base.tracks, incoming.tracks),
    social: unionById(base.social, incoming.social),
    marketing: unionById(base.marketing, incoming.marketing),
    contacts: unionById(base.contacts, incoming.contacts),
    journal: unionById(base.journal, incoming.journal),
    mail: unionById(base.mail, incoming.mail),
    thread: unionById(base.thread, incoming.thread),
    projects: unionById(base.projects, incoming.projects),
    legal: unionById(base.legal, incoming.legal),
    media: unionById(base.media, incoming.media),
    songs: unionById(base.songs, incoming.songs),
    ideas: unionById(base.ideas, incoming.ideas),
    emailHub: {
      accounts: unionById(base.emailHub.accounts, incoming.emailHub.accounts),
      lists: unionById(base.emailHub.lists, incoming.emailHub.lists),
      campaigns: unionById(base.emailHub.campaigns, incoming.emailHub.campaigns),
      domains: unionById(base.emailHub.domains, incoming.emailHub.domains),
    },
  };
}

function read(): Memory {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(BACKUP);
    const next = raw ? sanitizeMemory(JSON.parse(raw)) : seed();
    const vault = readVault();
    if (vault.length) next.vault = vault;
    if (!next.banner) next.banner = localStorage.getItem(BANNER_KEY) || "";
    if (!next.logo) next.logo = localStorage.getItem(LOGO_KEY) || "";
    const kept = readKeysLocal();
    if (kept.length) next.keys = unionKeys(kept, next.keys);
    return next;
  } catch {
    return seed();
  }
}

const CONTACTS_DB = "lifeos-contacts";

function contactDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONTACTS_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("rows")) request.result.createObjectStore("rows");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadContactRows(): Promise<Contact[]> {
  if (typeof indexedDB === "undefined") return [];
  const database = await contactDb();
  return new Promise((resolve, reject) => {
    const request = database.transaction("rows", "readonly").objectStore("rows").get("all");
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result as Contact[] : []);
    request.onerror = () => reject(request.error);
  });
}

function saveContactRows(rows: Contact[]) {
  if (typeof indexedDB === "undefined") return;
  void contactDb().then((database) => new Promise<void>((resolve, reject) => {
    const tx = database.transaction("rows", "readwrite");
    tx.objectStore("rows").put(rows, "all");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })).catch(() => undefined);
}

const MEDIA_DB = "lifeos-media";

function mediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("rows")) request.result.createObjectStore("rows");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadMediaRows(): Promise<Entry[]> {
  if (typeof indexedDB === "undefined") return [];
  const database = await mediaDb();
  return new Promise((resolve, reject) => {
    const request = database.transaction("rows", "readonly").objectStore("rows").get("all");
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result as Entry[] : []);
    request.onerror = () => reject(request.error);
  });
}

function saveMediaRows(rows: Entry[]) {
  if (typeof indexedDB === "undefined") return;
  void mediaDb().then((database) => new Promise<void>((resolve, reject) => {
    const tx = database.transaction("rows", "readwrite");
    tx.objectStore("rows").put(rows, "all");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })).catch(() => undefined);
}

const BRAND_DB = "lifeos-brand";
type BrandLocal = { banner: string; logo: string; at: number };

function brandDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BRAND_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("meta")) request.result.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveBrandLocal(banner: string, logo: string) {
  if (typeof indexedDB === "undefined") return;
  const row: BrandLocal = { banner, logo, at: Date.now() };
  void brandDb().then((database) => new Promise<void>((resolve, reject) => {
    const tx = database.transaction("meta", "readwrite");
    tx.objectStore("meta").put(row, "brand");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })).catch(() => undefined);
}

async function loadBrandLocal(): Promise<BrandLocal | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await brandDb();
  return new Promise((resolve, reject) => {
    const request = database.transaction("meta", "readonly").objectStore("meta").get("brand");
    request.onsuccess = () => resolve(request.result && typeof request.result === "object" ? request.result as BrandLocal : null);
    request.onerror = () => reject(request.error);
  });
}

function readKeysLocal(): KeyRow[] {
  return [];
}

function saveKeysLocal(keys: KeyRow[]) {
  void keys;
  try { localStorage.removeItem(KEYS_KEY); } catch { /* do not keep key values in the browser */ }
}

function unionKeys(primary: KeyRow[], extra: KeyRow[]) {
  const map = new Map<string, KeyRow>();
  for (const row of extra) if (row.name && row.value) map.set(row.name, row);
  for (const row of primary) if (row.name && row.value) map.set(row.name, row);
  return [...map.values()];
}

function mergeMedia(local: Entry[], stored: Entry[]) {
  const map = new Map<string, Entry>();
  for (const row of stored) map.set(row.id, row);
  for (const row of local) {
    const previous = map.get(row.id);
    if (!previous || row.body.length >= previous.body.length) map.set(row.id, row);
  }
  return [...map.values()];
}

const SHARED = "lifeos-shared";
const SHARED_SQL = "00000000-0000-4000-8000-000000000001";
let memory = seed();
let statusText = "This browser";
if (typeof window !== "undefined") window.addEventListener("pagehide", () => {
  saveContactRows(memory.contacts);
  saveMediaRows(memory.media);
  saveBrandLocal(memory.banner, memory.logo);
  saveKeysLocal(memory.keys);
});
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
  saveContactRows(memory.contacts);
  saveMediaRows(memory.media);
  saveBrandLocal(memory.banner, memory.logo);
  saveKeysLocal(memory.keys);
  try { localStorage.setItem(BANNER_KEY, memory.banner); } catch { /* banner stays in IndexedDB */ }
  try { localStorage.setItem(LOGO_KEY, memory.logo); } catch { /* logo stays in IndexedDB */ }
  const board = {
    ...memory,
    banner: "",
    logo: "",
    keys: [] as KeyRow[],
    contacts: [] as Contact[],
    media: memory.media.map((row) => ({ ...row, body: row.body.startsWith("data:") ? "" : row.body.slice(0, 2000) })),
  };
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(memory.vault));
    localStorage.setItem(KEY, JSON.stringify(board));
    const backup = { ...board, keys: [], vault: [] };
    localStorage.setItem(BACKUP, JSON.stringify(backup));
    localStorage.setItem(AT, String(Date.now()));
  } catch {
    statusText = "Contacts saved. The rest of the board did not fit.";
  }
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
    const { pushCloud, pushBrand, pushKeys } = await import("@/lib/lifeos/board-store");
    const copy = { ...memory, keys: [], vault: [] };
    const result = await pushBoard({ data: { device: SHARED_SQL, payload: JSON.stringify(copy) } });
    await pushCloud(SHARED, copy).catch(() => false);
    await pushBrand(memory.banner, memory.logo).catch(() => false);
    await pushKeys(memory.keys).catch(() => false);
    if (result.at) localStorage.setItem(AT, String(result.at));
    statusText = "Synced";
  } catch {
    try {
      const { pushCloud, pushBrand, pushKeys } = await import("@/lib/lifeos/board-store");
      const ok = await pushCloud(SHARED, { ...memory, keys: [], vault: [] });
      await pushBrand(memory.banner, memory.logo).catch(() => false);
      await pushKeys(memory.keys).catch(() => false);
      statusText = ok ? "Synced" : "Saved on this browser";
    } catch {
      statusText = "Saved on this browser";
    }
  }
  emit();
}

export async function hydrateMemory() {
  bootMemory();
  try {
    const stored = sanitizeMemory({ contacts: await loadContactRows() }).contacts;
    if (stored.length) memory = { ...memory, contacts: unionById(memory.contacts, stored) };
    const media = mergeMedia(memory.media, sanitizeMemory({ media: await loadMediaRows() }).media);
    if (media.length) memory = { ...memory, media };
    const brandLocal = await loadBrandLocal().catch(() => null);
    if (brandLocal) memory = { ...memory, banner: memory.banner || brandLocal.banner, logo: memory.logo || brandLocal.logo };
    const savedKeys = readKeysLocal();
    if (savedKeys.length) memory = { ...memory, keys: unionKeys(savedKeys, memory.keys) };
  } catch { /* indexedDB unavailable */ }
  try {
    const { pullBoard } = await import("@/lib/lifeos/sync");
    const { pullCloud, pullBrand, pullKeys } = await import("@/lib/lifeos/board-store");
    const remote = await pullBoard({ data: SHARED_SQL }).catch(() => null);
    const ownRemote = await pullBoard({ data: deviceId() }).catch(() => null);
    const cloud = await pullCloud(SHARED).catch(() => null);
    const ownCloud = await pullCloud(deviceId()).catch(() => null);
    const brand = await pullBrand().catch(() => null);
    const cloudKeys = await pullKeys().catch(() => []);
    if (cloudKeys.length) memory = { ...memory, keys: unionKeys(memory.keys, cloudKeys) };
    for (const source of [ownRemote?.payload, remote?.payload, ownCloud?.doc, cloud?.doc]) {
      if (source) memory = absorb(memory, typeof source === "string" ? JSON.parse(source) : source);
    }
    if (brand?.banner) memory = { ...memory, banner: memory.banner || brand.banner };
    if (brand?.logo) memory = { ...memory, logo: memory.logo || brand.logo };
    memory.vault = readVault().length ? readVault() : memory.vault;
    rememberLocal();
    statusText = "Synced";
    void pushNow();
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
