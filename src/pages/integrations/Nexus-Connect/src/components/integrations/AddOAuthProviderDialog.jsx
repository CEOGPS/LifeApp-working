import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OAUTH_PRESETS } from "@/lib/oauthPresets";

export default function AddOAuthProviderDialog({ open, onOpenChange, onAdd, editTarget }) {
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (editTarget) {
      setForm({
        name: editTarget.name || "",
        provider: editTarget.provider || "custom",
        client_id: editTarget.client_id || "",
        client_secret: editTarget.client_secret || "",
        redirect_uri: editTarget.redirect_uri || "",
        authorization_url: editTarget.authorization_url || "",
        token_url: editTarget.token_url || "",
        api_base_url: editTarget.api_base_url || "",
        scopes: editTarget.scopes || "",
        icon_color: editTarget.icon_color || "from-slate-500 to-slate-700",
        notes: editTarget.notes || "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [editTarget, open]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const applyPreset = (presetKey) => {
    const preset = OAUTH_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    setForm((f) => ({
      ...f,
      provider: preset.key,
      name: f.name || preset.label,
      authorization_url: preset.authorization_url,
      token_url: preset.token_url,
      api_base_url: preset.api_base_url,
      scopes: preset.scopes,
      icon_color: preset.icon_color,
    }));
  };

  const submit = () => {
    if (!form.name.trim()) return;
    onAdd(form, editTarget?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editTarget ? "Edit OAuth provider" : "Add OAuth provider"}</DialogTitle>
          <DialogDescription>
            Select a preset to auto-fill endpoints, then enter your client credentials and redirect URI.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Provider preset</Label>
              <Select value={form.provider} onValueChange={(v) => applyPreset(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OAUTH_PRESETS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="My Google OAuth" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client_id">Client ID</Label>
            <Input id="client_id" value={form.client_id} onChange={(e) => update("client_id", e.target.value)} placeholder="your-client-id" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client_secret">Client secret</Label>
            <Input id="client_secret" type="password" value={form.client_secret} onChange={(e) => update("client_secret", e.target.value)} placeholder="••••••••" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="redirect_uri">Redirect URI</Label>
            <Input id="redirect_uri" value={form.redirect_uri} onChange={(e) => update("redirect_uri", e.target.value)} placeholder="https://yourapp.com/callback" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth_url">Authorization URL</Label>
            <Input id="auth_url" value={form.authorization_url} onChange={(e) => update("authorization_url", e.target.value)} placeholder="https://provider.com/oauth/authorize" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="token_url">Token URL</Label>
            <Input id="token_url" value={form.token_url} onChange={(e) => update("token_url", e.target.value)} placeholder="https://provider.com/oauth/token" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api_url">API base URL</Label>
            <Input id="api_url" value={form.api_base_url} onChange={(e) => update("api_base_url", e.target.value)} placeholder="https://api.provider.com" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scopes">Scopes</Label>
            <Input id="scopes" value={form.scopes} onChange={(e) => update("scopes", e.target.value)} placeholder="read, write" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} placeholder="App permissions, team info, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!form.name.trim()}>{editTarget ? "Save changes" : "Add provider"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return {
    name: "",
    provider: "custom",
    client_id: "",
    client_secret: "",
    redirect_uri: "",
    authorization_url: "",
    token_url: "",
    api_base_url: "",
    scopes: "",
    icon_color: "from-slate-500 to-slate-700",
    notes: "",
  };
}