// Uploadable sidebar logo (top-left of the sidebar header).
// - Empty state renders the original "LifeOS" text logo unchanged, plus a subtle
//   upload hint on hover.
// - Click or drop an image to upload. Upload goes through src/lib/uploadFile.ts
//   (worker R2 -> Supabase Storage -> inline data URL fallback).
// - The resulting URL is persisted in localStorage ("lifeos_logo_url").
import React, { useCallback, useEffect, useRef, useState } from "react";
import { uploadFile } from "@/lib/uploadFile";
import { unifiedGet, unifiedSet } from "@/lib/unifiedStorage";
import { OWNER_CHANGED_EVENT } from "@/lib/owner";

// PATCH (erebus-dock-redesign): the logo URL is also saved to Supabase
// (app_settings key "logo_url", owner-scoped) so it survives lost localStorage.
const LOGO_SETTING_KEY = "logo_url";

export const LOGO_STORAGE_KEY = "lifeos_logo_url";
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const ACCEPT_ATTR = ".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

function readStoredLogo(): string | null {
  try {
    return window.localStorage.getItem(LOGO_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/** Logo URL state shared by the Sidebar header (so it can adjust collapsed layout). */
export function useSidebarLogo() {
  const [url, setUrl] = useState<string | null>(readStoredLogo);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOGO_STORAGE_KEY) setUrl(e.newValue || null);
    };
    window.addEventListener("storage", onStorage);
    // Hydrate from Supabase (remote wins); a local-only logo gets uploaded.
    let alive = true;
    const hydrate = () => {
      const local = readStoredLogo();
      unifiedGet<string | { url: string | null }>(LOGO_SETTING_KEY, { preferRemote: true })
        .then((remote) => {
          if (!alive) return;
          const remoteUrl = typeof remote === "string" ? remote : remote?.url ?? null;
          if (remoteUrl) {
            setUrl(remoteUrl);
            try { window.localStorage.setItem(LOGO_STORAGE_KEY, remoteUrl); } catch { /* ignore */ }
          } else if (local && remote === null) {
            void unifiedSet(LOGO_SETTING_KEY, { url: local });
          }
        })
        .catch(() => {});
    };
    hydrate();
    window.addEventListener(OWNER_CHANGED_EVENT, hydrate);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(OWNER_CHANGED_EVENT, hydrate);
    };
  }, []);

  const save = useCallback((next: string) => {
    // Throws if storage is unavailable/full so the caller can show an error.
    setUrl(next);
    void unifiedSet(LOGO_SETTING_KEY, { url: next });
    window.localStorage.setItem(LOGO_STORAGE_KEY, next);
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(LOGO_STORAGE_KEY);
    } catch {
      // ignore
    }
    void unifiedSet(LOGO_SETTING_KEY, { url: null });
    setUrl(null);
  }, []);

  return { url, save, clear };
}

export type SidebarLogoState = ReturnType<typeof useSidebarLogo>;

interface SidebarLogoProps {
  logo: SidebarLogoState;
  collapsed: boolean;
}

export const SidebarLogo: React.FC<SidebarLogoProps> = ({ logo, collapsed }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(t);
  }, [error]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Logo must be PNG, JPG, SVG or WebP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`Logo is ${(file.size / 1024 / 1024).toFixed(1)} MB; max is 2 MB.`);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadFile(file, "media");
      try {
        logo.save(result.url);
      } catch {
        setError("Logo uploaded but could not be saved in this browser (storage full).");
        return;
      }
      console.info(`[SidebarLogo] logo stored via ${result.source}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => {
    if (!uploading) inputRef.current?.click();
  };

  return (
    <div
      className={cn(
        "relative group flex items-center min-w-0 rounded-lg transition-colors",
        dragging && "ring-1 ring-primary/60 bg-primary/10"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void handleFile(f);
        }}
      />

      <button
        type="button"
        onClick={openPicker}
        className="flex items-center gap-1.5 min-w-0 focus:outline-none"
        title={logo.url ? "Change logo" : "Upload logo"}
        aria-label={logo.url ? "Change logo" : "Upload logo"}
        disabled={uploading}
      >
        {logo.url ? (
          <img
            src={logo.url}
            alt="Logo"
            className={cn(
              "object-contain",
              collapsed ? "h-6 max-w-[48px]" : "h-10 max-w-[170px]",
              uploading && "opacity-50"
            )}
          />
        ) : (
          <>
            <span className="font-display tracking-widest uppercase text-primary text-[11px]">
              LifeOS
            </span>
            <svg
              className={cn(
                "w-3 h-3 text-primary transition-opacity",
                uploading ? "opacity-70 animate-pulse" : "opacity-0 group-hover:opacity-60"
              )}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </>
        )}
      </button>

      {logo.url && !uploading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            logo.clear();
          }}
          className={cn(
            "absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center",
            "glass border border-primary/40 text-white/70 hover:text-white hover:bg-primary/40",
            "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          )}
          title="Remove logo"
          aria-label="Remove logo"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {uploading && logo.url && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-display tracking-widest text-white/70">
          …
        </span>
      )}

      {error && (
        <div
          role="alert"
          className="fixed z-50 top-14 left-2 max-w-[240px] px-2 py-1 rounded-md glass border border-red-500/40 text-[10px] text-red-300"
        >
          {error}
        </div>
      )}
    </div>
  );
};
