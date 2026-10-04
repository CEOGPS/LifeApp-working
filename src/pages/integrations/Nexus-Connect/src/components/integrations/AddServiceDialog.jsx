import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES } from "@/lib/integrationCatalog";
import { Plus, Link2, KeyRound } from "lucide-react";

export default function AddServiceDialog({ open, onOpenChange, onAdd }) {
  const [form, setForm] = useState({
    name: "",
    category: "Development",
    description: "",
    connection_type: "api_key",
    base_url: "",
    scopes: "",
    rotation_enabled: true,
    rotation_frequency_days: 30,
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) return;
    onAdd({
      ...form,
      is_custom: true,
      icon_color: "from-slate-500 to-slate-700",
      status: "disconnected",
    });
    setForm({ name: "", category: "Development", description: "", connection_type: "api_key", base_url: "", scopes: "", rotation_enabled: true, rotation_frequency_days: 30 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-slate-900" /> Add Custom Service
          </DialogTitle>
          <DialogDescription>
            Connect any app, site, or platform that isn't in the catalog. Provide its details and we'll track its credentials and rotation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Service name</Label>
              <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Notion" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What does this service do?" rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Connection type</Label>
            <Select value={form.connection_type} onValueChange={(v) => update("connection_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="api_key"><span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> API Key</span></SelectItem>
                <SelectItem value="oauth_pkce"><span className="flex items-center gap-2"><Link2 className="h-4 w-4" /> OAuth PKCE</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="url">Base URL</Label>
              <Input id="url" value={form.base_url} onChange={(e) => update("base_url", e.target.value)} placeholder="https://api.example.com" />
            </div>
            {form.connection_type === "oauth_pkce" && (
              <div className="space-y-1.5">
                <Label htmlFor="scopes">Scopes</Label>
                <Input id="scopes" value={form.scopes} onChange={(e) => update("scopes", e.target.value)} placeholder="read, write" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Auto-rotate keys</p>
              <p className="text-xs text-slate-500">Generate a fresh key on a schedule for safety.</p>
            </div>
            <Switch checked={form.rotation_enabled} onCheckedChange={(v) => update("rotation_enabled", v)} />
          </div>
          {form.rotation_enabled && (
            <div className="space-y-1.5">
              <Label htmlFor="freq">Rotation frequency (days)</Label>
              <Input id="freq" type="number" min={1} value={form.rotation_frequency_days} onChange={(e) => update("rotation_frequency_days", parseInt(e.target.value) || 30)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!form.name.trim()}>Add Service</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}