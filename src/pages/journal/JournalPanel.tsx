// src/pages/journal/JournalPanel.tsx
// LifeOS1 — Journal Panel
// Single-file. Strict TS. Supabase-backed via @/lib/supabaseClient.
// Table: journal_pages(id, user_id, notebook_id, title, content, mood,
//   tags jsonb, date, created_at, updated_at)

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import {
  BookOpen, Plus, Search, Trash2, Pencil, X, Check, Loader2,
  Save, Sparkles, Calendar, Tag, ChevronLeft, AlertCircle, Download,
} from "lucide-react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

function useAuth() {
  const [user, setUser] = useState<Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]>(null);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then((result: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      const { data } = result;
      if (mounted) setUser(data.user);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
      if (mounted) setUser(session?.user ?? null);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { user };
}

type LLMRequest = {
  prompt: string;
  systemPrompt?: string;
};

type LLMResponse = {
  text?: string;
};

async function invokeLLM(request: LLMRequest): Promise<LLMResponse> {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) return {};
  const data = (await response.json()) as LLMResponse;
  return { text: typeof data.text === "string" ? data.text : undefined };
}

interface PanelLayoutProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

function PanelLayout({
  title, subtitle, icon, actions, children,
}: PanelLayoutProps) {
  return (
    <section className="h-full flex flex-col min-h-0">
      <header className="flex items-center gap-3 px-1 pb-3">
        {icon && <span className="text-primary">{icon}</span>}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg text-white-90">{title}</h1>
          {subtitle && <p className="text-[11px] text-white-40">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface JournalPage {
  id: string;
  user_id: string;
  notebook_id: string | null;
  title: string | null;
  content: string | null;
  mood: string | null;
  tags: string[];
  date: string;
  created_at: string;
  updated_at: string;
}

interface PageRow {
  id: string;
  user_id: string;
  notebook_id: string | null;
  title: string | null;
  content: string | null;
  mood: string | null;
  tags: unknown;
  date: string;
  created_at: string;
  updated_at: string;
}

type Draft = {
  id?: string;
  title: string;
  content: string;
  mood: string;
  tags: string;
  date: string;
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const MOODS = [
  "great", "good", "neutral", "tired", "stressed",
  "anxious", "sad", "angry", "grateful", "hopeful",
] as const;

const MOOD_COLORS: Record<string, string> = {
  great: "text-green",
  good: "text-teal",
  neutral: "text-white-70",
  tired: "text-yellow",
  stressed: "text-orange",
  anxious: "text-orange",
  sad: "text-blue-info",
  angry: "text-crimson",
  grateful: "text-green",
  hopeful: "text-blue-info",
};

const PROMPT_CHIPS = [
  "What made today good?",
  "What drained me?",
  "One thing I'm grateful for:",
  "What did I learn?",
  "What would I do differently?",
  "Tomorrow's priority:",
];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function safeTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

function toPage(row: PageRow): JournalPage {
  return {
    id: row.id,
    user_id: row.user_id,
    notebook_id: row.notebook_id,
    title: row.title,
    content: row.content,
    mood: row.mood,
    tags: safeTags(row.tags),
    date: row.date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

export default function JournalPanel() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [pages, setPages] = useState<JournalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  /* ── Load ── */
  const load = useCallback(async () => {
    if (!userId) {
      try {
        const raw = localStorage.getItem("lifeos_journal_pages");
        setPages(raw ? JSON.parse(raw) : []);
      } catch {
        setPages([]);
      }
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("journal_pages")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(500);
      if (qErr) throw new Error(qErr.message);
      setPages((data as PageRow[] | null)?.map(toPage) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journal");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Derived ── */
  const filtered = useMemo(() => {
    let list = pages;
    if (moodFilter) list = list.filter((p) => p.mood === moodFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.title ?? "").toLowerCase().includes(q) ||
          (p.content ?? "").toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [pages, search, moodFilter]);

  const availableMoods = useMemo(() => {
    const set = new Set<string>();
    pages.forEach((p) => p.mood && set.add(p.mood));
    return [...set].sort();
  }, [pages]);

  /* ── Create / edit ── */
  const startNew = useCallback(() => {
    setDraft({
      title: "",
      content: "",
      mood: "neutral",
      tags: "",
      date: todayISO(),
    });
    setPolishError(null);
    setTimeout(() => editorRef.current?.focus(), 50);
  }, []);

  const startEdit = useCallback((p: JournalPage) => {
    setDraft({
      id: p.id,
      title: p.title ?? "",
      content: p.content ?? "",
      mood: p.mood ?? "neutral",
      tags: p.tags.join(", "),
      date: p.date,
    });
    setPolishError(null);
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setPolishError(null);
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    if (!userId) {
      const tags = draft.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const page: JournalPage = {
        id: draft.id || crypto.randomUUID(),
        notebook_id: null,
        title: draft.title.trim() || null,
        content: draft.content,
        mood: draft.mood || null,
        tags,
        date: draft.date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPages((prev) => {
        const next = draft.id ? prev.map((p) => (p.id === draft.id ? page : p)) : [page, ...prev];
        localStorage.setItem("lifeos_journal_pages", JSON.stringify(next));
        return next;
      });
      setDraft(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        user_id: userId,
        notebook_id: null,
        title: draft.title.trim() || null,
        content: draft.content,
        mood: draft.mood || null,
        tags,
        date: draft.date,
        updated_at: new Date().toISOString(),
      };

      if (draft.id) {
        const { data, error: uErr } = await supabase
          .from("journal_pages")
          .update(payload)
          .eq("id", draft.id)
          .eq("user_id", userId)
          .select()
          .single();
        if (uErr) throw new Error(uErr.message);
        if (data) {
          const updated = toPage(data as PageRow);
          setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }
      } else {
        const { data, error: iErr } = await supabase
          .from("journal_pages")
          .insert([payload])
          .select()
          .single();
        if (iErr) throw new Error(iErr.message);
        if (data) {
          const created = toPage(data as PageRow);
          setPages((prev) => [created, ...prev]);
        }
      }
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, userId]);

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this entry? This cannot be undone.")) return;
      if (!userId) {
        setPages((prev) => {
          const next = prev.filter((p) => p.id !== id);
          localStorage.setItem("lifeos_journal_pages", JSON.stringify(next));
          return next;
        });
        if (draft?.id === id) setDraft(null);
        return;
      }
      try {
        const { error: dErr } = await supabase
          .from("journal_pages")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);
        if (dErr) throw new Error(dErr.message);
        setPages((prev) => prev.filter((p) => p.id !== id));
        if (draft?.id === id) setDraft(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [userId, draft],
  );

  const polish = useCallback(async () => {
    if (!draft || !draft.content.trim()) {
      setPolishError("Write something first.");
      return;
    }
    setPolishing(true);
    setPolishError(null);
    const res = await invokeLLM({
      prompt:
        `Rewrite this journal entry to be clearer, more reflective, and ` +
        `tightly written without changing the facts or the voice. ` +
        `Keep it roughly the same length. Return ONLY the rewritten text.\n\n` +
        draft.content,
      systemPrompt:
        "You are a thoughtful journal editor. Preserve the writer's voice and the truth of what happened.",
    });
    if (!res.text) {
      setPolishError(`Polish failed: No output returned`);
      setPolishing(false);
      return;
    }
    setDraft({ ...draft, content: res.text });
    setPolishing(false);
  }, [draft]);

  const exportCsv = useCallback(() => {
    downloadCsv(
      `lifeos-journal-${todayISO()}.csv`,
      [
        ["Date", "Title", "Mood", "Tags", "Content"],
        ...pages.map((p) => [
          p.date,
          p.title ?? "",
          p.mood ?? "",
          p.tags.join("|"),
          (p.content ?? "").replace(/[\r\n]+/g, " "),
        ]),
      ],
    );
  }, [pages]);

  /* ── Render ── */
  return (
    <PanelLayout
      title="Journal"
      subtitle="Daily pages, moods, and reflections"
      icon={<BookOpen size={18} />}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportCsv}
            disabled={pages.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass text-white-50 text-[11px] font-display tracking-wider hover:text-white-85 disabled:opacity-40 transition-colors"
          >
            <Download size={11} /> EXPORT
          </button>
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display tracking-wider hover:glow-crimson-sm transition-all"
          >
            <Plus size={11} /> NEW ENTRY
          </button>
        </div>
      }
    >
      <div className="h-full flex gap-3 min-h-0">
        {/* ═══ LEFT: list ═══ */}
        <div className="w-72 shrink-0 flex flex-col glass rounded-xl border border-white-8 overflow-hidden">
          <div className="p-3 border-b border-white-5 flex flex-col gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white-25" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries…"
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-85 placeholder:text-white-25 focus:outline-none"
              />
            </div>
            {availableMoods.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setMoodFilter(null)}
                  className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                    !moodFilter ? "glass-crimson text-primary" : "glass text-white-40 hover:text-white-70"
                  }`}
                >
                  ALL
                </button>
                {availableMoods.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMoodFilter(moodFilter === m ? null : m)}
                    className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                      moodFilter === m ? "glass-crimson text-primary" : "glass text-white-40 hover:text-white-70"
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={18} className="animate-spin text-white-30" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center p-4">
                <div>
                  <BookOpen size={28} className="mx-auto text-white-10 mb-2" />
                  <div className="text-xs text-white-30">
                    {pages.length === 0
                      ? "No entries yet. Write your first one."
                      : "No matches."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filtered.map((p) => {
                  const isActive = draft?.id === p.id;
                  const moodCls = p.mood ? MOOD_COLORS[p.mood] ?? "text-white-40" : "text-white-30";
                  return (
                    <button
                      key={p.id}
                      onClick={() => startEdit(p)}
                      className={`text-left px-2.5 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-crimson/10 border border-crimson/25"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <Calendar size={10} className="text-white-30 shrink-0" />
                        <span className="text-[10px] text-white-40 truncate">
                          {fmtDate(p.date)}
                        </span>
                        {p.mood && (
                          <span className={`text-[9px] font-display tracking-wider uppercase ml-auto ${moodCls}`}>
                            {p.mood}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs truncate ${isActive ? "text-primary" : "text-white-85"}`}>
                        {p.title || (p.content?.slice(0, 60) || "(empty)")}
                      </div>
                      {p.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white-4 text-white-40">
                              #{t}
                            </span>
                          ))}
                          {p.tags.length > 3 && (
                            <span className="text-[9px] text-white-30">+{p.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT: editor or empty state ═══ */}
        <div className="flex-1 min-w-0 flex flex-col">
          {error && (
            <div className="glass rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 mb-3 text-[11px] text-crimson flex items-center gap-2">
              <AlertCircle size={12} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-crimson/70 hover:text-crimson">
                <X size={11} />
              </button>
            </div>
          )}

          {!draft ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <BookOpen size={40} className="mx-auto text-white-10 mb-3" />
                <div className="text-sm text-white-30 mb-1">No entry open</div>
                <div className="text-[11px] text-white-20 mb-4">
                  {pages.length === 0
                    ? "Write your first entry."
                    : "Pick one from the list, or start a new one."}
                </div>
                <button
                  onClick={startNew}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg glass-crimson text-primary text-[11px] font-display tracking-wider hover:glow-crimson-sm transition-all"
                >
                  <Plus size={11} /> NEW ENTRY
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col glass rounded-xl border border-white-8 overflow-hidden min-h-0">
              <div className="p-3 border-b border-white-5 flex items-center gap-2">
                <button
                  onClick={cancelDraft}
                  className="flex items-center gap-1 text-[11px] text-teal hover:text-white transition-colors"
                >
                  <ChevronLeft size={12} /> BACK
                </button>
                <div className="flex-1" />
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="h-7 px-2 text-[11px] rounded-lg bg-[#0d0e17] border border-white-10 text-white-70 focus:outline-none"
                />
                <select
                  value={draft.mood}
                  onChange={(e) => setDraft({ ...draft, mood: e.target.value })}
                  className="h-7 px-2 text-[11px] rounded-lg bg-[#0d0e17] border border-white-10 text-white-70 focus:outline-none"
                >
                  {MOODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-y-auto">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Title (optional)…"
                  className="w-full px-0 py-1 bg-transparent border-0 text-base text-white-90 placeholder:text-white-25 focus:outline-none"
                />

                <div className="flex flex-wrap gap-1">
                  {PROMPT_CHIPS.map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setDraft((d) =>
                          d ? { ...d, content: (d.content ? d.content + "\n\n" : "") + c } : d,
                        )
                      }
                      className="px-2 py-0.5 rounded-full bg-white-4 border border-white-8 text-[10px] text-white-50 hover:text-white-80 hover:border-white-20 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={editorRef}
                  value={draft.content}
                  onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                  placeholder="What's on your mind?"
                  className="flex-1 min-h-[280px] w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white-10 text-xs text-white-85 placeholder:text-white-25 focus:outline-none resize-y leading-relaxed"
                />

                <div className="flex items-center gap-2">
                  <Tag size={11} className="text-white-30 shrink-0" />
                  <input
                    value={draft.tags}
                    onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                    placeholder="tags, comma, separated"
                    className="flex-1 h-8 px-3 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-85 placeholder:text-white-25 focus:outline-none"
                  />
                </div>

                {polishError && (
                  <div className="text-[11px] text-crimson/90 flex items-center gap-2">
                    <AlertCircle size={11} />
                    <span className="flex-1">{polishError}</span>
                    <button onClick={polish} className="underline">Retry</button>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white-5 flex items-center gap-2">
                <button
                  onClick={polish}
                  disabled={polishing || saving || !draft.content.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-teal text-[11px] font-display tracking-wider hover:text-white disabled:opacity-40 transition-colors"
                >
                  {polishing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  POLISH
                </button>
                {draft.id && (
                  <button
                    onClick={() => draft.id && remove(draft.id)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-crimson text-[11px] font-display tracking-wider hover:text-white disabled:opacity-40 transition-colors"
                  >
                    <Trash2 size={11} /> DELETE
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={cancelDraft}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg glass text-white-50 text-[11px] font-display tracking-wider hover:text-white-85 disabled:opacity-40 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display tracking-wider hover:glow-crimson-sm disabled:opacity-40 transition-all"
                >
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  SAVE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelLayout>
  );
}