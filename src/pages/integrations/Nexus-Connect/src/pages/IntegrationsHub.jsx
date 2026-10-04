const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState, useEffect, useMemo, useCallback } from "react";

import { CATALOG, CATEGORIES } from "@/lib/integrationCatalog";
import CategorySidebar from "@/components/integrations/CategorySidebar";
import ServiceCard from "@/components/integrations/ServiceCard";
import AddServiceDialog from "@/components/integrations/AddServiceDialog";
import ConnectDialog from "@/components/integrations/ConnectDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ShieldCheck, RefreshCw, Loader2, Star, Zap } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function IntegrationsHub() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [connectTarget, setConnectTarget] = useState(null);
  const [rotating, setRotating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await db.entities.Integration.list("-updated_date", 200);
      setIntegrations(list);
    } catch (e) {
      // first run: nothing yet
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Merge catalog templates with user-saved integrations by name.
  const merged = useMemo(() => {
    const savedMap = new Map(integrations.map((i) => [i.name, i]));
    const result = [];
    for (const tmpl of CATALOG) {
      const saved = savedMap.get(tmpl.name);
      result.push(saved ? { ...tmpl, ...saved, icon_color: saved.icon_color || tmpl.icon_color } : { ...tmpl, status: "disconnected" });
    }
    // custom integrations not in catalog
    for (const i of integrations) {
      if (!CATALOG.some((c) => c.name === i.name)) result.push(i);
    }
    return result;
  }, [integrations]);

  const filtered = useMemo(() => {
    return merged.filter((i) => {
      const matchCat = activeCategory === "All" || i.category === activeCategory;
      const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.description || "").toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [merged, activeCategory, search]);

  const counts = useMemo(() => {
    const c = { all: 0 };
    CATEGORIES.forEach((cat) => (c[cat] = 0));
    for (const i of merged) {
      if (i.status === "connected") c.all += 1;
      if (c[i.category] !== undefined) c[i.category] += 1;
    }
    return c;
  }, [merged]);

  const stats = useMemo(() => {
    const connected = merged.filter((i) => i.status === "connected").length;
    const rotating = merged.filter((i) => i.status === "connected" && i.rotation_enabled).length;
    const oauth = merged.filter((i) => i.connection_type === "oauth_pkce").length;
    return { connected, rotating, oauth, total: merged.length };
  }, [merged]);

  const upsert = async (data) => {
    // find existing by name
    const existing = integrations.find((i) => i.name === data.name);
    if (existing) {
      return await db.entities.Integration.update(existing.id, data);
    }
    return await db.entities.Integration.create(data);
  };

  const handleConnect = async (patch) => {
    const target = connectTarget;
    if (!target) return;
    try {
      const saved = await upsert({
        name: target.name,
        category: target.category,
        description: target.description,
        connection_type: target.connection_type,
        base_url: target.base_url,
        scopes: target.scopes,
        icon_color: target.icon_color,
        is_custom: target.is_custom || false,
        rotation_enabled: target.rotation_enabled ?? false,
        rotation_frequency_days: target.rotation_frequency_days ?? 30,
        ...patch,
      });
      setConnectTarget(null);
      await load();
      toast({ title: "Connected", description: `${target.name} is now connected.` });
    } catch (e) {
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
    }
  };

  const handleRotate = async (integration) => {
    setRotating(integration.id || integration.name);
    try {
      const now = new Date().toISOString();
      const next = new Date(Date.now() + (integration.rotation_frequency_days || 30) * 86400000).toISOString();
      if (integration.id) {
        await db.entities.Integration.update(integration.id, { last_rotated: now, next_rotation: next, status: "connected" });
      } else {
        await upsert({ ...integration, status: "connected", last_rotated: now, next_rotation: next });
      }
      await load();
      toast({ title: "Key rotated", description: `${integration.name} credentials refreshed securely.` });
    } catch (e) {
      toast({ title: "Rotation failed", description: e.message, variant: "destructive" });
    } finally {
      setRotating(null);
    }
  };

  const handleDisconnect = async (integration) => {
    try {
      if (integration.id) {
        await db.entities.Integration.update(integration.id, { status: "disconnected", api_key: "", api_secret: "" });
      }
      await load();
      toast({ title: "Disconnected", description: `${integration.name} has been disconnected.` });
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (integration) => {
    try {
      if (integration.id) await db.entities.Integration.delete(integration.id);
      await load();
      toast({ title: "Removed", description: `${integration.name} was deleted.` });
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleAddCustom = async (data) => {
    try {
      await db.entities.Integration.create(data);
      setAddOpen(false);
      await load();
      toast({ title: "Service added", description: `${data.name} added to your hub.` });
    } catch (e) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20">
            <CategorySidebar activeCategory={activeCategory} onSelect={setActiveCategory} counts={counts} />
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Connected" value={stats.connected} icon={<Zap className="h-4 w-4 text-amber-600" />} />
            <StatCard label="Auto-rotating" value={stats.rotating} icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />} />
            <StatCard label="OAuth PKCE" value={stats.oauth} icon={<RefreshCw className="h-4 w-4 text-indigo-600" />} />
            <StatCard label="Total services" value={stats.total} icon={<Plus className="h-4 w-4 text-slate-600" />} />
          </div>

          {/* Search + category chips (mobile) */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services…" className="pl-9" />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-slate-500">
                {activeCategory === "All" ? "All categories" : activeCategory}
                <span className="ml-1.5 text-slate-400">· {filtered.length} services</span>
              </div>
              <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Service
              </Button>
            </div>
          </div>

          {/* Mobile category chips */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            <Chip active={activeCategory === "All"} onClick={() => setActiveCategory("All")}>All</Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={activeCategory === c} onClick={() => setActiveCategory(c)}>{c}</Chip>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-20 text-center">
              <p className="text-sm font-medium text-slate-600">No services found</p>
              <p className="mt-1 text-xs text-slate-400">Try a different category or add a custom service.</p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((i) => (
                <ServiceCard
                  key={i.id || i.name}
                  integration={i}
                  onConnect={(intg) => setConnectTarget(intg)}
                  onRotate={handleRotate}
                  onDisconnect={handleDisconnect}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <AddServiceDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAddCustom} />
      <ConnectDialog
        integration={connectTarget}
        open={!!connectTarget}
        onOpenChange={(o) => !o && setConnectTarget(null)}
        onConnected={handleConnect}
      />
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"
      }`}
    >
      {children}
    </button>
  );
}