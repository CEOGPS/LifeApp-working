const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, KeyRound, Eye, EyeOff, Loader2, Trash2, ExternalLink, Pencil } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import AddAccountDialog from "@/components/integrations/AddAccountDialog";

export default function AccountVault() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await db.entities.Account.list("-updated_date", 200);
      setAccounts(list);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data, id) => {
    try {
      if (id) {
        await db.entities.Account.update(id, data);
        toast({ title: "Account updated" });
      } else {
        await db.entities.Account.create(data);
        toast({ title: "Account saved", description: `${data.label} stored securely.` });
      }
      setAddOpen(false);
      setEditTarget(null);
      await load();
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (acc) => {
    try {
      await db.entities.Account.delete(acc.id);
      await load();
      toast({ title: "Account removed" });
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const filtered = accounts.filter(
    (a) => !search || a.label.toLowerCase().includes(search.toLowerCase()) || (a.platform || "").toLowerCase().includes(search.toLowerCase()) || (a.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Account Vault</h2>
            <p className="text-xs text-slate-500">Securely store emails, usernames, and login info for connected platforms.</p>
          </div>
        </div>
        <Button onClick={() => { setEditTarget(null); setAddOpen(true); }} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Account
        </Button>
      </div>

      <div className="mt-6 relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…" className="pl-9" />
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-center">
            <KeyRound className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">No accounts stored yet</p>
            <p className="mt-1 text-xs text-slate-400">Add login credentials for your platforms to keep them safe.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((a) => (
              <AccountCard key={a.id} account={a} onEdit={() => { setEditTarget(a); setAddOpen(true); }} onDelete={() => handleDelete(a)} />
            ))}
          </div>
        )}
      </div>

      <AddAccountDialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setEditTarget(null); }} onAdd={handleSave} editTarget={editTarget} />
    </div>
  );
}

function AccountCard({ account, onEdit, onDelete }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${account.icon_color || "from-slate-500 to-slate-700"} text-white`}>
            <span className="text-sm font-bold">{account.platform.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{account.label}</h3>
            <p className="text-[11px] text-slate-500">{account.platform} · {account.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        {account.email && <Row label="Email" value={account.email} />}
        {account.username && <Row label="Username" value={account.username} />}
        {account.password && (
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Password</dt>
            <dd className="flex items-center gap-1.5">
              <code className="font-mono text-slate-700">{reveal ? account.password : "••••••••••"}</code>
              <button onClick={() => setReveal((r) => !r)} className="text-slate-400 hover:text-slate-700">
                {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </dd>
          </div>
        )}
        {account.two_factor && <Row label="2FA" value={account.two_factor} mono />}
      </dl>

      <div className="mt-3 flex items-center gap-2">
        {account.login_url && (
          <a href={account.login_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline">
            <ExternalLink className="h-3 w-3" /> Open login
          </a>
        )}
        {account.notes && <p className="ml-auto line-clamp-1 text-[11px] text-slate-400">{account.notes}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className={`truncate text-right text-slate-700 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}