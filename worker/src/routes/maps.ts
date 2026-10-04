// worker/src/routes/maps.ts
// PATCH (api-key-wiring): Maps panel geocode + route via Google Maps Platform, using the
// worker secret GOOGLE_MAPS_API_KEY (or Chris's forwarded saved "google-maps" key).
//   GET /api/maps/geocode?q=...                       -> { configured, results: [{ label, lat, lng }] }
//   GET /api/maps/route?from_lat&from_lng&to_lat&to_lng&mode -> { configured, distance_miles, duration_min, provider }
// Owner only. When no key is available it answers 200 { configured: false } (what MapsPanel expects).
// The areas/locations CRUD endpoints the panel also calls are not part of this patch.
import { Router } from "itty-router";
import { requireUser } from "./ai";
import { json, serviceKey, upstream, upstreamError } from "../utils/serviceKeys";

type Env = Record<string, any>;
const router = Router();

const MODES: Record<string, string> = {
  car: "driving", drive: "driving", driving: "driving",
  walk: "walking", walking: "walking", foot: "walking",
  bike: "bicycling", bicycle: "bicycling", bicycling: "bicycling", cycling: "bicycling",
  transit: "transit", bus: "transit", train: "transit",
};

function coord(v: string | null, max: number): number | null {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

router.get("/geocode", async (request: Request, env: Env) => {
  const auth = await requireUser(request, env);
  if (!auth.ok) return json(request, env, { error: auth.error }, auth.status);
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 300);
  if (!q) return json(request, env, { error: "q required" }, 400);
  const k = serviceKey(request, env, "google-maps");
  if (!k) return json(request, env, { configured: false, results: [], error: "Set worker secret GOOGLE_MAPS_API_KEY or unlock your saved google-maps key" });
  const res = await upstream(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${encodeURIComponent(k.key)}`,
  );
  const status = res.data?.status;
  if (!res.ok || (status && status !== "OK" && status !== "ZERO_RESULTS")) {
    return json(request, env, { error: upstreamError(`Google Geocoding ${status || ""}`.trim(), res) }, 502);
  }
  const results = (res.data?.results || []).slice(0, 8).map((r: any) => ({
    label: String(r.formatted_address || ""),
    lat: Number(r.geometry?.location?.lat),
    lng: Number(r.geometry?.location?.lng),
  }));
  return json(request, env, { configured: true, results, key_source: k.source });
});

router.get("/route", async (request: Request, env: Env) => {
  const auth = await requireUser(request, env);
  if (!auth.ok) return json(request, env, { error: auth.error }, auth.status);
  const p = new URL(request.url).searchParams;
  const fLat = coord(p.get("from_lat"), 90), fLng = coord(p.get("from_lng"), 180);
  const tLat = coord(p.get("to_lat"), 90), tLng = coord(p.get("to_lng"), 180);
  if (fLat === null || fLng === null || tLat === null || tLng === null) {
    return json(request, env, { error: "from_lat, from_lng, to_lat, to_lng required" }, 400);
  }
  const mode = MODES[(p.get("mode") || "car").toLowerCase()] || "driving";
  const k = serviceKey(request, env, "google-maps");
  if (!k) return json(request, env, { configured: false, error: "Set worker secret GOOGLE_MAPS_API_KEY or unlock your saved google-maps key" });
  const res = await upstream(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${fLat},${fLng}&destination=${tLat},${tLng}&mode=${mode}&key=${encodeURIComponent(k.key)}`,
  );
  const status = res.data?.status;
  if (!res.ok || status !== "OK") {
    return json(request, env, { error: upstreamError(`Google Directions ${status || ""}`.trim(), res) }, 502);
  }
  const leg = res.data.routes?.[0]?.legs?.[0];
  const meters = Number(leg?.distance?.value || 0);
  const seconds = Number(leg?.duration?.value || 0);
  return json(request, env, {
    configured: true,
    distance_miles: Math.round((meters / 1609.344) * 10) / 10,
    duration_min: Math.round(seconds / 60),
    provider: `Google Directions (${mode})`,
    key_source: k.source,
  });
});

router.all("*", (request: Request, env: Env) => json(request, env, { error: "Not found" }, 404));

export { router as mapsRoutes };