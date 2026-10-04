import { Share2, TrendingUp, Users, Heart, MessageCircle } from "lucide-react";

const PLATFORMS = [
  { name: "Instagram", icon: "📸", color: "from-pink-500/20 to-purple-500/20" },
  { name: "Facebook", icon: "🔵", color: "from-blue-500/20 to-blue-600/20" },
  { name: "TikTok", icon: "🎵", color: "from-cyan-500/20 to-pink-500/20" },
  { name: "Twitter/X", icon: "🐦", color: "from-sky-500/20 to-sky-600/20" },
  { name: "LinkedIn", icon: "💼", color: "from-blue-700/20 to-blue-800/20" },
  { name: "YouTube", icon: "▶️", color: "from-red-500/20 to-red-600/20" },
  { name: "Pinterest", icon: "📌", color: "from-rose-500/20 to-red-600/20" },
  { name: "Snapchat", icon: "👻", color: "from-yellow-400/20 to-amber-500/20" },
  { name: "WhatsApp", icon: "💬", color: "from-green-500/20 to-emerald-600/20" },
  { name: "Telegram", icon: "✈️", color: "from-sky-400/20 to-blue-500/20" },
  { name: "Discord", icon: "🎮", color: "from-indigo-500/20 to-indigo-700/20" },
  { name: "Threads", icon: "🧵", color: "from-purple-500/20 to-fuchsia-600/20" },
];

export default function SocialAnalytics() {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-1.5 overflow-y-auto">
        {PLATFORMS.map((p) => (
          <div
            key={p.name}
            className={`rounded-lg p-2.5 bg-gradient-to-br ${p.color} border border-white/6 hover:border-white/12 transition-colors cursor-pointer`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{p.icon}</span>
              <span className="text-[10px] text-white/60 font-medium">
                {p.name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { icon: <Users size={8} />, val: "--" },
                { icon: <Heart size={8} />, val: "--" },
                { icon: <MessageCircle size={8} />, val: "--" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-white/20 flex justify-center mb-0.5">
                    {stat.icon}
                  </div>
                  <div className="text-[10px] text-white/35">{stat.val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
