// src/panels/MapsPanel.tsx
// LifeOS1 — Maps Panel (Batch 5)
// Path B: real CRUD against Worker /api/maps/*, no fake geocoding, no fake routing.
// If MAPS_API_KEY is not set on the Worker, geocode/route honestly report configured:false.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin, Plus, Save, Layers, Search, Trash2, Eye, ZoomIn, ZoomOut,
  Navigation, RefreshCw, Download, Copy, Sparkles, X, Loader2,
  AlertCircle, CheckCircle, Info, Settings, Crosshair,
} from "lucide-react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { lifeosApi } from "@/lib/lifeosApi";
import { invokeLLM } from "@/lib/invokeLLM";
import { useUserEmail } from "@/hooks/useUserEmail";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type AreaType = "radius" | "zip" | "county" | "polygon" | "pin";
type LocationCategory = "home" | "work" | "health" | "client" | "favorite" | "travel" | "errand" | "custom";
type TravelMode = "car" | "bike" | "walk" | "transit";

interface MapsArea {
  id: string;
  name: string;
  area_type: AreaType;
  color: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_miles: number | null;
  codes: string[] | null;
  polygon: [number, number][] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MapsLocation {
  id: string;
  label: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  category: LocationCategory;
  color: string;
  contact_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MapsRoute {
  id: string;
  from_label: string | null;
  to_label: string | null;
  travel_mode: TravelMode;
  distance_miles: number | null;
  duration_min: number | null;
  provider: string | null;
  created_at: string;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const AREA_TYPES: { id: AreaType; label: string }[] = [
  { id: "pin",     label: "Pin" },
  { id: "radius",  label: "Radius" },
  { id: "zip",     label: "Zip Code" },
  { id: "county",  label: "County" },
  { id: "polygon", label: "Polygon" },
];

const LOCATION_CATEGORIES: { id: LocationCategory; label: string; color: string }[] = [
  { id: "home",     label: "Home",     color: "#dc2626" },
  { id: "work",     label: "Work",     color: "#2563eb" },
  { id: "health",   label: "Health",   color: "#16a34a" },
  { id: "client",   label: "Client",   color: "#9333ea" },
  { id: "favorite", label: "Favorite", color: "#eab308" },
  { id: "travel",   label: "Travel",   color: "#06b6d4" },
  { id: "errand",   label: "Errand",   color: "#f97316" },
  { id: "custom",   label: "Custom",   color: "#94a3b8" },
];

const TRAVEL_MODES: { id: TravelMode; label: string }[] = [
  { id: "car",     label: "Drive" },
  { id: "bike",    label: "Bike" },
  { id: "walk",    label: "Walk" },
  { id: "transit", label: "Transit" },
];

const MAP_STYLES = ["Road", "Satellite", "Hybrid"] as const;
type MapStyle = typeof MAP_STYLES[number];

const LS = {
  page:      "lifeos_maps_page",
  search:    "lifeos_maps_search",
  style:     "lifeos_maps_style",
  tool:      "lifeos_maps_tool",
  zoom:      "lifeos_maps_zoom",
  viewLat:   "lifeos_maps_view_lat",
  viewLng:   "lifeos_maps_view_lng",
};

const PAGE_SIZE = 50;
const TOAST_MS = 4200;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

/** Very small equirectangular projection around a viewport center. Good enough
 *  for a placeholder canvas up to city scale. Not for navigation. */
function project(
  lat: number, lng: number,
  viewLat: number, viewLng: number,
  zoom: number, width: number, height: number,
) {
  const scale = Math.pow(2, zoom) * 40; // px per degree at zoom 0 = 40
  const x = width / 2 + (lng - viewLng) * scale * Math.cos((viewLat * Math.PI) / 180);
  const y = height / 2 - (lat - viewLat) * scale;
  return { x, y };
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function MapsPanel() {
  const email = useUserEmail();
  const userId = email || "anon";

  /* ---- persisted UI state ---- */
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => lsGet<MapStyle>(LS.style, "Road"));
  const [activeTool, setActiveTool] = useState<AreaType>(() => lsGet<AreaType>(LS.tool, "radius"));
  const [zoom, setZoom] = useState<number>(() => lsGet<number>(LS.zoom, 11));
  const [viewLat, setViewLat] = useState<number>(() => lsGet<number>(LS.viewLat, 32.7767));
  const [viewLng, setViewLng] = useState<number>(() => lsGet<number>(LS.viewLng, -96.7970));
  const [page, setPage] = useState<number>(() => lsGet<number>(LS.page, 0));
  const [searchRaw, setSearchRaw] = useState<string>(() => lsGet<string>(LS.search, ""));
  const [search, setSearch] = useState(searchRaw);

  useEffect(() => lsSet(LS.style, mapStyle), [mapStyle]);
  useEffect(() => lsSet(LS.tool, activeTool), [activeTool]);
  useEffect(() => lsSet(LS.zoom, zoom), [zoom]);
  useEffect(() => lsSet(LS.viewLat, viewLat), [viewLat]);
  useEffect(() => lsSet(LS.viewLng, viewLng), [viewLng]);
  useEffect(() => lsSet(LS.page, page), [page]);
  useEffect(() => lsSet(LS.search, searchRaw), [searchRaw]);

  // 200ms debounce on search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 200);
    return () => clearTimeout(t);
  }, [searchRaw]);

  /* ---- data ---- */
  const [areas, setAreas] = useState<MapsArea[]>([]);
  const [locations, setLocations] = useState<MapsLocation[]>([]);
  const [routes, setRoutes] = useState<MapsRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  /* ---- geocode / route ---- */
  const [geocodeConfigured, setGeocodeConfigured] = useState<boolean | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<{ label: string; lat: number; lng: number }[]>([]);

  const [routeConfigured, setRouteConfigured] = useState<boolean | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<{ distance_miles: number; duration_min: number; provider: string } | null>(null);
  const [routeFrom, setRouteFrom] = useState<MapsLocation | null>(null);
  const [routeTo, setRouteTo] = useState<MapsLocation | null>(null);
  const [routeMode, setRouteMode] = useState<TravelMode>("car");

  /* ---- modals ---- */
  const [areaModal, setAreaModal] = useState<Partial<MapsArea> | null>(null);
  const [locModal, setLocModal] = useState<Partial<MapsLocation> | null>(null);
  const [savingArea, setSavingArea] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);

  /* ---- AI ---- */
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);

  /* ---- toast ---- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  /* ---- fetch with AbortController ---- */
  const abortRef = useRef<AbortController | null>(null);
  const loadAll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const [areasRes, locsRes, routesRes] = await Promise.all([
        lifeosApi<{ areas: MapsArea[] }>("/api/maps/areas", { signal: ac.signal }),
        lifeosApi<{ locations: MapsLocation[] }>("/api/maps/locations", { signal: ac.signal }),
        lifeosApi<{ routes: MapsRoute[] }>("/api/maps/routes", { signal: ac.signal }),
      ]);
      if (ac.signal.aborted) return;
      setAreas(areasRes.areas || []);
      setLocations(locsRes.locations || []);
      setRoutes(routesRes.routes || []);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Failed to load maps data");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); return () => abortRef.current?.abort(); }, [loadAll]);

  /* ---- keyboard: Esc closes modals ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (areaModal) setAreaModal(null);
        else if (locModal) setLocModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [areaModal, locModal]);

  /* ---- filtered + paginated ---- */
  const filteredAreas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.area_type.includes(q) ||
      (a.codes || []).some((c) => c.toLowerCase().includes(q)),
    );
  }, [areas, search]);

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) =>
      l.label.toLowerCase().includes(q) ||
      (l.address || "").toLowerCase().includes(q) ||
      l.category.includes(q),
    );
  }, [locations, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLocations.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedLocations = filteredLocations.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  /* ---- CRUD: areas ---- */
  const saveArea = useCallback(async () => {
    if (!areaModal) return;
    if (!areaModal.name?.trim()) { pushToast("error", "Area name is required"); return; }
    setSavingArea(true);
    try {
      const body = {
        name: areaModal.name.trim(),
        area_type: areaModal.area_type || "pin",
        color: areaModal.color || "#dc2626",
        center_lat: areaModal.center_lat ?? null,
        center_lng: areaModal.center_lng ?? null,
        radius_miles: areaModal.radius_miles ?? null,
        codes: areaModal.codes ?? [],
        polygon: areaModal.polygon ?? null,
        notes: areaModal.notes ?? null,
      };
      if (areaModal.id) {
        await lifeosApi(`/api/maps/areas/${areaModal.id}`, { method: "PATCH", body });
        pushToast("success", "Area updated");
      } else {
        await lifeosApi("/api/maps/areas", { method: "POST", body });
        pushToast("success", "Area created");
      }
      setAreaModal(null);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to save area");
    } finally {
      setSavingArea(false);
    }
  }, [areaModal, loadAll, pushToast]);

  const deleteArea = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete area "${name}"? This cannot be undone.`)) return;
    try {
      await lifeosApi(`/api/maps/areas/${id}`, { method: "DELETE" });
      pushToast("success", `Deleted "${name}"`);
      if (selectedAreaId === id) setSelectedAreaId(null);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to delete area");
    }
  }, [loadAll, pushToast, selectedAreaId]);

  /* ---- CRUD: locations ---- */
  const saveLocation = useCallback(async () => {
    if (!locModal) return;
    if (!locModal.label?.trim()) { pushToast("error", "Location label is required"); return; }
    if (locModal.lat == null || locModal.lng == null) {
      pushToast("error", "Latitude and longitude are required (use Geocode to fill)");
      return;
    }
    setSavingLoc(true);
    try {
      const body = {
        label: locModal.label.trim(),
        address: locModal.address || null,
        lat: locModal.lat,
        lng: locModal.lng,
        category: locModal.category || "custom",
        color: locModal.color || "#dc2626",
        contact_id: locModal.contact_id || null,
        notes: locModal.notes || null,
      };
      if (locModal.id) {
        await lifeosApi(`/api/maps/locations/${locModal.id}`, { method: "PATCH", body });
        pushToast("success", "Location updated");
      } else {
        await lifeosApi("/api/maps/locations", { method: "POST", body });
        pushToast("success", "Location saved");
      }
      setLocModal(null);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to save location");
    } finally {
      setSavingLoc(false);
    }
  }, [locModal, loadAll, pushToast]);

  const deleteLocation = useCallback(async (id: string, label: string) => {
    if (!confirm(`Delete location "${label}"?`)) return;
    try {
      await lifeosApi(`/api/maps/locations/${id}`, { method: "DELETE" });
      pushToast("success", `Deleted "${label}"`);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to delete location");
    }
  }, [loadAll, pushToast]);

  /* ---- geocode ---- */
  const runGeocode = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setGeocoding(true);
    setGeocodeResults([]);
    try {
      const res = await lifeosApi<{ configured: boolean; results?: { label: string; lat: number; lng: number }[] }>(
        `/api/maps/geocode?q=${encodeURIComponent(q)}`,
      );
      setGeocodeConfigured(res.configured);
      if (res.configured && res.results?.length) {
        setGeocodeResults(res.results);
        const first = res.results[0];
        setViewLat(first.lat); setViewLng(first.lng);
        pushToast("success", `Found ${res.results.length} result${res.results.length === 1 ? "" : "s"}`);
      } else if (res.configured) {
        pushToast("info", "No results for that query");
      }
    } catch (e: any) {
      pushToast("error", e?.message || "Geocode failed");
    } finally {
      setGeocoding(false);
    }
  }, [pushToast]);

  /* ---- route ---- */
  const runRoute = useCallback(async () => {
    if (!routeFrom || !routeTo) { pushToast("error", "Pick both From and To"); return; }
    if (routeFrom.lat == null || routeFrom.lng == null || routeTo.lat == null || routeTo.lng == null) {
      pushToast("error", "Both locations need coordinates"); return;
    }
    setRouteLoading(true);
    setRouteResult(null);
    try {
      const qs = new URLSearchParams({
        from_lat: String(routeFrom.lat), from_lng: String(routeFrom.lng),
        to_lat: String(routeTo.lat), to_lng: String(routeTo.lng),
        mode: routeMode,
      });
      const res = await lifeosApi<{ configured: boolean; distance_miles?: number; duration_min?: number; provider?: string }>(
        `/api/maps/route?${qs.toString()}`,
      );
      setRouteConfigured(res.configured);
      if (res.configured && res.distance_miles != null && res.duration_min != null) {
        setRouteResult({ distance_miles: res.distance_miles, duration_min: res.duration_min, provider: res.provider || "unknown" });
        pushToast("success", `Route: ${fmtNum(res.distance_miles)} mi • ${res.duration_min} min`);
        await loadAll(); // refresh history
      } else if (res.configured === false) {
        pushToast("info", "Routing not configured on Worker (set MAPS_API_KEY)");
      }
    } catch (e: any) {
      pushToast("error", e?.message || "Route request failed");
    } finally {
      setRouteLoading(false);
    }
  }, [routeFrom, routeTo, routeMode, loadAll, pushToast]);

  /* ---- AI actions ---- */
  const aiAnalyzeCoverage = useCallback(async () => {
    setAiBusy("coverage");
    setAiOutput(null);
    try {
      const summary = {
        area_count: areas.length,
        areas: areas.slice(0, 40).map((a) => ({ name: a.name, type: a.area_type, codes: a.codes, radius: a.radius_miles })),
        location_count: locations.length,
        locations: locations.slice(0, 40).map((l) => ({ label: l.label, category: l.category, address: l.address })),
      };
      const res = await invokeLLM({
        prompt:
          "You are analyzing a service-area map for a small business. " +
          "Identify gaps, overlaps, and three concrete next actions. " +
          "Be specific about which named areas or locations to add or merge. Keep it under 220 words.\n\n" +
          JSON.stringify(summary, null, 2),
      });
      setAiOutput(res.text || res.content || "(no output)");
      pushToast("success", "Coverage analysis ready");
    } catch (e: any) {
      pushToast("error", e?.message || "AI analysis failed");
    } finally {
      setAiBusy(null);
    }
  }, [areas, locations, pushToast]);

  const aiDraftAreaCopy = useCallback(async () => {
    if (!selectedAreaId) { pushToast("error", "Select an area first"); return; }
    const area = areas.find((a) => a.id === selectedAreaId);
    if (!area) return;
    setAiBusy("copy");
    setAiOutput(null);
    try {
      const res = await invokeLLM({
        prompt:
          "Write a short, professional service-area description for marketing copy " +
          "(2–3 sentences, no emojis, no hashtags). Use the area details below. " +
          "End with a single sentence inviting readers to check availability.\n\n" +
          JSON.stringify(area, null, 2),
      });
      setAiOutput(res.text || res.content || "(no output)");
      pushToast("success", "Area copy drafted");
    } catch (e: any) {
      pushToast("error", e?.message || "AI copy failed");
    } finally {
      setAiBusy(null);
    }
  }, [areas, selectedAreaId, pushToast]);

  const aiClusterLocations = useCallback(async () => {
    if (locations.length < 3) { pushToast("info", "Need at least 3 saved locations to cluster"); return; }
    setAiBusy("cluster");
    setAiOutput(null);
    try {
      const res = await invokeLLM({
        prompt:
          "Group the following saved locations into 2–5 logical clusters by geography and category. " +
          "Return ONLY valid JSON: {\"clusters\":[{\"name\":string,\"location_ids\":string[],\"why\":string}]}. " +
          "No prose outside the JSON.\n\n" +
          JSON.stringify(locations.map((l) => ({ id: l.id, label: l.label, category: l.category, lat: l.lat, lng: l.lng }))),
      });
      const raw = res.text || res.content || "";
      setAiOutput(raw);
      pushToast("success", "Cluster suggestion ready");
    } catch (e: any) {
      pushToast("error", e?.message || "AI clustering failed");
    } finally {
      setAiBusy(null);
    }
  }, [locations, pushToast]);

  /* ---- CSV export ---- */
  const exportCsv = useCallback(() => {
    const areaRows = filteredAreas.map((a) => ({
      kind: "area", id: a.id, name: a.name, type: a.area_type, color: a.color,
      center_lat: a.center_lat ?? "", center_lng: a.center_lng ?? "",
      radius_miles: a.radius_miles ?? "", codes: (a.codes || []).join("|"),
      notes: a.notes ?? "", created_at: a.created_at,
    }));
    const locRows = filteredLocations.map((l) => ({
      kind: "location", id: l.id, name: l.label, type: l.category, color: l.color,
      center_lat: l.lat ?? "", center_lng: l.lng ?? "",
      radius_miles: "", codes: "", notes: [l.address, l.notes].filter(Boolean).join(" | "),
      created_at: l.created_at,
    }));
    const rows = [...areaRows, ...locRows];
    if (!rows.length) { pushToast("info", "Nothing to export"); return; }
    downloadCsv(`lifeos-maps-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    pushToast("success", `Exported ${rows.length} rows`);
  }, [filteredAreas, filteredLocations, pushToast]);

  /* ---- clipboard ---- */
  const copyOutput = useCallback(async () => {
    if (!aiOutput) return;
    try { await navigator.clipboard.writeText(aiOutput); pushToast("success", "Copied"); }
    catch { pushToast("error", "Clipboard blocked"); }
  }, [aiOutput, pushToast]);

  /* ---- canvas dims (measured) ---- */
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 440 });
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* ---- render ---- */
  return (
    <PanelLayout
      title="Maps"
      subtitle="Service areas, zip codes, radius zones, and geolocated saved places"
      icon={<MapPin size={18} />}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAreaModal({ area_type: activeTool, color: "#dc2626" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm transition-all"
          >
            <Save size={12} /> SAVE AREA
          </button>
          <button
            onClick={loadAll}
            disabled={loading}
            title="Reload"
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* ===================== ERROR BANNER ===================== */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
            <AlertCircle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={loadAll} className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display">
              RETRY
            </button>
          </div>
        )}

        <div className="flex gap-4">
          {/* ===================== LEFT SIDEBAR ===================== */}
          <div className="w-60 shrink-0 flex flex-col gap-3">
            {/* --- Tools --- */}
            <div className="glass rounded-xl border border-white/8 p-3">
              <div className="text-[9px] font-display tracking-widest mb-2" style={{ color: "oklch(0.75 0.15 175)" }}>
                DRAWING TOOLS
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {AREA_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-display transition-colors
                      ${activeTool === t.id ? "glass-crimson text-primary" : "glass text-white/40 hover:text-white/70"}`}
                  >
                    {t.id === "pin" && <MapPin size={11} />}
                    {t.id === "radius" && <Navigation size={11} />}
                    {t.id === "zip" && <Layers size={11} />}
                    {t.id === "county" && <Eye size={11} />}
                    {t.id === "polygon" && <Crosshair size={11} />}
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[9px] text-white/30 leading-snug">
                Active tool: <span className="text-white/60 capitalize">{activeTool}</span>. New areas use this type.
              </div>
            </div>

            {/* --- Search + geocode --- */}
            <div className="glass rounded-xl border border-white/8 p-3">
              <div className="text-[9px] font-display tracking-widest mb-2" style={{ color: "oklch(0.75 0.15 175)" }}>
                SEARCH LOCATION
              </div>
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  value={searchRaw}
                  onChange={(e) => setSearchRaw(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runGeocode(searchRaw); }}
                  placeholder="City, zip, address…"
                  className="w-full h-7 pl-7 pr-2 text-[11px] rounded-lg text-white/80 placeholder:text-white/25 focus:outline-none"
                  style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
                />
              </div>
              <button
                onClick={() => runGeocode(searchRaw)}
                disabled={geocoding || !searchRaw.trim()}
                className="w-full mt-1.5 h-7 rounded-lg glass-crimson text-primary text-[10px] font-display hover:glow-crimson-sm transition-all disabled:opacity-40 flex items-center justify-center gap-1"
              >
                {geocoding ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                {geocoding ? "SEARCHING…" : "GEOCODE"}
              </button>

              {geocodeConfigured === false && (
                <div className="mt-2 text-[9px] text-amber-300/80 leading-snug flex gap-1">
                  <Info size={10} className="shrink-0 mt-0.5" />
                  <span>Geocoding not configured. Set <code>MAPS_API_KEY</code> on the Worker.</span>
                </div>
              )}
              {geocodeResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {geocodeResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { setViewLat(r.lat); setViewLng(r.lng); pushToast("info", r.label); }}
                      className="w-full text-left px-2 py-1 rounded text-[10px] text-white/70 hover:bg-white/5 truncate"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* --- Saved areas list --- */}
            <div className="glass rounded-xl border border-white/8 p-3 flex-1 min-h-[180px] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] font-display tracking-widest" style={{ color: "oklch(0.75 0.15 175)" }}>
                  SAVED AREAS
                </div>
                <button
                  onClick={() => setAreaModal({ area_type: activeTool, color: "#dc2626" })}
                  className="text-[9px] text-white/20 hover:text-primary/60 font-display"
                >
                  + NEW
                </button>
              </div>
              <div className="space-y-1.5 overflow-y-auto flex-1">
                {loading && areas.length === 0 && (
                  <div className="text-[10px] text-white/30 italic">Loading…</div>
                )}
                {!loading && areas.length === 0 && (
                  <div className="text-[10px] text-white/30 italic">No saved areas yet. Click + NEW.</div>
                )}
                {areas.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAreaId(a.id === selectedAreaId ? null : a.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                      ${selectedAreaId === a.id ? "glass-crimson" : "hover:bg-white/4"}`}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: a.color + "80", border: `1px solid ${a.color}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-white/70 truncate">{a.name}</div>
                      <div className="text-[8px] text-white/30 capitalize">{a.area_type}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteArea(a.id, a.name); }}
                      className="text-white/20 hover:text-red-400 shrink-0"
                      title="Delete area"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* --- Saved locations --- */}
            <div className="glass rounded-xl border border-white/8 p-3 flex-1 min-h-[200px] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] font-display tracking-widest" style={{ color: "oklch(0.75 0.15 175)" }}>
                  SAVED LOCATIONS
                </div>
                <button
                  onClick={() => setLocModal({ category: "custom", color: "#dc2626" })}
                  className="text-[9px] text-white/20 hover:text-primary/60 font-display"
                >
                  + ADD
                </button>
              </div>
              <div className="space-y-1.5 overflow-y-auto flex-1">
                {pagedLocations.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/4 group">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-white/70 truncate">{l.label}</div>
                      <div className="text-[8px] text-white/30 capitalize truncate">{l.category}</div>
                    </div>
                    <button
                      onClick={() => { setViewLat(l.lat ?? viewLat); setViewLng(l.lng ?? viewLng); setSelectedAreaId(null); }}
                      className="text-white/20 hover:text-primary/60 shrink-0"
                      title="Center on this"
                    >
                      <Crosshair size={9} />
                    </button>
                    <button
                      onClick={() => deleteLocation(l.id, l.label)}
                      className="text-white/20 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                ))}
                {!loading && filteredLocations.length === 0 && (
                  <div className="text-[10px] text-white/30 italic">No saved locations.</div>
                )}
              </div>
              {filteredLocations.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[9px] text-white/40">
                  <button
                    onClick={() => setPage(Math.max(0, safePage - 1))}
                    disabled={safePage === 0}
                    className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30"
                  >‹ Prev</button>
                  <span>Page {safePage + 1} of {totalPages}</span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30"
                  >Next ›</button>
                </div>
              )}
            </div>
          </div>

          {/* ===================== MAP + RIGHT COLUMN ===================== */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* --- Map canvas --- */}
            <div
              className="glass rounded-xl border overflow-hidden flex flex-col"
              style={{ minHeight: 440, borderColor: "oklch(0.55 0.22 20 / 18%)" }}
            >
              {/* toolbar */}
              <div
                className="flex items-center gap-2 px-3 py-2 border-b"
                style={{ borderColor: "oklch(0.55 0.22 20 / 12%)", background: "oklch(0.05 0 0 / 80%)" }}
              >
                <button
                  onClick={() => setZoom((z) => Math.min(18, z + 1))}
                  className="text-white/30 hover:text-white/70 p-1 rounded transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(3, z - 1))}
                  className="text-white/30 hover:text-white/70 p-1 rounded transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="text-[9px] text-white/30 ml-1">z{zoom}</span>
                <div className="flex gap-1 ml-2">
                  {MAP_STYLES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMapStyle(m)}
                      className={`text-[9px] px-2 py-0.5 rounded font-display transition-colors
                        ${mapStyle === m ? "glass-crimson text-primary" : "text-white/30 hover:text-white/60"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-2 text-[9px] text-white/25">
                  <span>{fmtNum(viewLat, 4)}, {fmtNum(viewLng, 4)}</span>
                  <button
                    onClick={() => { setViewLat(32.7767); setViewLng(-96.7970); setZoom(11); }}
                    className="hover:text-primary/60"
                    title="Reset to Dallas"
                  >
                    <Crosshair size={11} />
                  </button>
                </div>
              </div>

              {/* canvas */}
              <div
                ref={canvasRef}
                className="flex-1 relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, oklch(0.08 0 0), oklch(0.04 0 0))" }}
              >
                {/* grid */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(oklch(0.55 0.22 20 / 15%) 1px, transparent 1px), linear-gradient(90deg, oklch(0.55 0.22 20 / 15%) 1px, transparent 1px)",
                    backgroundSize: `${Math.max(20, 60 - zoom)}px ${Math.max(20, 60 - zoom)}px`,
                    backgroundPosition: `${canvasSize.w / 2}px ${canvasSize.h / 2}px`,
                  }}
                />

                {/* saved areas as overlays */}
                {areas.map((a) => {
                  if (a.center_lat == null || a.center_lng == null) return null;
                  const { x, y } = project(a.center_lat, a.center_lng, viewLat, viewLng, zoom, canvasSize.w, canvasSize.h);
                  const selected = selectedAreaId === a.id;
                  if (a.area_type === "radius" && a.radius_miles) {
                    // 1 deg lat ≈ 69 mi
                    const rPx = (a.radius_miles / 69) * Math.pow(2, zoom) * 40;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAreaId(selected ? null : a.id)}
                        className="absolute rounded-full cursor-pointer transition-all"
                        style={{
                          left: x - rPx, top: y - rPx,
                          width: rPx * 2, height: rPx * 2,
                          border: `2px solid ${a.color}`,
                          background: a.color + (selected ? "40" : "20"),
                          boxShadow: selected ? `0 0 20px ${a.color}80` : "none",
                        }}
                      />
                    );
                  }
                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAreaId(selected ? null : a.id)}
                      className="absolute cursor-pointer -translate-x-1/2 -translate-y-full"
                      style={{ left: x, top: y }}
                      title={a.name}
                    >
                      <MapPin size={selected ? 26 : 20} style={{ color: a.color, filter: selected ? `drop-shadow(0 0 6px ${a.color})` : "none" }} />
                    </div>
                  );
                })}

                {/* saved locations as small dots */}
                {locations.map((l) => {
                  if (l.lat == null || l.lng == null) return null;
                  const { x, y } = project(l.lat, l.lng, viewLat, viewLng, zoom, canvasSize.w, canvasSize.h);
                  return (
                    <div
                      key={l.id}
                      className="absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{ left: x, top: y, background: l.color, boxShadow: `0 0 6px ${l.color}` }}
                      title={l.label}
                      onClick={() => pushToast("info", `${l.label} — ${l.address || "no address"}`)}
                    />
                  );
                })}

                {/* empty state */}
                {!loading && areas.length === 0 && locations.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <MapPin size={36} className="mx-auto mb-3 text-primary/40" />
                      <div className="text-sm text-white/30 mb-1">No saved areas or locations</div>
                      <div className="text-xs" style={{ color: "oklch(0.75 0.15 175 / 60%)" }}>
                        Click SAVE AREA or + ADD to get started.
                        <br />
                        Rendering is a placeholder; wire MapLibre to swap in real tiles.
                      </div>
                    </div>
                  </div>
                )}

                {/* selected area detail card */}
                {selectedAreaId && (() => {
                  const a = areas.find((x) => x.id === selectedAreaId);
                  if (!a) return null;
                  return (
                    <div className="absolute bottom-3 left-3 right-3 glass rounded-lg border border-white/10 p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: a.color + "40", border: `1px solid ${a.color}` }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/80 truncate">{a.name}</div>
                        <div className="text-[10px] text-white/40 capitalize">
                          {a.area_type}
                          {a.radius_miles ? ` • ${a.radius_miles} mi` : ""}
                          {a.codes?.length ? ` • ${a.codes.join(", ")}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => setAreaModal({ ...a })}
                        className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => aiDraftAreaCopy()}
                        disabled={aiBusy === "copy"}
                        className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
                      >
                        {aiBusy === "copy" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        COPY
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* --- Route planner --- */}
            <div className="glass rounded-xl border border-white/8 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] font-display tracking-widest" style={{ color: "oklch(0.75 0.15 175)" }}>
                  ROUTE PLANNER
                </div>
                {routeConfigured === false && (
                  <span className="text-[9px] text-amber-300/80">Routing not configured (MAPS_API_KEY)</span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <label className="text-[10px] text-white/50 flex flex-col gap-1">
                  From
                  <select
                    value={routeFrom?.id || ""}
                    onChange={(e) => setRouteFrom(locations.find((l) => l.id === e.target.value) || null)}
                    className="h-7 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  >
                    <option value="">— select —</option>
                    {locations.filter((l) => l.lat != null && l.lng != null).map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-white/50 flex flex-col gap-1">
                  To
                  <select
                    value={routeTo?.id || ""}
                    onChange={(e) => setRouteTo(locations.find((l) => l.id === e.target.value) || null)}
                    className="h-7 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  >
                    <option value="">— select —</option>
                    {locations.filter((l) => l.lat != null && l.lng != null).map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-white/50 flex flex-col gap-1">
                  Mode
                  <select
                    value={routeMode}
                    onChange={(e) => setRouteMode(e.target.value as TravelMode)}
                    className="h-7 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  >
                    {TRAVEL_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
                <button
                  onClick={runRoute}
                  disabled={routeLoading || !routeFrom || !routeTo}
                  className="h-7 rounded-lg glass-crimson text-primary text-[10px] font-display hover:glow-crimson-sm transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  {routeLoading ? <Loader2 size={11} className="animate-spin" /> : <Navigation size={11} />}
                  {routeLoading ? "…" : "CALCULATE"}
                </button>
              </div>

              {routeResult && (
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-display text-white/90">{fmtNum(routeResult.distance_miles)} mi</div>
                    <div className="text-[9px] text-white/30">Distance</div>
                  </div>
                  <div>
                    <div className="text-lg font-display text-white/90">{routeResult.duration_min} min</div>
                    <div className="text-[9px] text-white/30">Duration</div>
                  </div>
                  <div>
                    <div className="text-lg font-display text-white/90 capitalize">{routeResult.provider}</div>
                    <div className="text-[9px] text-white/30">Provider</div>
                  </div>
                </div>
              )}
            </div>

            {/* --- Recent routes --- */}
            <div className="glass rounded-xl border border-white/8 overflow-hidden">
              <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                <div className="text-[9px] font-display tracking-widest" style={{ color: "oklch(0.75 0.15 175)" }}>
                  RECENT ROUTES
                </div>
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1 text-[9px] text-white/40 hover:text-primary font-display"
                >
                  <Download size={10} /> EXPORT CSV
                </button>
              </div>
              {routes.length === 0 ? (
                <div className="p-3 text-[10px] text-white/30 italic">
                  No routes yet. Only real provider responses are recorded.
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-40 overflow-y-auto">
                  {routes.slice(0, 20).map((r) => (
                    <div key={r.id} className="px-3 py-2 flex items-center gap-3 text-[10px]">
                      <span className="text-white/50 capitalize w-12">{r.travel_mode}</span>
                      <span className="text-white/70 flex-1 truncate">
                        {r.from_label || "?"} → {r.to_label || "?"}
                      </span>
                      <span className="text-white/40">{fmtNum(r.distance_miles)} mi</span>
                      <span className="text-white/40">{r.duration_min} min</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* --- AI actions --- */}
            <div className="glass rounded-xl border border-white/8 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] font-display tracking-widest" style={{ color: "oklch(0.75 0.15 175)" }}>
                  AI ASSIST
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={aiAnalyzeCoverage}
                    disabled={aiBusy != null || (areas.length === 0 && locations.length === 0)}
                    className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
                  >
                    {aiBusy === "coverage" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    COVERAGE
                  </button>
                  <button
                    onClick={aiClusterLocations}
                    disabled={aiBusy != null || locations.length < 3}
                    className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
                  >
                    {aiBusy === "cluster" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    CLUSTER
                  </button>
                </div>
              </div>
              {aiOutput ? (
                <>
                  <pre className="text-[10px] text-white/70 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">{aiOutput}</pre>
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={copyOutput}
                      className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                    >
                      <Copy size={10} /> COPY
                    </button>
                    <button
                      onClick={() => setAiOutput(null)}
                      className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                    >
                      <X size={10} /> CLEAR
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-white/30 italic">
                  Run COVERAGE for gap analysis, or select an area and use its COPY button to draft marketing copy.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="h-8" />
      </div>

      {/* ===================== AREA MODAL ===================== */}
      {areaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setAreaModal(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveArea(); } }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">
                {areaModal.id ? "EDIT AREA" : "NEW AREA"}
              </div>
              <button onClick={() => setAreaModal(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] text-white/50">
                Name *
                <input
                  autoFocus
                  value={areaModal.name || ""}
                  onChange={(e) => setAreaModal({ ...areaModal, name: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none focus:border-primary/40"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] text-white/50">
                  Type
                  <select
                    value={areaModal.area_type || "pin"}
                    onChange={(e) => setAreaModal({ ...areaModal, area_type: e.target.value as AreaType })}
                    className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  >
                    {AREA_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-white/50">
                  Color
                  <input
                    type="color"
                    value={areaModal.color || "#dc2626"}
                    onChange={(e) => setAreaModal({ ...areaModal, color: e.target.value })}
                    className="mt-1 w-full h-8 rounded-lg bg-white/4 border border-white/8"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] text-white/50">
                  Center Lat
                  <input
                    type="number" step="any"
                    value={areaModal.center_lat ?? ""}
                    onChange={(e) => setAreaModal({ ...areaModal, center_lat: e.target.value === "" ? null : Number(e.target.value) })}
                    className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  />
                </label>
                <label className="block text-[10px] text-white/50">
                  Center Lng
                  <input
                    type="number" step="any"
                    value={areaModal.center_lng ?? ""}
                    onChange={(e) => setAreaModal({ ...areaModal, center_lng: e.target.value === "" ? null : Number(e.target.value) })}
                    className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  />
                </label>
              </div>

              {areaModal.area_type === "radius" && (
                <label className="block text-[10px] text-white/50">
                  Radius (miles)
                  <input
                    type="number" step="any" min="0"
                    value={areaModal.radius_miles ?? ""}
                    onChange={(e) => setAreaModal({ ...areaModal, radius_miles: e.target.value === "" ? null : Number(e.target.value) })}
                    className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  />
                </label>
              )}

              {(areaModal.area_type === "zip" || areaModal.area_type === "county") && (
                <label className="block text-[10px] text-white/50">
                  {areaModal.area_type === "zip" ? "Zip codes" : "County FIPS/codes"} (comma-separated)
                  <input
                    value={(areaModal.codes || []).join(", ")}
                    onChange={(e) => setAreaModal({
                      ...areaModal,
                      codes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })}
                    className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  />
                </label>
              )}

              <label className="block text-[10px] text-white/50">
                Notes
                <textarea
                  rows={2}
                  value={areaModal.notes || ""}
                  onChange={(e) => setAreaModal({ ...areaModal, notes: e.target.value })}
                  className="mt-1 w-full px-2 py-1 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none resize-none"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setAreaModal(null)}
                className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
              >
                CANCEL
              </button>
              <button
                onClick={saveArea}
                disabled={savingArea}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display hover:glow-crimson-sm disabled:opacity-40 flex items-center gap-1"
              >
                {savingArea && <Loader2 size={11} className="animate-spin" />}
                {areaModal.id ? "UPDATE" : "CREATE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== LOCATION MODAL ===================== */}
      {locModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setLocModal(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveLocation(); } }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">
                {locModal.id ? "EDIT LOCATION" : "NEW LOCATION"}
              </div>
              <button onClick={() => setLocModal(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] text-white/50">
                Label *
                <input
                  autoFocus
                  value={locModal.label || ""}
                  onChange={(e) => setLocModal({ ...locModal, label: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none focus:border-primary/40"
                />
              </label>

              <label className="block text-[10px] text-white/50">
                Address
                <input
                  value={locModal.address || ""}
                  onChange={(e) => setLocModal({ ...locModal, address: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] text-white/50">
                  Lat *
                  <input
                    type="number" step="any"
                    value={locModal.lat ?? ""}
                    onChange={(e) => setLocModal({ ...locModal, lat: e.target.value === "" ? null : Number(e.target.value) })}
                    className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  />
                </label>
                <label className="block text-[10px] text-white/50">
                  Lng *
                  <input
                    type="number" step="any"
                    value={locModal.lng ?? ""}
                    onChange={(e) => setLocModal({ ...locModal, lng: e.target.value === "" ? null : Number(e.target.value) })}
                    className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => runGeocode(locModal.address || locModal.label || "")}
                  disabled={geocoding || (!locModal.address && !locModal.label)}
                  className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
                >
                  {geocoding ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  GEOCODE
                </button>
                {geocodeResults[0] && (
                  <button
                    onClick={() => setLocModal({ ...locModal, lat: geocodeResults[0].lat, lng: geocodeResults[0].lng, address: geocodeResults[0].label })}
                    className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display"
                  >
                    USE “{geocodeResults[0].label.slice(0, 24)}…”
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] text-white/50">
                  Category
                  <select
                    value={locModal.category || "custom"}
                    onChange={(e) => {
                      const cat = LOCATION_CATEGORIES.find((c) => c.id === e.target.value);
                      setLocModal({ ...locModal, category: e.target.value as LocationCategory, color: cat?.color || locModal.color });
                    }}
                    className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  >
                    {LOCATION_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-white/50">
                  Color
                  <input
                    type="color"
                    value={locModal.color || "#dc2626"}
                    onChange={(e) => setLocModal({ ...locModal, color: e.target.value })}
                    className="mt-1 w-full h-8 rounded-lg bg-white/4 border border-white/8"
                  />
                </label>
              </div>

              <label className="block text-[10px] text-white/50">
                Notes
                <textarea
                  rows={2}
                  value={locModal.notes || ""}
                  onChange={(e) => setLocModal({ ...locModal, notes: e.target.value })}
                  className="mt-1 w-full px-2 py-1 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none resize-none"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setLocModal(null)}
                className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
              >
                CANCEL
              </button>
              <button
                onClick={saveLocation}
                disabled={savingLoc}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display hover:glow-crimson-sm disabled:opacity-40 flex items-center gap-1"
              >
                {savingLoc && <Loader2 size={11} className="animate-spin" />}
                {locModal.id ? "UPDATE" : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TOASTS ===================== */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto glass rounded-lg border px-3 py-2 text-[11px] flex items-center gap-2 max-w-sm"
            style={{
              borderColor:
                t.kind === "error" ? "oklch(0.6 0.25 25 / 50%)"
                : t.kind === "success" ? "oklch(0.7 0.18 150 / 50%)"
                : "oklch(0.7 0.15 220 / 50%)",
            }}
          >
            {t.kind === "error" && <AlertCircle size={12} className="text-red-400 shrink-0" />}
            {t.kind === "success" && <CheckCircle size={12} className="text-green-400 shrink-0" />}
            {t.kind === "info" && <Info size={12} className="text-sky-400 shrink-0" />}
            <span className="text-white/80">{t.text}</span>
          </div>
        ))}
      </div>
    </PanelLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Shared exports                                                      */
/* ------------------------------------------------------------------ */

export const AREA_TYPES_EXPORT = AREA_TYPES;
export const LOCATION_CATEGORIES_EXPORT = LOCATION_CATEGORIES;
export const TRAVEL_MODES_EXPORT = TRAVEL_MODES;