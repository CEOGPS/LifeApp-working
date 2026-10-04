import { Bell, Mail, MessageSquare, AlertCircle, Rss } from "lucide-react";

const SOURCES = [
  { icon: <Mail className="h-3.5 w-3.5 shrink-0" />, label: "Email" },
  { icon: <MessageSquare className="h-3.5 w-3.5 shrink-0" />, label: "SMS" },
  { icon: <Rss className="h-3.5 w-3.5 shrink-0" />, label: "Social" },
  { icon: <AlertCircle className="h-3.5 w-3.5 shrink-0" />, label: "System" },
];

export default function NotificationsModule() {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary pulse-crimson" />
        <span className="text-[11px] text-primary/70 font-display tracking-widest">
          LIVE
        </span>
        <div className="ml-auto flex gap-1.5">
          {SOURCES.map((s) => (
            <div
              key={s.label}
              title={s.label}
              className="w-7 h-7 rounded flex items-center justify-center glass text-white-50 hover:text-white-90 cursor-pointer transition-colors"
            >
              {s.icon}
            </div>
          ))}
        </div>
      </div>

      {/* Notification feed */}
      <div className="flex-1 overflow-y-auto space-y-2">
        <div className="text-center pt-8">
          <Bell className="mx-auto mb-3 h-5 w-5 shrink-0 text-white-25" />
          <div className="text-sm text-white-70">
            All clear — no notifications
          </div>
          <div className="text-xs text-white-30 mt-1">
            Connect sources to receive alerts
          </div>
        </div>
      </div>

      {/* Channel status */}
      <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2">
        {SOURCES.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 p-2 rounded bg-white/3 border border-white/5"
          >
            <span className="text-white-50">{s.icon}</span>
            <span className="text-xs font-medium text-white-70">{s.label}</span>
            <div className="ml-auto w-2 h-2 rounded-full bg-white/20" />
          </div>
        ))}
      </div>
    </div>
  );
}