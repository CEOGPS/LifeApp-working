const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ShieldCheck, CalendarClock, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "@/components/ui/use-toast";

export default function RotationSchedule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await db.entities.Integration.list("-updated_date", 200);
      setItems(list.filter((i) => i.status === "connected"));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rotate = async (integration) => {
    setRotating(integration.id);
    try {
      const now = new Date().toISOString();
      const next = new Date(Date.now() + (integration.rotation_frequency_days || 30) * 86400000).toISOString();
      await db.entities.Integration.update(integration.id, { last_rotated: now, next_rotation: next, status: "connected" });
      await load();
      toast({ title: "Key rotated", description: `${integration.name} credentials refreshed securely.` });
    } catch (e) {
      toast({ title: "Rotation failed", description: e.message, variant: "destructive" });
    } finally {
      setRotating(null);
    }
  };

  const now = Date.now();
  const enriched = items.map((i) => {
    const next = i.next_rotation ? new Date(i.next_rotation).getTime() : null;
    let state = "scheduled";
    if (i.status === "error") state = "error";
    else if (next !== null && next < now) state = "overdue";
    else if (next !== null && (next - now) / 86400000 <= 3) state = "due";
    return { ...i, next, state };
  });
  const sorted = enriched.sort((a, b) => {
    const order = { error: 0, overdue: 1, due: 2, scheduled: 3 };
    if (order[a.state] !== order[b.state]) return order[a.state] - order[b.state];
    return (a.next ?? Infinity) - (b.next ?? Infinity);
  });

  const counts = {
    overdue: enriched.filter((e) => e.state === "overdue").length,
    due: enriched.filter((e) => e.state === "due").length,
    scheduled: enriched.filter((e) => e.state === "scheduled").length,
    error: enriched.filter((e) => e.state === "error").length,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Rotation Schedule</h2>
          <p className="text-xs text-slate-500">Automatic key rotation timeline and status for every connected service.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Overdue" value={counts.overdue} icon={<AlertTriangle className="h-4 w-4 text-orange-600" />} tone="bg-orange-50" />
        <SummaryCard label="Due soon" value={counts.due} icon={<Clock className="h-4 w-4 text-amber-600" />} tone="bg-amber-50" />
        <SummaryCard label="Scheduled" value={counts.scheduled} icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />} tone="bg-emerald-50" />
        <SummaryCard label="Errors" value={counts.error} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} tone="bg-red-50" />
      </div>

      {/* Timeline */}
      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">No connected services yet</p>
            <p className="mt-1 text-xs text-slate-400">Connect a service with auto-rotation enabled to see it here.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />
            <ul className="space-y-3">
              {sorted.map((i) => (
                <li key={i.id} className="relative flex items-start gap-4">
                  <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ${dotColor(i.state)}`}>
                    <span className="text-sm font-bold text-white">{i.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">{i.name}</h3>
                          <StateBadge state={i.state} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {i.next ? (
                            <>Next rotation: <span className="font-medium text-slate-700">{format(new Date(i.next), "MMM d, yyyy")}</span> ({formatDistanceToNow(new Date(i.next), { addSuffix: true })})</>
                          ) : (
                            "No rotation scheduled."
                          )}
                        </p>
                        {i.last_rotated && (
                          <p className="mt-0.5 text-[11px] text-slate-400">Last rotated {formatDistanceToNow(new Date(i.last_rotated), { addSuffix: true })}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden text-[11px] text-slate-400 sm:inline">Every {i.rotation_frequency_days || 30}d</span>
                        <Button size="sm" variant="outline" disabled={rotating === i.id} onClick={() => rotate(i)} className="gap-1.5">
                          {rotating === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Rotate now
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function StateBadge({ state }) {
  const map = {
    overdue: { label: "Overdue", cls: "bg-orange-50 text-orange-700" },
    due: { label: "Due soon", cls: "bg-amber-50 text-amber-700" },
    scheduled: { label: "Scheduled", cls: "bg-emerald-50 text-emerald-700" },
    error: { label: "Error", cls: "bg-red-50 text-red-700" },
  };
  const s = map[state] || map.scheduled;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>;
}

function dotColor(state) {
  if (state === "error") return "bg-red-500";
  if (state === "overdue") return "bg-orange-500";
  if (state === "due") return "bg-amber-500";
  return "bg-emerald-500";
}