type ScoreLevel = "Poor" | "Fair" | "Good" | "Great";

const LEVELS: { label: ScoreLevel; color: string; min: number; max: number }[] =
  [
    { label: "Poor", color: "#ef4444", min: 300, max: 579 },
    { label: "Fair", color: "#f97316", min: 580, max: 669 },
    { label: "Good", color: "#eab308", min: 670, max: 739 },
    { label: "Great", color: "#22c55e", min: 740, max: 850 },
  ];

function ScoreMeter({
  label,
  score,
  bureau,
}: {
  label: string;
  score: number | null;
  bureau: string;
}) {
  const level = score
    ? LEVELS.find((l) => score >= l.min && score <= l.max)
    : null;
  const pct = score ? ((score - 300) / (850 - 300)) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      {/* Circle meter */}
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="none"
            stroke="oklch(1 0 0 / 5%)"
            strokeWidth="6"
          />
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="none"
            stroke={level?.color ?? "oklch(0.6 0.14 230 / 30%)"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 32}`}
            strokeDashoffset={`${2 * Math.PI * 32 * (1 - pct / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-sm font-display text-white/80">
            {score ?? "--"}
          </div>
          <div
            className="text-[9px]"
            style={{ color: level?.color ?? "oklch(0.7 0 0)" }}
          >
            {level?.label ?? "N/A"}
          </div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-white/50">{label}</div>
        <div className="text-[9px] text-white/25">{bureau}</div>
      </div>
    </div>
  );
}

export default function CreditScore() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex gap-3 justify-around">
              <ScoreMeter label="FICO Score" score={632} bureau="Experian" />
              <ScoreMeter label="VantageScore" score={639} bureau="Credit Karma" />
            </div>

      {/* Scale legend */}
      <div className="flex rounded-lg overflow-hidden h-4">
        {LEVELS.map((l) => (
          <div
            key={l.label}
            className="flex-1 flex items-center justify-center"
            style={{ background: `${l.color}30` }}
          >
            <span
              className="text-[8px] font-display"
              style={{ color: l.color }}
            >
              {l.label}
            </span>
          </div>
        ))}
      </div>

      <div className="text-center text-[10px] text-white/20">
        Connect Experian & Credit Karma to pull live scores
      </div>
    </div>
  );
}
