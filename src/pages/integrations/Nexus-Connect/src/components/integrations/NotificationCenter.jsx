const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useRef } from "react";

import { Bell, AlertTriangle, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const DUE_SOON_DAYS = 3;

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await db.entities.Integration.list("-updated_date", 200);
      const now = Date.now();
      const notes = [];
      for (const i of list) {
        if (i.status === "error") {
          notes.push({ type: "error", title: `${i.name} connection error`, desc: "Reconnect or rotate to fix.", icon: "error", id: i.id });
        }
        if (i.status === "connected" && i.rotation_enabled && i.next_rotation) {
          const next = new Date(i.next_rotation).getTime();
          const diffDays = (next - now) / 86400000;
          if (diffDays < 0) {
            notes.push({ type: "overdue", title: `${i.name} key overdue`, desc: `Rotation was due ${formatDistanceToNow(new Date(i.next_rotation), { addSuffix: true })}.`, icon: "overdue", id: i.id });
          } else if (diffDays <= DUE_SOON_DAYS) {
            notes.push({ type: "due", title: `${i.name} rotation due soon`, desc: `Rotates in ${Math.ceil(diffDays)} day(s).`, icon: "clock", id: i.id });
          }
        }
      }
      setNotifications(notes);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const count = notifications.length;
  const Icon = ({ type, className }) => {
    if (type === "error") return <AlertTriangle className={className} />;
    if (type === "overdue") return <RefreshCw className={className} />;
    if (type === "clock") return <Clock className={className} />;
    return <CheckCircle2 className={className} />;
  };
  const color = (t) =>
    t === "error" ? "text-red-600 bg-red-50"
    : t === "overdue" ? "text-orange-600 bg-orange-50"
    : t === "clock" ? "text-amber-600 bg-amber-50"
    : "text-emerald-600 bg-emerald-50";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Status notifications</p>
            <span className="text-xs text-slate-400">{count} active</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <p className="mt-2 text-xs text-slate-500">All clear — no rotations due and no errors.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id + n.type} className="flex items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color(n.type)}`}>
                    <Icon type={n.icon} className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{n.desc}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}