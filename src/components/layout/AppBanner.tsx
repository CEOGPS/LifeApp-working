// Restored uploadable top banner. Ported verbatim from the previous LifeOS shell
// (_snapshot_backup_20260921/lifeos1.agentzero/src/components/layout/BannerArea.tsx,
// originally mounted in AppLayout directly below the Topbar on every page).
// Renamed to AppBanner because ./BannerArea.tsx in this app is a different component.
//
// Persistence: the uploaded image is resized/re-encoded in the browser and saved
// as a data URL in localStorage ("lifeos_banner_url"), the same approach as
// SidebarLogo.tsx ("lifeos_logo_url"). It survives reloads and rebuilds, but
// localStorage is per origin, so localhost:3000 and the deployed site each keep
// their own banner. (No hosted upload: all Supabase storage buckets are private,
// so there is no permanent public URL to store.)
import { useEffect, useRef, useState, type DragEvent } from "react";
import { unifiedGet, unifiedSet } from "@/lib/unifiedStorage";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { OWNER_CHANGED_EVENT } from "@/lib/owner";

// PATCH (erebus-dock-redesign): the banner is ALSO saved to Supabase
// (public.app_settings key "banner_url", owner-scoped), so it survives lost
// localStorage and follows the owner across browsers. localStorage is a cache.
const BANNER_SETTING_KEY = "banner_url";
import { Upload, ImageIcon } from "lucide-react";

export const BANNER_STORAGE_KEY = "lifeos_banner_url";

// Keep the stored data URL well under the ~5 MB localStorage quota.
const MAX_DATA_URL_CHARS = 1_500_000;
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 640;

function readStoredBanner(): string | null {
  try {
    return window.localStorage.getItem(BANNER_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image file"));
    };
    img.src = url;
  });
}

// Downscale and JPEG-encode until the data URL fits MAX_DATA_URL_CHARS.
async function compressBanner(file: File): Promise<string> {
  const img = await loadImage(file);
  let scale = Math.min(1, MAX_WIDTH / img.naturalWidth, MAX_HEIGHT / img.naturalHeight);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.75, 0.62]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_DATA_URL_CHARS) return dataUrl;
    }
    scale *= 0.75;
  }
  throw new Error("Image is too large to store even after compression");
}

function usableBanner(url: unknown): url is string {
  return typeof url === "string" && (url.startsWith("http") || url.startsWith("data:image")) && url.length > 20;
}

async function storeBannerFile(dataUrl: string): Promise<string | null> {
  const blob = await (await fetch(dataUrl)).blob();
  const client = await getSupabaseClient();
  const path = "banner/site-banner.jpg";
  const send = () =>
    client.storage.from("lifeos-phone").upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "60",
    });
  let { error } = await send();
  if (error) {
    await client.auth.signOut({ scope: "local" });
    ({ error } = await send());
  }
  if (error) return null;
  const { data } = client.storage.from("lifeos-phone").getPublicUrl(path);
  return data.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
}

export default function AppBanner() {
  const [bannerSrc, setBannerSrc] = useState<string | null>(readStoredBanner);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Hydrate from Supabase (remote wins); upload a local-only banner once.
  useEffect(() => {
    let alive = true;
    const hydrate = () => {
      const local = readStoredBanner();
      if (usableBanner(local)) setBannerSrc(local);
      unifiedGet<{ url: string | null }>(BANNER_SETTING_KEY)
        .then((remote) => {
          if (!alive) return;
          const url = remote?.url;
          if (!usableBanner(url)) return;
          setBannerSrc(url);
          try { window.localStorage.setItem(BANNER_STORAGE_KEY, url); } catch { /* cache only */ }
        })
        .catch(() => {});
    };
    hydrate();
    window.addEventListener(OWNER_CHANGED_EVENT, hydrate);
    return () => {
      alive = false;
      window.removeEventListener(OWNER_CHANGED_EVENT, hydrate);
    };
  }, []);

  const handleFile = async (file: File) => {
    try {
      const dataUrl = await compressBanner(file);
      const hosted = await storeBannerFile(dataUrl);
      const url = hosted || dataUrl;
      setBannerSrc(url);
      try {
        window.localStorage.setItem(BANNER_STORAGE_KEY, url);
      } catch {
        /* the hosted URL is the copy that survives a refresh */
      }
      if (hosted) await unifiedSet(BANNER_SETTING_KEY, { url: hosted });
    } catch (e) {
      alert(`Could not use that banner image: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) void handleFile(file);
  };

  return (
    <div
      className={`relative h-28 shrink-0 overflow-hidden border-b border-white/5 transition-all duration-300 cursor-pointer group
        ${dragging ? "border-primary/60 bg-primary/5" : ""}
      `}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      title="Click or drag to upload banner"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {bannerSrc ? (
        <>
          <img src={bannerSrc} alt="Banner" className="w-full h-full object-cover" />
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Upload size={16} className="text-white/70" />
            <span className="text-xs text-white/70 font-display tracking-wider">CHANGE BANNER</span>
          </div>
          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent" />
        </>
      ) : (
        <div className="w-full h-full grid-bg flex items-center justify-center gap-3 group-hover:bg-white/2 transition-colors">
          {/* Crimson gradient stripe */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <ImageIcon size={18} className="text-white/15" />
          <span className="text-xs text-white/20 font-display tracking-[0.2em]">UPLOAD BANNER IMAGE</span>
          <Upload size={14} className="text-white/15" />
        </div>
      )}
    </div>
  );
}