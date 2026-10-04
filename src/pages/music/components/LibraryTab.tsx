// src/pages/music/components/LibraryTab.tsx
// IMPORT is local-only (IndexedDB + localStorage). Spinner always clears.

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Search, Loader2, Music2, Upload } from "lucide-react";
import { GENRES, type DBTrack, type DBPlaylist } from "../types";
import { TrackEntity } from "../api/entities";
import { uploadMusicFile } from "../api/music";
import { TrackRow } from "./TrackRow";
import { EmptyState } from "./EmptyState";
import { useDebouncedValue } from "../hooks/deBouncedValue";

interface Props {
  loading: boolean;
  songs: DBTrack[];
  onTrackAdded: (track: DBTrack) => void;
  playlists: DBPlaylist[];
  onRefresh: () => void;
}

export function LibraryTab({ loading, songs, onTrackAdded, playlists, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importingRef = useRef(false);
  const debouncedSearch = useDebouncedValue(search, 200);

  // Hard reset: remount / HMR / stuck prior session must never leave spinner on.
  useEffect(() => {
    importingRef.current = false;
    setImporting(false);
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return songs.filter((s) => {
      if (genreFilter && s.genre !== genreFilter) return false;
      if (!q) return true;
      return (s.title ?? "").toLowerCase().includes(q) || (s.lyrics ?? "").toLowerCase().includes(q);
    });
  }, [songs, debouncedSearch, genreFilter]);

  const openPicker = useCallback(() => {
    // Clear any stuck state before opening the dialog.
    importingRef.current = false;
    setImporting(false);
    setImportMsg(null);
    fileRef.current?.click();
  }, []);

  const handleImport = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      // Always reset the input so the same file can be re-selected later.
      if (fileRef.current) fileRef.current.value = "";
      if (!files.length) return;
      if (importingRef.current) return;

      importingRef.current = true;
      setImporting(true);
      setImportMsg(null);
      let ok = 0;
      let failed = 0;
      let lastErr = "";

      try {
        for (const file of files) {
          try {
            // 1) IndexedDB blob (no network)
            const up = await uploadMusicFile(file);
            if (!up?.url) throw new Error("Local save returned no URL");

            // 2) Metadata → localStorage (sync under the hood)
            const title = file.name.replace(/\.[^.]+$/, "") || "Untitled";
            const row = await TrackEntity.create({
              title,
              genre: "Uploaded",
              status: "ready",
              audioFileUrl: up.url,
              lyrics: "",
              playlistIds: [],
            });
            if (!row) throw new Error("Failed to save track metadata");
            onTrackAdded(row);
            ok++;
          } catch (err) {
            console.warn("[music] import failed for", file.name, err);
            failed++;
            lastErr = err instanceof Error ? err.message : "Import failed";
          }
        }
        if (ok > 0 && failed === 0) setImportMsg(`Imported ${ok}`);
        else if (ok > 0) setImportMsg(`Imported ${ok} / ${failed} failed`);
        else setImportMsg(lastErr || "Import failed");
      } finally {
        importingRef.current = false;
        setImporting(false);
      }
    },
    [onTrackAdded],
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col glass rounded-xl border border-white-8 overflow-hidden">
      <div className="p-3 border-b border-white-5 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white-30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library…"
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-85 placeholder:text-white-25 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <FilterChip active={!genreFilter} onClick={() => setGenreFilter(null)}>ALL</FilterChip>
          {GENRES.slice(0, 6).map((g) => (
            <FilterChip
              key={g}
              active={genreFilter === g}
              onClick={() => setGenreFilter(genreFilter === g ? null : g)}
            >
              {g.toUpperCase()}
            </FilterChip>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {importMsg && (
            <span className={`text-[10px] max-w-[220px] truncate ${/fail|error|timed out/i.test(importMsg) ? "text-crimson" : "text-teal"}`}>
              {importMsg}
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac"
            multiple
            className="hidden"
            onChange={handleImport}
          />
          <button
            type="button"
            onClick={openPicker}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-white-55 text-[11px] font-display tracking-wider hover:text-white-85 disabled:opacity-50 transition-colors"
          >
            {importing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            {importing ? "IMPORTING…" : "IMPORT"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-white-30" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Music2}
            title="No tracks found"
            hint="Import audio files to build your library."
          />
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((s) => (
              <TrackRow
                key={s.id}
                track={s}
                playlists={playlists}
                onPlaylistUpdated={onRefresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[10px] font-display transition-colors ${
        active ? "glass-crimson text-primary" : "glass text-white-40 hover:text-white-70"
      }`}
    >
      {children}
    </button>
  );
}