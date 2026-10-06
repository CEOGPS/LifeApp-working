import { useEffect, useRef, useState } from "react";
import { newId, type Memory } from "./memory";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Kind = "zip" | "county" | "radius" | "place";
type Area = {
  id: string;
  name: string;
  kind: Kind;
  label: string;
  lat: number;
  lng: number;
  miles: number;
  bbox: number[] | null;
  geojson: unknown;
};

const BASES = {
  streets: { label: "Streets", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "&copy; OpenStreetMap" },
  dark: { label: "Dark", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attr: "&copy; OpenStreetMap &copy; CARTO" },
  satellite: { label: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Tiles &copy; Esri" },
};
type Base = keyof typeof BASES;
const COLORS = ["#5eead4", "#4fd2ff", "#c4b5fd", "#86efac", "#fdba74"];

const KEY = "lifeos.maps.areas";

function loadAreas(): Area[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function MapsDesk(_props: { data: Memory; update: Update }) {
  const [kind, setKind] = useState<Kind>("zip");
  const [zip, setZip] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [miles, setMiles] = useState("10");
  const [center, setCenter] = useState("");
  const [place, setPlace] = useState("");
  const [title, setTitle] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [preview, setPreview] = useState<Area | null>(null);
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState(false);
  const [base, setBase] = useState<Base>("streets");
  const [showAreas, setShowAreas] = useState(true);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: any; layer: any; tiles: any } | null>(null);

  useEffect(() => { setAreas(loadAreas()); setStored(true); }, []);
  useEffect(() => { if (stored) localStorage.setItem(KEY, JSON.stringify(areas)); }, [areas, stored]);

  useEffect(() => {
    let dead = false;
    function boot() {
      const L = (window as unknown as { L?: any }).L;
      if (!L || !mapNode.current || mapRef.current) return;
      const map = L.map(mapNode.current).setView([33.749, -84.388], 10);
      mapRef.current = { map, layer: L.layerGroup().addTo(map), tiles: null };
      setReady(true);
      setTimeout(() => map.invalidateSize(), 200);
    }
    if ((window as unknown as { L?: any }).L) boot();
    else {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => { if (!dead) boot(); };
      document.body.appendChild(script);
    }
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    const view = mapRef.current;
    const L = (window as unknown as { L?: any }).L;
    if (!view || !L) return;
    if (view.tiles) view.map.removeLayer(view.tiles);
    const spec = BASES[base];
    view.tiles = L.tileLayer(spec.url, { attribution: spec.attr }).addTo(view.map);
    view.tiles.bringToBack();
  }, [base, ready]);

  useEffect(() => {
    const view = mapRef.current;
    const L = (window as unknown as { L?: any }).L;
    if (!view || !L) return;
    view.layer.clearLayers();
    if (!showAreas) return;
    const rows = preview ? [preview, ...areas.filter((row) => row.id !== preview.id)] : areas;
    const bounds: [number, number][] = [];
    for (const area of rows) {
      const color = COLORS[Math.max(0, areas.findIndex((row) => row.id === area.id))] || "#5eead4";
      const style = { color, weight: 2, fillColor: color, fillOpacity: area.id === preview?.id ? 0.28 : 0.12 };
      const popup = `<strong>${area.name.replace(/[&<>]/g, "")}</strong><br>${area.label.replace(/[&<>]/g, "")}`;
      if ((area.kind === "radius" || area.kind === "place") && area.miles > 0 && !area.geojson) {
        view.layer.addLayer(L.circle([area.lat, area.lng], { ...style, radius: area.miles * 1609.34 }).bindPopup(popup));
        bounds.push([area.lat, area.lng]);
      } else if (area.geojson) {
        const shape = L.geoJSON({ type: "Feature", geometry: area.geojson, properties: {} }, { style });
        shape.bindPopup(popup);
        shape.addTo(view.layer);
        const box = shape.getBounds();
        if (box.isValid()) bounds.push(box.getSouthWest(), box.getNorthEast());
      } else if (area.bbox && area.bbox.length === 4) {
        const [south, north, west, east] = area.bbox;
        view.layer.addLayer(L.rectangle([[south, west], [north, east]], style).bindPopup(popup));
        bounds.push([south, west], [north, east]);
      }
    }
    if (preview && bounds.length) view.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
  }, [areas, preview, ready, showAreas]);

  async function highlight() {
    setNote("Looking up the area…");
    const { locateArea } = await import("@/lib/lifeos/sync");
    const result = await locateArea({ data: { kind, zip, county, state, miles, center, place } });
    if (!result.ok) { setNote(result.error); return; }
    const area: Area = {
      id: "preview",
      name: title.trim() || (kind === "zip" ? zip : kind === "county" ? `${county} County` : kind === "place" ? place : `${miles} mi around ${center || zip}`),
      kind,
      label: result.label,
      lat: result.lat,
      lng: result.lng,
      miles: kind === "place" && !result.geojson ? 1 : result.miles,
      bbox: result.bbox,
      geojson: result.geojson,
    };
    setPreview(area);
    setNote(result.label);
  }

  function keep() {
    if (!preview) return;
    const area = { ...preview, id: newId() };
    setAreas((rows) => [area, ...rows.filter((row) => row.label !== area.label)]);
    setPreview(null);
    setNote("Saved on this computer.");
  }

  function download() {
    const blob = new Blob([JSON.stringify(areas, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lifeos-areas.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="grid min-h-[calc(100dvh-16rem)] gap-3 lg:grid-cols-[16rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="text-sm">Maps</p>
        <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">DRAW</p>
        {(["zip", "county", "place", "radius"] as Kind[]).map((item) => (
          <button key={item} type="button" className={`menu ${kind === item ? "is-on" : ""}`} onClick={() => setKind(item)}>{item === "zip" ? "Zip code" : item === "county" ? "County" : item === "place" ? "Neighborhood" : "Radius"}</button>
        ))}
        <div className="mt-3 grid gap-2">
          <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Service area name" value={title} onChange={(event) => setTitle(event.target.value)} />
          {kind === "zip" ? <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Zip code" value={zip} onChange={(event) => setZip(event.target.value)} /> : null}
          {kind === "county" || kind === "place" ? (
            <>
              {kind === "county" ? <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="County" value={county} onChange={(event) => setCounty(event.target.value)} /> : <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Neighborhood" value={place} onChange={(event) => setPlace(event.target.value)} />}
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="State" value={state} onChange={(event) => setState(event.target.value)} />
            </>
          ) : null}
          {kind === "radius" ? (
            <>
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Center or zip" value={center} onChange={(event) => setCenter(event.target.value)} />
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Miles" value={miles} onChange={(event) => setMiles(event.target.value.replace(/[^0-9.]/g, ""))} />
            </>
          ) : null}
        </div>
        <div className="mt-3 flex gap-3">
          <button type="button" className="bg-blue" onClick={() => void highlight()}>Highlight</button>
          <button type="button" className="quiet" disabled={!preview} onClick={keep}>Save</button>
        </div>
        {note ? <p className="mt-2 text-[11px] text-white/45">{note}</p> : null}
        <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">SAVED AREAS</p>
        {areas.map((area) => (
          <div key={area.id} className="flex items-center gap-2">
            <button type="button" className="menu" onClick={() => setPreview(area)}>{area.name}<span className="ml-2 text-[11px] text-white/35">{area.kind}</span><span className="block truncate text-[11px] text-white/30">{area.label}</span></button>
            <button type="button" className="link-remove" onClick={() => setAreas((rows) => rows.filter((row) => row.id !== area.id))}>Remove</button>
          </div>
        ))}
        {!areas.length ? <p className="text-[11px] text-white/35">Nothing saved yet.</p> : null}
        <div className="mt-4 flex gap-3">
          <button type="button" className="quiet" onClick={download}>Save file</button>
          <button type="button" className="quiet" onClick={() => {
            const features = areas.map((area) => ({ type: "Feature", properties: { name: area.name, kind: area.kind, label: area.label, miles: area.miles }, geometry: area.geojson || { type: "Point", coordinates: [area.lng, area.lat] } }));
            const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features }, null, 2)], { type: "application/geo+json" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "lifeos-areas.geojson";
            link.click();
            URL.revokeObjectURL(link.href);
          }}>Save map</button>
          <label className="quiet cursor-pointer">Load file
            <input type="file" accept="application/json" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                const rows = JSON.parse(text);
                if (Array.isArray(rows)) setAreas(rows);
              }).catch(() => setNote("That file is not a saved area list."));
            }} />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-white/35">Saved in this browser and as a file. Not sent to Supabase.</p>
      </aside>
      <div className="relative">
        <div className="absolute left-3 top-3 z-[500] flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px]">
          <span className="text-white/40">Map type</span>
          {(Object.keys(BASES) as Base[]).map((item) => (
            <button key={item} type="button" className={base === item ? "text-emerald-200" : "text-white/55"} onClick={() => setBase(item)}>{BASES[item].label}</button>
          ))}
          <span className="mx-1 h-3 w-px bg-white/15" />
          <span className="text-white/40">Highlight</span>
          <button type="button" className={showAreas ? "text-emerald-200" : "text-white/55"} onClick={() => setShowAreas((value) => !value)} aria-pressed={showAreas}>{showAreas ? "On" : "Off"}</button>
        </div>
        <div ref={mapNode} className="module-card overflow-hidden" style={{ height: "calc(100dvh - 16rem)", minHeight: "32rem" }} />
      </div>
    </div>
  );
}
