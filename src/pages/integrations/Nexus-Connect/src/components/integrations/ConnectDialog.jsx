import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Link2, ShieldCheck, Loader2 } from "lucide-react";

// Simulated connect flow. For api_key, the user pastes a key (stored masked).
// For oauth_pkce, we simulate the PKCE handshake redirect.
export default function ConnectDialog({ integration, open, onOpenChange, onConnected }) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [loading, setLoading] = useState(false);

  if (!integration) return null;
  const isOauth = integration.connection_type === "oauth_pkce";

  const handleConnect = async () => {
    setLoading(true);
    // Simulate network handshake / OAuth redirect round-trip
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    const now = new Date().toISOString();
    onConnected({
      status: "connected",
      api_key: isOauth ? "" : apiKey,
      api_secret: isOauth ? "" : apiSecret,
      last_rotated: now,
      next_rotation: integration.rotation_enabled
        ? new Date(Date.now() + (integration.rotation_frequency_days || 30) * 86400000).toISOString()
        : null,
    });
    setApiKey("");
    setApiSecret("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${integration.icon_color} text-white`}>
              {integration.name.charAt(0).toUpperCase()}
            </div>
            Connect {integration.name}
          </DialogTitle>
          <DialogDescription>
            {isOauth
              ? "You'll be redirected to authorize this app via secure OAuth PKCE. We'll store the resulting token and rotate it on your schedule."
              : "Paste your API credentials. They're stored securely and masked in the UI."}
          </DialogDescription>
        </DialogHeader>

        {isOauth ? (
          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <div className="flex items-start gap-3">
                <Link2 className="mt-0.5 h-4 w-4 text-indigo-600" />
                <div className="text-xs leading-relaxed text-slate-600">
                  <p className="font-medium text-slate-900">OAuth PKCE flow</p>
                  <p className="mt-1">Scopes requested: <span className="font-mono text-indigo-700">{integration.scopes || "default"}</span></p>
                  <p className="mt-1">Endpoint: <span className="font-mono text-slate-500">{integration.base_url}</span></p>
                </div>
              </div>
            </div>
            {integration.rotation_enabled && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                Auto-rotation enabled — keys refresh every {integration.rotation_frequency_days} days.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="apikey">API Key</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="apikey" className="pl-9" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." type="password" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apisecret">API Secret (optional)</Label>
              <Input id="apisecret" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="secret" type="password" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConnect} disabled={loading || (!isOauth && !apiKey)}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</> : isOauth ? "Authorize" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}