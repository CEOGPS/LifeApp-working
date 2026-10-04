// src/pages/FinancialAccounts.jsx
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, DollarSign, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from './AuthContext';

const providerConfig = {
  stripe: { label: 'Stripe', color: 'bg-indigo-500/10 text-indigo-400' },
  gumroad: { label: 'Gumroad', color: 'bg-pink-500/10 text-pink-400' },
  paypal: { label: 'PayPal', color: 'bg-blue-500/10 text-blue-400' },
};

const statusStyles = {
  connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  disconnected: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function FinancialAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await db.entities.FinancialAccount.list();
        setAccounts(data);
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

  const totalEarned = accounts.reduce((sum, a) => sum + (a.total_earned || 0), 0);
  const totalPending = accounts.reduce((sum, a) => sum + (a.pending_payout || 0), 0);

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-xl font-heading font-semibold tracking-tight">Financial Accounts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Connected payment platforms and earnings.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <CreditCard className="w-4 h-4" /> Total Earned
          </div>
          <div className="text-2xl font-semibold font-mono text-emerald-400">${totalEarned.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <Clock className="w-4 h-4" /> Pending Payout
          </div>
          <div className="text-2xl font-semibold font-mono text-amber-400">${totalPending.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <DollarSign className="w-4 h-4" /> Connected
          </div>
          <div className="text-2xl font-semibold font-mono">
            {accounts.filter((a) => a.connection_status === 'connected').length}/{accounts.length}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {accounts.map((a) => {
          const cfg = providerConfig[a.provider] || { label: a.provider, color: 'bg-muted text-foreground' };
          return (
            <div key={a.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium', cfg.color)}>
                  <CreditCard className="w-4 h-4" /> {cfg.label}
                </div>
                <Badge variant="outline" className={cn('capitalize', statusStyles[a.connection_status])}>
                  {a.connection_status}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total earned</span>
                  <span className="font-mono text-emerald-400">${(a.total_earned || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending payout</span>
                  <span className="font-mono text-amber-400">${(a.pending_payout || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
            No financial accounts connected yet.
          </div>
        )}
      </div>
    </div>
  );
}