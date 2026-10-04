const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ShieldCheck, KeyRound, Link2, Pencil, Trash2, Eye, EyeOff, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import AddOAuthProviderDialog from "@/components/integrations/AddOAuthProviderDialog";

export default function OAuthProviders() {
  const [providers, setProviders] = useState(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [visibleSecrets, setVisibleSecrets] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await db.entities.OAuthProvider.list("-created_date", 100);
      setProviders(data);
    } catch (e) {
      setProviders([]);
    }
  };

  const filtered = (providers || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.provider || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (formData, editId) => {
    try {
      if (editId) {
        await db.entities.OAuthProvider.update(editId, formData);
        toast({ title: "Provider updated" });
      } else {
        await db.entities.OAuthProvider.create({ ...formData, status: "configured" });
        toast({ title: "Provider added" });
      }
      setDialogOpen(false);
      setEditTarget(null);
      load();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.entities.OAuthProvider.delete(id);
      toast({ title: "Provider deleted" });
      load();
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text || "");
    toast({ title: "Copied to clipboard" });
  };

  const toggleSecret = (id) => setVisibleSecrets((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div>
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">OAuth Providers</h2>
              <p className="text-sm text-slate-500">Configure OAuth 2.0 providers with client credentials, redirect URIs, and endpoints.</p>
            </div>
          </div>
        </div>

        {/* Search + Add */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search providers…" className="pl-9" />
          </div>
          <Button onClick={() => { setEditTarget(null); setDialogOpen(true); }} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Provider
          </Button>
        </div>

        {/* Content */}
        {providers === null ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-20 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No OAuth providers yet</p>
            <p className="mt-1 text-sm text-slate-400">Add a provider to configure its OAuth flow.</p>
            <Button onClick={() => setDialogOpen(true)} size="sm" className="mt-4 gap-1.5">
              <Plus className="h-4 w-4" /> Add Provider
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <div key={p.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${p.icon_color || "from-slate-500 to-slate-700"} text-white shadow-sm`}>
                      <span className="text-sm font-bold">{(p.name || "?").charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{p.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {p.status === "active" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : p.status === "error" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        <AlertCircle className="h-3 w-3" /> Error
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        Configured
                      </span>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="mt-3 space-y-2 text-xs">
                  <FieldRow icon={KeyRound} label="Client ID" value={p.client_id} onCopy={() => copyToClipboard(p.client_id)} />
                  <FieldRow
                    icon={KeyRound}
                    label="Client secret"
                    value={visibleSecrets[p.id] ? p.client_secret : "••••••••••••"}
                    onToggle={() => toggleSecret(p.id)}
                    visible={visibleSecrets[p.id]}
                    onCopy={() => copyToClipboard(p.client_secret)}
                  />
                  <FieldRow icon={Link2} label="Redirect URI" value={p.redirect_uri} onCopy={() => copyToClipboard(p.redirect_uri)} />
                  <FieldRow icon={Link2} label="Auth URL" value={p.authorization_url} onCopy={() => copyToClipboard(p.authorization_url)} />
                  <FieldRow icon={Link2} label="Token URL" value={p.token_url} onCopy={() => copyToClipboard(p.token_url)} />
                  <FieldRow icon={Link2} label="API base" value={p.api_base_url} onCopy={() => copyToClipboard(p.api_base_url)} />
                  <div className="flex items-start gap-1.5 pt-1">
                    <span className="font-medium text-slate-500">Scopes:</span>
                    <span className="text-slate-700">{p.scopes || "—"}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
                  <Button variant="ghost" size="icon" onClick={() => { setEditTarget(p); setDialogOpen(true); }} title="Edit">
                    <Pencil className="h-4 w-4 text-slate-500" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddOAuthProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={handleAdd} editTarget={editTarget} />
    </div>
  );
}

function FieldRow({ icon: Icon, label, value, onToggle, visible, onCopy }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="w-20 shrink-0 font-medium text-slate-500">{label}</span>
      <span className="flex-1 truncate text-slate-700">{value || "—"}</span>
      {onToggle && (
        <button onClick={onToggle} className="shrink-0 text-slate-400 hover:text-slate-600">
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      {onCopy && value && (
        <button onClick={onCopy} className="shrink-0 text-slate-400 hover:text-slate-600">
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}