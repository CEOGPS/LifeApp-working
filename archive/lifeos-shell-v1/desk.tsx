import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cable,
  Disc3,
  Gauge,
  Megaphone,
  Search,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  addCampaign,
  addTrack,
  loadState,
  rememberSearch,
  removeCampaign,
  removeTrack,
  saveLink,
  setCampaignStatus,
  setTrackStage,
  type Campaign,
  type LifeState,
  type Track,
} from "@/lib/lifeos/api";
import { CHANNELS, MOODS, PROVIDERS, type ModuleId } from "./catalog";

const NAV: { id: ModuleId; label: string; icon: typeof Gauge }[] = [
  { id: "pulse", label: "Pulse", icon: Gauge },
  { id: "nexus", label: "Nexus", icon: Cable },
  { id: "lucid", label: "Lucid", icon: Megaphone },
  { id: "veriton", label: "Veriton", icon: Disc3 },
  { id: "search", label: "Search", icon: Search },
];

const EMPTY: LifeState = { links: [], campaigns: [], tracks: [], searches: [] };

export function Desk() {
  const user = useCurrentUser();
  const [module, setModule] = useState<ModuleId>("pulse");
  const [state, setState] = useState<LifeState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setState(await loadState());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your record");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const name = user?.displayName ?? user?.primaryEmail ?? "Account";

  return (
    <div className="min-h-dvh bg-bg text-fg md:grid md:grid-cols-[14rem_1fr]">
      <aside className="hidden border-r border-line bg-surface md:flex md:flex-col md:gap-6 md:p-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-brass">LIFEOS</p>
          <p className="mt-1 text-sm text-muted">One record</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavButton key={item.id} item={item} active={module === item.id} onPick={setModule} />
          ))}
        </nav>
        <div className="mt-auto">
          <UserButton />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:hidden">
          <p className="font-mono text-xs tracking-widest text-brass">LIFEOS</p>
          <UserButton />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          <p className="font-mono text-xs text-muted">{name}</p>
          {error ? <p className="mt-2 text-sm text-brass">{error}</p> : null}
          {module === "pulse" ? <Pulse state={state} onOpen={setModule} /> : null}
          {module === "nexus" ? (
            <Nexus state={state} busy={busy} onSave={(input) => run(() => saveLink({ data: input }))} />
          ) : null}
          {module === "lucid" ? (
            <Lucid
              campaigns={state.campaigns}
              busy={busy}
              onAdd={(input) => run(() => addCampaign({ data: input }))}
              onStatus={(id, status) => run(() => setCampaignStatus({ data: { id, status } }))}
              onRemove={(id) => run(() => removeCampaign({ data: id }))}
            />
          ) : null}
          {module === "veriton" ? (
            <Veriton
              tracks={state.tracks}
              busy={busy}
              onAdd={(input) => run(() => addTrack({ data: input }))}
              onStage={(id, stage) => run(() => setTrackStage({ data: { id, stage } }))}
              onRemove={(id) => run(() => removeTrack({ data: id }))}
            />
          ) : null}
          {module === "search" ? (
            <Omni
              state={state}
              busy={busy}
              onSearch={(query) => run(() => rememberSearch({ data: query }))}
            />
          ) : null}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-line bg-surface md:hidden">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setModule(item.id)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs ${
              module === item.id ? "text-brass" : "text-muted"
            }`}
          >
            <item.icon size={18} aria-hidden />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function NavButton({
  item,
  active,
  onPick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onPick: (id: ModuleId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item.id)}
      className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm ${
        active ? "bg-raised text-brass" : "text-fg hover:bg-raised"
      }`}
    >
      <item.icon size={16} aria-hidden />
      {item.label}
    </button>
  );
}

function Pulse({
  state,
  onOpen,
}: {
  state: LifeState;
  onOpen: (id: ModuleId) => void;
}) {
  const on = state.links.filter((link) => link.status === "on").length;
  const live = state.campaigns.filter((row) => row.status === "live").length;
  const ready = state.tracks.filter((row) => row.stage === "ready").length;
  const cards = [
    { id: "nexus" as const, label: "Nexus on", value: String(on) },
    { id: "lucid" as const, label: "Lucid live", value: String(live) },
    { id: "veriton" as const, label: "Veriton ready", value: String(ready) },
    { id: "search" as const, label: "Last search", value: state.searches[0]?.query ?? "None" },
  ];
  return (
    <section className="mt-4">
      <h1 className="text-3xl font-semibold">Command</h1>
      <p className="mt-2 max-w-xl text-pretty text-muted">
        Nexus, Lucid, Veriton, and Search share this account. A new browser reads the same rows.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onOpen(card.id)}
            className="rounded-xl border border-line bg-surface p-4 text-left"
          >
            <p className="font-mono text-xs text-muted">{card.label}</p>
            <p className="mt-2 truncate text-2xl font-medium tabular-nums">{card.value}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function Nexus({
  state,
  busy,
  onSave,
}: {
  state: LifeState;
  busy: boolean;
  onSave: (input: { provider: string; label: string; status: "off" | "on" }) => void;
}) {
  return (
    <section className="mt-4">
      <h1 className="text-3xl font-semibold">Nexus</h1>
      <p className="mt-2 max-w-xl text-pretty text-muted">
        Mark which accounts are on and the label you use. This remembers the board, not the password.
      </p>
      <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
        {PROVIDERS.map((provider) => {
          const saved = state.links.find((link) => link.provider === provider.id);
          return (
            <NexusRow
              key={provider.id}
              name={provider.name}
              detail={provider.detail}
              label={saved?.label ?? ""}
              on={saved?.status === "on"}
              busy={busy}
              onSave={(label, status) => onSave({ provider: provider.id, label, status })}
            />
          );
        })}
      </ul>
    </section>
  );
}

function NexusRow({
  name,
  detail,
  label,
  on,
  busy,
  onSave,
}: {
  name: string;
  detail: string;
  label: string;
  on: boolean;
  busy: boolean;
  onSave: (label: string, status: "off" | "on") => void;
}) {
  const [draft, setDraft] = useState(label);
  useEffect(() => setDraft(label), [label]);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:w-40">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
      <label className="flex-1 text-sm text-muted">
        Account label
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSave(draft, on ? "off" : "on")}
        className={`min-h-11 rounded-lg px-4 text-sm font-medium ${
          on ? "bg-brass text-ink" : "border border-line text-fg"
        }`}
      >
        {on ? "On" : "Off"}
      </button>
    </li>
  );
}

function Lucid({
  campaigns,
  busy,
  onAdd,
  onStatus,
  onRemove,
}: {
  campaigns: Campaign[];
  busy: boolean;
  onAdd: (input: { name: string; channel: string; spend: number; goal: string }) => void;
  onStatus: (id: string, status: Campaign["status"]) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<string>(CHANNELS[0]);
  const [spend, setSpend] = useState("0");
  const [goal, setGoal] = useState("");
  const chart = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of campaigns) totals.set(row.channel, (totals.get(row.channel) ?? 0) + row.spend);
    return CHANNELS.map((key) => ({ channel: key, spend: totals.get(key) ?? 0 }));
  }, [campaigns]);

  return (
    <section className="mt-4">
      <h1 className="text-3xl font-semibold">Lucid</h1>
      <p className="mt-2 max-w-xl text-pretty text-muted">
        Campaigns stay with the account. Spend is a planning number, not a live ad account.
      </p>
      <form
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd({ name, channel, spend: Number(spend), goal });
          setName("");
          setGoal("");
        }}
      >
        <Field label="Name" value={name} onChange={setName} />
        <label className="text-sm text-muted">
          Channel
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
          >
            {CHANNELS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <Field label="Spend" value={spend} onChange={setSpend} />
        <Field label="Goal" value={goal} onChange={setGoal} />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg bg-brass px-4 font-medium text-ink sm:col-span-2"
        >
          Add campaign
        </button>
      </form>
      {campaigns.length > 0 ? (
        <div className="mt-4 h-48 text-brass">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <XAxis dataKey="channel" stroke="currentColor" fontSize={12} />
              <YAxis stroke="currentColor" fontSize={12} />
              <Tooltip />
              <Bar dataKey="spend" fill="currentColor" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No campaigns yet.</p>
      )}
      <ul className="mt-4 flex flex-col gap-2">
        {campaigns.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{row.name}</p>
              <p className="text-sm text-muted">
                {row.channel} · ${row.spend.toLocaleString()} · {row.goal || "No goal"}
              </p>
            </div>
            {(["draft", "live", "paused"] as const).map((status) => (
              <button
                key={status}
                type="button"
                disabled={busy}
                onClick={() => onStatus(row.id, status)}
                className={`min-h-11 rounded-lg px-3 text-sm capitalize ${
                  row.status === status ? "bg-brass text-ink" : "border border-line"
                }`}
              >
                {status}
              </button>
            ))}
            <button type="button" aria-label={`Remove ${row.name}`} onClick={() => onRemove(row.id)} className="min-h-11 min-w-11 text-muted">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Veriton({
  tracks,
  busy,
  onAdd,
  onStage,
  onRemove,
}: {
  tracks: Track[];
  busy: boolean;
  onAdd: (input: { title: string; mood: string }) => void;
  onStage: (id: string, stage: Track["stage"]) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState<string>(MOODS[0]);
  return (
    <section className="mt-4">
      <h1 className="text-3xl font-semibold">Veriton</h1>
      <p className="mt-2 max-w-xl text-pretty text-muted">
        A library for pieces in progress. Sketch, mix, then mark ready. The list follows the login.
      </p>
      <form
        className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd({ title, mood });
          setTitle("");
        }}
      >
        <div className="flex-1">
          <Field label="Title" value={title} onChange={setTitle} />
        </div>
        <label className="text-sm text-muted sm:w-40">
          Mood
          <select
            value={mood}
            onChange={(event) => setMood(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
          >
            {MOODS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-brass px-4 font-medium text-ink">
          Add piece
        </button>
      </form>
      {tracks.length === 0 ? <p className="mt-4 text-sm text-muted">Library is empty.</p> : null}
      <ul className="mt-4 flex flex-col gap-2">
        {tracks.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{row.title}</p>
              <p className="text-sm text-muted">{row.mood}</p>
            </div>
            {(["sketch", "mix", "ready"] as const).map((stage) => (
              <button
                key={stage}
                type="button"
                disabled={busy}
                onClick={() => onStage(row.id, stage)}
                className={`min-h-11 rounded-lg px-3 text-sm capitalize ${
                  row.stage === stage ? "bg-brass text-ink" : "border border-line"
                }`}
              >
                {stage}
              </button>
            ))}
            <button type="button" aria-label={`Remove ${row.title}`} onClick={() => onRemove(row.id)} className="min-h-11 min-w-11 text-muted">
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Omni({
  state,
  busy,
  onSearch,
}: {
  state: LifeState;
  busy: boolean;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const links = state.links.filter(
    (row) =>
      !needle ||
      row.provider.includes(needle) ||
      row.label.toLowerCase().includes(needle),
  );
  const campaigns = state.campaigns.filter(
    (row) => !needle || `${row.name} ${row.goal} ${row.channel}`.toLowerCase().includes(needle),
  );
  const tracks = state.tracks.filter(
    (row) => !needle || `${row.title} ${row.mood}`.toLowerCase().includes(needle),
  );
  return (
    <section className="mt-4">
      <h1 className="text-3xl font-semibold">Search</h1>
      <p className="mt-2 max-w-xl text-pretty text-muted">
        One box across Nexus, Lucid, and Veriton. Recent queries stay on the account.
      </p>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) onSearch(query.trim());
        }}
      >
        <label className="sr-only" htmlFor="omni">
          Search the record
        </label>
        <input
          id="omni"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, account, mood"
          className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-fg"
        />
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-brass px-4 font-medium text-ink">
          Save
        </button>
      </form>
      {state.searches.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {state.searches.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setQuery(row.query)}
              className="rounded-full border border-line px-3 py-1 text-sm text-muted"
            >
              {row.query}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <HitList title="Nexus" rows={links.map((row) => row.label || row.provider)} />
        <HitList title="Lucid" rows={campaigns.map((row) => row.name)} />
        <HitList title="Veriton" rows={tracks.map((row) => row.title)} />
      </div>
    </section>
  );
}

function HitList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="font-mono text-xs text-muted">{title}</p>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing matches.</p> : null}
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row} className="truncate text-sm">
            {row}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm text-muted">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg"
      />
    </label>
  );
}
