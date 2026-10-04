import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { PlayCircle, Search, X, Monitor, Volume2, VolumeX, ChevronLeft, KeyRound } from "lucide-react";
// PATCH (home-page2): search uses Chris's saved "youtube" key (public.keys, decrypted in-browser
// once unlocked) with VITE_YOUTUBE_API_KEY as fallback; idle state no longer embeds a
// video-less player; suggestion rows no longer request a non-existent thumbnail.
import { useSavedKey, savedKeyLabel } from "../_lib/savedKeys";
import { ownerHeaders } from "../_lib/ownerHeaders";
import { lifeosApi } from "@/lib/api";
import { emitHomeActivity } from "../_lib/homeActivity";

interface YouTubeContextValue {
  embedSrc: string;
  setEmbedSrc: (src: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  currentVideoId: string | null;
  setCurrentVideoId: (id: string | null) => void;
}

const YouTubeContext = createContext<YouTubeContextValue | null>(null);

export function YouTubeProvider({ children }: { children: ReactNode }) {
  const [embedSrc, setEmbedSrc] = useState<string>("https://www.youtube.com/embed?autoplay=0&rel=0&modestbranding=1");
  const [isLoading, setIsLoading] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  return (
    <YouTubeContext.Provider value={{ embedSrc, setEmbedSrc, isLoading, setIsLoading, currentVideoId, setCurrentVideoId }}>
      {children}
    </YouTubeContext.Provider>
  );
}

export function useYouTube() {
  const ctx = useContext(YouTubeContext);
  if (!ctx) throw new Error("useYouTube must be used within YouTubeProvider");
  return ctx;
}

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get API key from environment
function getYouTubeApiKey(): string | null {
  // Vite exposes env vars on import.meta.env
  const env = (import.meta as ImportMeta & {
    env?: { VITE_YOUTUBE_API_KEY?: string };
  }).env;
  if (env?.VITE_YOUTUBE_API_KEY) {
    return env.VITE_YOUTUBE_API_KEY;
  }
  return null;
}

// Search YouTube using YouTube Data API v3 (requires API key)
async function searchYouTubeWithApiKey(query: string, apiKey: string): Promise<Array<{id: string, title: string, thumbnail: string, channel: string, duration: string}>> {
  if (!query.trim()) return [];
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${apiKey}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.warn("YouTube Data API error:", error?.error?.message || response.status);
      throw new Error(error.error?.message || "Search failed");
    }
    
    const data = await response.json();
    
    return data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      channel: item.snippet.channelTitle,
      duration: "" // Duration requires separate API call
    }));
  } catch (error) {
    throw error;
  }
}


/** Server-side YouTube Data API search via lifeos1-api (key stays on worker / saved vault). */
async function searchYouTubeViaWorker(query: string): Promise<Array<{id: string, title: string, thumbnail: string, channel: string, duration: string}>> {
  if (!query.trim()) return [];
  const headers = await ownerHeaders();
  const res = await lifeosApi<{ results?: Array<{ id: string; title: string; thumbnail?: string; channel?: string }> }>(
    `/api/youtube/search?q=${encodeURIComponent(query)}&max=10`,
    { headers },
  );
  const rows = Array.isArray(res?.results) ? res.results : [];
  return rows.filter((r) => r?.id).map((r) => ({
    id: r.id,
    title: r.title || "Untitled",
    thumbnail: r.thumbnail || `https://i.ytimg.com/vi/${r.id}/mqdefault.jpg`,
    channel: r.channel || "YouTube",
    duration: "",
  }));
}

// Search YouTube via Google's search suggestions API (works without API key)
// Note: This only returns search suggestions, not actual video IDs.
async function searchYouTubeSuggestions(query: string): Promise<Array<{id: string, title: string, thumbnail: string, channel: string, duration: string}>> {
  if (!query.trim()) return [];
  
  try {
    const response = await fetch(`https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}`);
    const text = await response.text();
    
    const match = text.match(/\[\[.*\]\]/);
    if (!match) return [];
    
    const suggestions = JSON.parse(match[0]);
    if (!Array.isArray(suggestions)) return [];
    
    return suggestions.slice(0, 8).map((suggestion: any, index: number) => {
      const title = Array.isArray(suggestion) ? suggestion[0] : suggestion;
      return {
        id: `suggestion-${index}-${Date.now()}`,
        title: title,
        thumbnail: `https://i.ytimg.com/vi/default/mqdefault.jpg`,
        channel: "YouTube Search",
        duration: ""
      };
    });
  } catch (error) {
    console.warn("YouTube suggestions search failed:", error);
    return [];
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function YoutubePlayer() {
  const { embedSrc, setEmbedSrc, isLoading, setIsLoading, currentVideoId, setCurrentVideoId } = useYouTube();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{id: string, title: string, thumbnail: string, channel: string, duration: string}>>([]);
  const [searching, setSearching] = useState(false);
  const savedKey = useSavedKey(["youtube"]);
  const apiKey = savedKey.key || getYouTubeApiKey();
  const useApiKey = !!apiKey;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(false);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      let results: Array<{id: string, title: string, thumbnail: string, channel: string, duration: string}> = [];
      // 1) Worker proxy (owner key / worker secret) — real playable video IDs
      try {
        results = await searchYouTubeViaWorker(query);
      } catch (e) {
        console.warn("[YouTube] worker search failed:", e);
      }
      // 2) Browser Data API key (saved unlock / VITE_*)
      if (!results.length && apiKey) {
        try {
          results = await searchYouTubeWithApiKey(query, apiKey);
        } catch (e) {
          console.warn("[YouTube] Data API search failed:", e);
        }
      }
      // 3) Suggestions fallback (titles only — click re-searches or opens YT)
      if (!results.length) {
        results = await searchYouTubeSuggestions(query);
      }
      setSearchResults(results);
    } catch (error) {
      console.warn("Search failed, falling back to suggestions:", error);
      setSearchResults(await searchYouTubeSuggestions(query));
    } finally {
      setSearching(false);
    }
  };

  const handleVideoSelect = (videoId: string) => {
    // If it's a suggestion ID (not a real video ID), try to search for it
    if (videoId.startsWith("suggestion-")) {
      // Find the title and search for it properly
      const result = searchResults.find(r => r.id === videoId);
      if (result && useApiKey) {
        // Re-search with the title to get real video ID
        setSearchQuery(result.title);
        handleSearch(result.title);
        return;
      }
      // No Data API key: suggestions carry no video id, so open the real results on YouTube.
      if (result) window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(result.title)}`, "_blank", "noopener");
      return;
    }
    setEmbedSrc(`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`);
    setCurrentVideoId(videoId);
    emitHomeActivity({
      source: "social",
      event_type: "youtube.play",
      title: `YouTube: playing ${videoId}`,
      body: null,
      payload: { videoId },
      id: `yt-${videoId}-${Date.now()}`,
    });
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    const videoId = extractVideoId(pasted);
    if (videoId) {
      handleVideoSelect(videoId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const videoId = extractVideoId(e.currentTarget.value);
      if (videoId) {
        handleVideoSelect(videoId);
      } else {
        handleSearch(e.currentTarget.value);
      }
    }
  };

  const toggleMute = () => {
    setMuted(m => !m);
  };

  const handlePiP = async () => {
    if (!iframeRef.current) return;
    try {
      if (!(document as any).pictureInPictureElement) {
        await (iframeRef.current as any).requestPictureInPicture?.();
      } else {
        await (document as any).exitPictureInPicture?.();
      }
    } catch (error) {
      console.error("PiP failed:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/20 rounded-lg border border-white/5 overflow-hidden">
      {/* Player iframe - always visible at top */}
      <div className="relative bg-black shrink-0" style={{ aspectRatio: "16 / 9", minHeight: "200px" }}>
        {currentVideoId ? (
          <iframe
            ref={iframeRef}
            key={embedSrc}
            src={embedSrc}
            className="absolute inset-0 w-full h-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/30">
            <PlayCircle size={40} className="text-primary/40" />
            <div className="text-xs">Search or paste a YouTube link below</div>
          </div>
        )}
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="animate-spin rounded-full border-3 border-primary border-t-transparent w-8 h-8" />
          </div>
        )}

        {/* API Status indicator */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${useApiKey ? "bg-green-500" : "bg-yellow-500"}`} />
          <span className="text-xs text-white-60 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
            {useApiKey ? (savedKey.key ? "Data API v3 · saved key" : "Data API v3 · env key") : "Suggestions only"}
          </span>
        </div>

        {/* Controls overlay */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
          <button
            onClick={toggleMute}
            className="p-2 rounded bg-black/60 hover:bg-black/80 text-white/70 hover:text-white transition-colors backdrop-blur-sm"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            onClick={handlePiP}
            className="p-2 rounded bg-black/60 hover:bg-black/80 text-white/70 hover:text-primary transition-colors backdrop-blur-sm"
            title="Picture-in-Picture"
            disabled={!iframeRef.current}
          >
            <Monitor size={14} />
          </button>
        </div>

        {/* Current video info */}
        {currentVideoId && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="text-xs text-white-60 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
              Playing: {currentVideoId}
            </span>
          </div>
        )}
      </div>

      {/* Search area below player */}
      <div className="flex flex-col p-3 border-t border-white/5 bg-black/10 flex-1 overflow-hidden min-h-0">
        {/* Search input */}
        <div className="flex gap-1.5 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              onPaste={handleUrlPaste}
              placeholder="Search YouTube or paste video URL..."
              className="w-full h-9 pl-10 pr-8 text-sm bg-white/4 border border-white/6 rounded-lg text-white-90 placeholder:text-white-30 focus:outline-none focus:border-primary/40"
              aria-label="Search YouTube"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSearch(searchQuery)}
            disabled={!searchQuery.trim() || searching}
            className="h-9 px-3 rounded-lg glass-crimson text-primary text-xs font-display font-medium disabled:opacity-40 shrink-0"
          >
            {searching ? "..." : "Search"}
          </button>
        </div>
        <div className="text-[10px] text-white-20 mb-1 flex items-center justify-end gap-1" data-key-status={savedKey.status}>
          <KeyRound size={9} className="opacity-60" /> {savedKeyLabel(savedKey, "Search")}
        </div>
        <div className="text-[10px] text-white-20 mb-2 text-right">
          Search uses the worker YouTube key when available — click a result to play
        </div>

        {/* Search results */}
        <div className="flex-1 overflow-y-auto">
          {searching && (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full border-2 border-primary border-t-transparent w-6 h-6" />
            </div>
          )}
          {!searching && searchResults.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center h-24 text-white-30 gap-2">
              <Search size={32} className="text-white/30" />
              <div className="text-sm">No results found</div>
              <div className="text-[10px]">Try different search terms</div>
            </div>
          )}
          {!searching && searchResults.length === 0 && !searchQuery && (
            <div className="flex flex-col items-center justify-center h-24 text-white-20 gap-2">
              <PlayCircle size={48} className="text-white/20" />
              <div className="text-sm">
                {useApiKey ? "Search YouTube - real videos will appear" : "Search YouTube or paste a video URL to play"}
              </div>
              <div className="text-[10px]">
                {useApiKey ? "Results appear here with real thumbnails" : "Results appear here (suggestions only)"}
              </div>
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleVideoSelect(result.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  {result.id.startsWith("suggestion-") ? (
                    <div className="w-16 h-9 rounded flex-shrink-0 border border-white/5 bg-white/5 flex items-center justify-center">
                      <Search size={12} className="text-white/30" />
                    </div>
                  ) : (
                    <img
                      src={result.thumbnail}
                      alt=""
                      className="w-16 h-9 rounded object-cover flex-shrink-0 border border-white/5"
                    />
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm text-white-90 truncate group-hover:text-white">{result.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white-40">{result.channel}</span>
                      {result.duration && (
                        <span className="text-xs text-white-30">{result.duration}</span>
                      )}
                      {!useApiKey && result.id.startsWith("suggestion-") && (
                        <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 rounded">Suggestion</span>
                      )}
                    </div>
                  </div>
                  <PlayCircle className="text-primary/70 group-hover:text-primary" size={18} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper with persistent context
export function YoutubePlayerWithPersistence() {
  return (
    <YouTubeProvider>
      <YoutubePlayer />
    </YouTubeProvider>
  );
}