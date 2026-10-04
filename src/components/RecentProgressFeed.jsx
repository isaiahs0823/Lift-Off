import { useMemo, useState } from "react";
import { Award } from "lucide-react";
import { Card, SectionLabel } from "./ui/Kit.jsx";
import { recentProgressFeed } from "../utils/athleteRating.js";

// Compact exercise-level "you got better here" feed — reuses the same matchExerciseEntry calls
// Progression/Recap/Coach already use, never a separate interpretation of "improved."
export default function RecentProgressFeed({ state, exMap, limit = 6 }) {
  const [filter, setFilter] = useState("all"); // "all" | "prs"
  const items = useMemo(() => recentProgressFeed(state, exMap, { limit: 15 }), [state, exMap]);
  const filtered = (filter === "prs" ? items.filter((i) => i.isPR) : items).slice(0, limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <SectionLabel tone="muted">Recent Progress</SectionLabel>
        <div className="flex gap-1">
          {["all", "prs"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold ${
                filter === f ? "bg-v5-red text-white" : "bg-v5-muted text-v5-subtext hover:text-v5-text"
              }`}
            >
              {f === "all" ? "All" : "PRs"}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <Card className="text-center py-6">
          <p className="text-xs text-v5-subtext">{filter === "prs" ? "No PRs yet this window." : "Log a few more comparable sessions to see progress here."}</p>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((item) => (
            <Card key={`${item.exId}-${item.date}`} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-v5-text truncate flex items-center gap-1.5">
                  {item.name}
                  {item.isPR && <Award size={12} className="text-v5-red shrink-0" />}
                </div>
                <div className="text-xs text-v5-success font-bold truncate">{item.message}</div>
              </div>
              <div className="text-[10px] text-v5-subtext shrink-0">
                {new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
