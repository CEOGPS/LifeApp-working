import type { StreamingService } from "./types";

// App / streaming links for Music Hub (iPod-like library page).
export const STREAMING_SERVICES: readonly StreamingService[] = [
  { id: "spotify", label: "Spotify", color: "#1DB954", search: (t) => `https://open.spotify.com/search/${encodeURIComponent(t)}` },
  { id: "soundcloud", label: "SoundCloud", color: "#FF5500", search: (t) => `https://soundcloud.com/search?q=${encodeURIComponent(t)}` },
  { id: "amazon", label: "Amazon Music", color: "#00A8E1", search: (t) => `https://music.amazon.com/search/${encodeURIComponent(t)}` },
  { id: "apple", label: "Apple Music", color: "#FA243C", search: (t) => `https://music.apple.com/us/search?term=${encodeURIComponent(t)}` },
  { id: "suno", label: "Suno", color: "#000000", search: (t) => `https://suno.com/search?q=${encodeURIComponent(t)}` },
] as const;

/** Top-level open-in-app links (no search term). */
export const MUSIC_APP_LINKS = [
  { id: "spotify", label: "Spotify", href: "https://open.spotify.com/", color: "#1DB954" },
  { id: "soundcloud", label: "SoundCloud", href: "https://soundcloud.com/", color: "#FF5500" },
  { id: "amazon", label: "Amazon Music", href: "https://music.amazon.com/", color: "#00A8E1" },
  { id: "apple", label: "Apple Music", href: "https://music.apple.com/", color: "#FA243C" },
  { id: "suno", label: "Suno", href: "https://suno.com/", color: "#FFFFFF" },
] as const;