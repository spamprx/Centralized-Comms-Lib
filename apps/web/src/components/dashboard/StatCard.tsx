import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StatCard as StatCardModel } from "../../data/mockDashboardData";
import { Surface } from "../ui";

const iconColors: Record<string, string> = {
  content: "#8b5cf6",
  review: "#f59e0b",
  users: "#06b6d4",
  engagement: "#10b981",
};

export function StatCard({ stat }: { stat: StatCardModel }) {
  const TrendIcon =
    stat.trend === "up"
      ? TrendingUp
      : stat.trend === "down"
        ? TrendingDown
        : Minus;
  const trendColor =
    stat.trend === "up"
      ? "text-emerald-400"
      : stat.trend === "down"
        ? "text-red-400"
        : "text-app-faint";
  const accent = iconColors[stat.icon] ?? "#937cf8";

  return (
    <Surface
      padding="sm"
      className="group/card relative min-w-[200px] flex-1 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-app-glow"
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-90"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover/card:opacity-40"
        style={{ background: accent }}
      />
      <div className="relative mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-app-faint">
          {stat.label}
        </span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-app-md ring-1 ring-white/10 transition-transform duration-300 group-hover/card:scale-105"
          style={{
            background: `${accent}28`,
            color: accent,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            {stat.icon === "content" && (
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            )}
            {stat.icon === "review" && (
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            )}
            {stat.icon === "users" && (
              <>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </>
            )}
            {stat.icon === "engagement" && (
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            )}
          </svg>
        </div>
      </div>
      <div className="relative mb-1 text-2xl font-bold tracking-tight text-app-text md:text-[1.65rem]">
        {stat.value}
      </div>
      <div className={`relative flex items-center gap-1.5 text-xs ${trendColor}`}>
        <TrendIcon size={12} aria-hidden className="shrink-0" />
        <span>
          {stat.change > 0 ? "+" : ""}
          {stat.change.toFixed(1)}% from last month
        </span>
      </div>
    </Surface>
  );
}

export function StatCardsRow({ statCards }: { statCards: StatCardModel[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map((stat, i) => (
        <StatCard key={i} stat={stat} />
      ))}
    </div>
  );
}
