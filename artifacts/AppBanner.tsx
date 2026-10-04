import { useEffect, useRef, useState, type DragEvent } from "react";
import { Upload, ImageIcon } from "lucide-react";

export const BANNER_STORAGE_KEY = "lifeos_banner_url";
const STORE_KEY = "banner_url";
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

async function readComputerBanner(): Promise<string | null> {
  const res = await fetch(`/__lifeos/store?key=${STORE_KEY}`);
  if (!res.ok) return null;
  const data = await res.json();
  const url = data?.value?.url;
  return typeof url === "string" && url.startsWith("data:") ? url : null;
}

async function writeComputerBanner(dataUrl: string): Promise<void> {
  const res = await fetch("/__lifeos/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: STORE_KEY, value: { url: dataUrl } }),
  });
  if (!res.ok) throw new Error("Banner was not saved. Restart npm run dev and use http://localhost:3000.");
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

export default function AppBanner() {
  const [bannerSrc, setBannerSrc] = useState<string | null>(readStoredBanner);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    readComputerBanner()
      .then((url) => {
        if (!alive || !url) return;
        setBannerSrc(url);
        try { window.localStorage.setItem(BANNER_STORAGE_KEY, url); } catch { /* cache only */ }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const handleFile = async (file: File) => {
    try {
      const dataUrl = await compressBanner(file);
      await writeComputerBanner(dataUrl);
      setBannerSrc(dataUrl);
      try { window.localStorage.setItem(BANNER_STORAGE_KEY, dataUrl); } catch { /* cache only */ }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save that banner");
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
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Upload size={16} className="text-white/70" />
            <span className="text-xs text-white/70 font-display tracking-wider">CHANGE BANNER</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent" />
        </>
      ) : (
        <div className="w-full h-full grid-bg flex items-center justify-center gap-3 group-hover:bg-white/2 transition-colors">
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
