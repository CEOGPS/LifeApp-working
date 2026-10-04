// src/pages/CampaignDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from './logActivity';
import { Loader2, Play, Square, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from './AuthContext';

const statusStyles = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  stopped: 'bg-red-500/10 text-red-400 border-red-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function CampaignDashboard() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const data = await db.entities.Campaign.list('-created_date');
      setCampaigns(data);
    } catch (e) {
      // entity may still be initializing
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAction = async (c, action) => {
    setBusy(c.id);
    const updates = {
      start: { status: 'active', current_step: 'Running' },
      stop: { status: 'stopped', current_step: 'Stopped by user' },
      takeover: { status: 'paused', current_step: 'Manual control' },
    }[action];
    const detail = {
      start: `Started campaign "${c.name}"`,
      stop: `Stopped campaign "${c.name}"`,
      takeover: `Took over campaign "${c.name}"`,
    }[action];
    try {
      await db.entities.Campaign.update(c.id, { ...updates, last_synced: new Date().toISOString() });
      await logActivity(action === 'stop' ? 'warning' : 'info', 'user', detail);
      toast({ title: detail });
      load();
    } catch (e) {
      toast({ title: 'Error', description: 'Action failed.', variant: 'destructive' });
    }
    setBusy(null);
  };

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
        <h1 className="text-xl font-heading font-semibold tracking-tight">Campaign Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {campaigns.length} campaigns • Monitor and control active revenue streams.
        </p>
      </header>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Earnings</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Current Step</th>
                <th className="px-4 py-3 font-medium">Last Synced</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{c.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('capitalize', statusStyles[c.status])}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-400">${(c.earnings_total || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 w-32">
                      <Progress value={c.progress || 0} className="h-1.5" />
                      <span className="text-xs text-muted-foreground w-8">{c.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.current_step || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {c.last_synced ? new Date(c.last_synced).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={c.status === 'active' || busy === c.id}
                        onClick={() => handleAction(c, 'start')}
                        className="h-8 gap-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <Play className="w-3.5 h-3.5" /> Start
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={c.status === 'stopped' || busy === c.id}
                        onClick={() => handleAction(c, 'stop')}
                        className="h-8 gap-1 text-red-400 hover:text-red-300"
                      >
                        <Square className="w-3.5 h-3.5" /> Stop
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={c.status === 'paused' || busy === c.id}
                        onClick={() => handleAction(c, 'takeover')}
                        className="h-8 gap-1 text-amber-400 hover:text-amber-300"
                      >
                        <Hand className="w-3.5 h-3.5" /> Take Over
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {campaigns.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No campaigns yet. Approve strategies from the Strategy Hub.
          </div>
        )}
      </div>
    </div>
  );
}