import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/integrationCatalog";

const allCats = [...CATEGORIES, "Other"];

export default function AddAccountDialog({ open, onOpenChange, onAdd, editTarget }) {
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (editTarget) {
      setForm({
        label: editTarget.label || "",
        platform: editTarget.platform || "",
        category: editTarget.category || "Other",
        email: editTarget.email || "",
        username: editTarget.username || "",
        password: editTarget.password || "",
        two_factor: editTarget.two_factor || "",
        login_url: editTarget.login_url || "",
        notes: editTarget.notes || "",
        icon_color: editTarget.icon_color || "from-slate-500 to-slate-700",
      });
    } else {
      setForm(emptyForm());
    }
  }, [editTarget, open]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.label.trim() || !form.platform.trim()) return;
    onAdd(form, editTarget?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editTarget ? "Edit account" : "Add account credentials"}</DialogTitle>
          <DialogDescription>
            Store login info for a platform securely. Passwords are masked in the UI.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="label">Label</Label>
              <Input id="label" value={form.label} onChange={(e) => update("label", e.target.value)} placeholder="Work account" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platform">Platform</Label>
              <Input id="platform" value={form.platform} onChange={(e) => update("platform", e.target.value)} placeholder="Stripe" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => update("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allCats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="username" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="2fa">2FA / Backup codes</Label>
              <Input id="2fa" value={form.two_factor} onChange={(e) => update("two_factor", e.target.value)} placeholder="optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loginurl">Login URL</Label>
            <Input id="loginurl" value={form.login_url} onChange={(e) => update("login_url", e.target.value)} placeholder="https://app.example.com/login" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} placeholder="Recovery info, billing tier, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!form.label.trim() || !form.platform.trim()}>{editTarget ? "Save changes" : "Add account"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emptyForm() {
  return { label: "", platform: "", category: "Other", email: "", username: "", password: "", two_factor: "", login_url: "", notes: "", icon_color: "from-slate-500 to-slate-700" };
}