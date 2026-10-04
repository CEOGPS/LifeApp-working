// src/pages/StrategyHub.jsx
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from './logActivity';
import { Loader2, Check, X, TrendingUp, Clock, AlertTriangle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from './AuthContext';

const difficultyStyles = {
  beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  advanced: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function StrategyHub() {
  const { toast } = useToast();
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await db.entities.Strategy.list('-created_date');
        setStrategies(data);
      } catch (e) {
        // entity may still be initializing
      }
      setLoading(false);
    })();
  }, []);

  const handleApprove = async (s) => {
    setBusy(s.id);
    try {
      await db.entities.Strategy.update(s.id, { status: 'approved' });
      await db.entities.Campaign.create({
        name: s.name,
        strategy_id: s.id,
        status: 'active',
        earnings_total: 0,
        progress: 0,
        current_step: 'Initializing',
        last_synced: new Date().toISOString(),
      });
      await logActivity('success', 'user', `Approved strategy "${s.name}" — campaign created`);
      setStrategies((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: 'approved' } : x)));
      toast({ title: 'Strategy approved', description: `${s.name} moved to campaigns` });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not approve strategy.', variant: 'destructive' });
    }
    setBusy(null);
  };

  const handleDecline = async (s) => {
    setBusy(s.id);
    try {
      await db.entities.Strategy.update(s.id, { status: 'declined' });
      await logActivity('warning', 'user', `Declined strategy "${s.name}"`);
      setStrategies((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: 'declined' } : x)));
      toast({ title: 'Strategy declined', description: s.name });
    } catch (e) {
      toast({ title: 'Error', variant: 'destructive' });
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
        <h1 className="text-xl font-heading font-semibold tracking-tight">Strategy Hub</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review and approve strategies for the agent to execute.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {strategies.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-[15px]">{s.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
              </div>
              <Badge variant="outline" className={cn('shrink-0 capitalize', difficultyStyles[s.difficulty])}>
                {s.difficulty}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Est. profit: <span className="text-foreground font-medium">${s.estimated_profit_min}–${s.estimated_profit_max}/mo</span></span>
              </div>
              <div className="flex gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Time: <span className="text-foreground">{s.time_commitment}</span></span>
              </div>
              <div className="flex gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Risks: <span className="text-foreground">{s.risks}</span></span>
              </div>
              <div className="flex gap-2 text-muted-foreground">
                <Layers className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Platforms: <span className="text-foreground">{(s.platforms_needed || []).join(', ')}</span></span>
              </div>
            </div>

            <div className="text-sm text-muted-foreground border-t border-border pt-3">
              <span className="text-foreground/70">How it works: </span>{s.how_it_works}
            </div>

            {s.status === 'pending' ? (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => handleApprove(s)}
                  disabled={busy === s.id}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(s)}
                  disabled={busy === s.id}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Decline
                </Button>
              </div>
            ) : (
              <div className="pt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    'capitalize',
                    s.status === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  )}
                >
                  {s.status}
                </Badge>
              </div>
            )}
          </div>
        ))}
      </div>

      {strategies.length === 0 && (
        <div className="text-center py-20 text-muted-foreground text-sm">
          No strategies yet. The agent will generate them shortly.
        </div>
      )}
    </div>
  );
}