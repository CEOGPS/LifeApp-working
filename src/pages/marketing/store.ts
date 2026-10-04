import type {
  ActivityEntry, BusinessInfo, Campaign, ListingRecord, NudgeKind,
  OpportunityRun, Person, ScoreOverride, SeoTarget,
} from "./MarketingPanel.types";

/**
 * Store is a thin typed wrapper over localStorage with:
 *  - namespace + version
 *  - JSON-safe serialization
 *  - change subscriptions (so UI stays in sync)
 *  - safe fallbacks
 *
 * Replace `backend` with a real HTTP client later without touching callers.
 */

const NS = "lifeos_marketing_v2";

type StoreShape = {
  businessInfo: BusinessInfo;
  listings: Record<string, ListingRecord>;
  opportunities: OpportunityRun[];
  campaigns: Campaign[];
  seoTarget: SeoTarget;
  seoChecks: boolean[];
  activity: ActivityEntry[];
  overrides: ScoreOverride[];
  nudgeHistory: { id: string; personId: string; kind: NudgeKind; text: string; at: number }[];
};

const DEFAULT: StoreShape = {
  businessInfo: {
    businessName: "", category: "", phone: "", address: "", city: "", state: "", zip: "",
    website: "", hours: "Mon-Fri 9am-6pm", email: "", description: "", tagline: "",
  },
  listings: {},
  opportunities: [],
  campaigns: [],
  seoTarget: { company: "", website: "", industry: "", location: "" },
  seoChecks: Array(7).fill(false),
  activity: [],
  overrides: [],
  nudgeHistory: [],
};

const listeners = new Set<() => void>();

function read(): StoreShape {
  try {
    const raw = localStorage.getItem(NS);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return { ...structuredClone(DEFAULT), ...parsed };
  } catch {
    return structuredClone(DEFAULT);
  }
}

function write(next: StoreShape) {
  localStorage.setItem(NS, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

let cache: StoreShape | null = null;
export function getState(): StoreShape {
  if (!cache) cache = read();
  return cache;
}

export function setState(updater: (prev: StoreShape) => StoreShape) {
  const next = updater(getState());
  cache = next;
  write(next);
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ── Convenience selectors / mutators ── */

export const store = {
  get businessInfo() { return getState().businessInfo; },
  setBusinessInfo(info: BusinessInfo) {
    setState((s) => ({ ...s, businessInfo: info }));
  },

  get listings() { return getState().listings; },
  upsertListing(name: string, patch: Partial<ListingRecord>) {
    setState((s) => {
      const cur: ListingRecord = s.listings[name] ?? { name, status: "Unclaimed", snapshots: [] };
      return { ...s, listings: { ...s.listings, [name]: { ...cur, ...patch } } };
    });
  },
  captureListingSnapshot(name: string, snap: Omit<ListingRecord["snapshots"][number], "capturedAt">) {
    setState((s) => {
      const cur: ListingRecord = s.listings[name] ?? { name, status: "Unclaimed", snapshots: [] };
      const snapshots = [{ ...snap, capturedAt: Date.now() }, ...cur.snapshots].slice(0, 10);
      return { ...s, listings: { ...s.listings, [name]: { ...cur, snapshots } } };
    });
  },

  get opportunities() { return getState().opportunities; },
  addOpportunityRun(run: OpportunityRun) {
    setState((s) => ({ ...s, opportunities: [run, ...s.opportunities].slice(0, 20) }));
  },
  markOpportunityClaimed(runId: string, name: string) {
    setState((s) => ({
      ...s,
      opportunities: s.opportunities.map((r) =>
        r.id !== runId ? r : { ...r, items: r.items.map((i) => i.name === name ? { ...i, claimed: true } : i) }
      ),
    }));
  },

  get campaigns() { return getState().campaigns; },
  addCampaign(c: Campaign) { setState((s) => ({ ...s, campaigns: [c, ...s.campaigns] })); },
  updateCampaign(id: string, patch: Partial<Campaign>) {
    setState((s) => ({ ...s, campaigns: s.campaigns.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  },
  removeCampaign(id: string) {
    setState((s) => ({ ...s, campaigns: s.campaigns.filter((c) => c.id !== id) }));
  },

  get seoTarget() { return getState().seoTarget; },
  setSeoTarget(t: SeoTarget) { setState((s) => ({ ...s, seoTarget: t })); },

  get seoChecks() { return getState().seoChecks; },
  setSeoChecks(c: boolean[]) { setState((s) => ({ ...s, seoChecks: c })); },

  get activity() { return getState().activity; },
  log(entry: Omit<ActivityEntry, "id" | "at">) {
    setState((s) => ({
      ...s,
      activity: [{ id: crypto.randomUUID(), at: Date.now(), ...entry }, ...s.activity].slice(0, 500),
    }));
  },

  get overrides() { return getState().overrides; },
  setOverride(o: ScoreOverride) {
    setState((s) => ({
      ...s,
      overrides: [o, ...s.overrides.filter((x) => x.personId !== o.personId)],
    }));
  },
  clearOverride(personId: string) {
    setState((s) => ({ ...s, overrides: s.overrides.filter((x) => x.personId !== personId) }));
  },

  appendNudge(n: { personId: string; kind: NudgeKind; text: string }) {
    setState((s) => ({
      ...s,
      nudgeHistory: [{ id: crypto.randomUUID(), at: Date.now(), ...n }, ...s.nudgeHistory].slice(0, 200),
    }));
  },
  get nudgeHistory() { return getState().nudgeHistory; },
};