import { useState } from "react";
import { PlayCircle, Play } from "lucide-react";

export default function YoutubePlayer() {
  const [videoUrl, setVideoUrl] = useState("");
  const [embedId, setEmbedId] = useState("");

  const extractId = (url: string) => {
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1] ?? null;
  };

  const load = () => {
    const id = extractId(videoUrl);
    if (id) setEmbedId(id);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Input */}
      <div className="flex gap-2">
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Paste YouTube URL..."
          className="flex-1 h-7 px-2 text-xs bg-white/4 border border-white/6 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
        />
        <button onClick={load} className="w-7 h-7 flex items-center justify-center rounded glass-crimson text-primary">
          <Play size={12} />
        </button>
      </div>

      {/* Player area */}
      <div className="flex-1 rounded-lg overflow-hidden bg-black/60 border border-white/6 flex items-center justify-center min-h-[120px]">
        {embedId ? (
          <iframe
            src={`https://www.youtube.com/embed/${embedId}?autoplay=0&rel=0`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="text-center">
            <PlayCircle size={28} className="mx-auto text-primary/30 mb-2" />
            <div className="text-[11px] text-white/20">Paste a YouTube URL to play</div>
          </div>
        )}
      </div>
    </div>
  );
}
