import { TrailDifficulty } from '@/data/trails';
import { getTrailDifficultyLabel } from '@/lib/trail-utils';

const difficultyStyles: Record<TrailDifficulty, { color: string; bg: string; border: string }> = {
  green: { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30" },
  blue: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  red: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
  black: { color: "text-slate-200", bg: "bg-slate-200/10", border: "border-slate-200/30" },
  "double-black": { color: "text-white", bg: "bg-white/10", border: "border-white/30" },
  unclassified: { color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/30" },
};

interface TrailDifficultyBadgeProps {
  difficulty: TrailDifficulty;
  size?: "sm" | "md";
}

export default function TrailDifficultyBadge({ difficulty, size = "sm" }: TrailDifficultyBadgeProps) {
  const s = difficultyStyles[difficulty];
  const label = getTrailDifficultyLabel(difficulty);
  const isDouble = difficulty === "double-black";

  if (size === "md") {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${s.bg} border ${s.border}`}>
        <div className="flex items-center gap-0.5">
          <div className={`w-3 h-3 rounded-full ${s.color.replace("text", "bg")}`} />
          {isDouble && <div className={`w-3 h-3 rounded-full ${s.color.replace("text", "bg")}`} />}
          {difficulty === "unclassified" && <div className="w-3 h-3 rounded-full border-2 border-slate-500" />}
        </div>
        <span className={`font-bold text-xs uppercase tracking-wider ${s.color}`}>{label}</span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.color} border ${s.border}`}>
      <span className={`w-2 h-2 rounded-full ${s.color.replace("text", "bg")}`} />
      {label}
    </span>
  );
}
