// src/pages/ActivityLog.jsx
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from './AuthContext';

const severityStyles = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const actorStyles = {
  agent: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  user: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  system: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await db.entities.ActivityLog.list('-created_date', 100);
        setLogs(data);
      } catch (e) {
        // entity may still be initializing
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-xl font-heading font-semibold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time feed of all agent, user, and system actions.</p>
      </header>

      <div className="space-y-0.5">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-4 px-4 py-3 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="text-xs text-muted-foreground font-mono w-36 shrink-0 pt-0.5">
              {new Date(log.created_date).toLocaleString()}
            </div>
            <Badge
              variant="outline"
              className={cn('shrink-0 w-20 justify-center capitalize', severityStyles[log.severity])}
            >
              {log.severity}
            </Badge>
            <Badge
              variant="outline"
              className={cn('shrink-0 w-20 justify-center capitalize', actorStyles[log.actor])}
            >
              {log.actor}
            </Badge>
            <p className="text-sm pt-0.5">{log.detail}</p>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">No activity logged yet.</div>
        )}
      </div>
    </div>
  );
}