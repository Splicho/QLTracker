import { Clock } from "@/components/icon"
import { ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { getMapEntry } from "@/lib/maps"
import type { PickupProfileMatch } from "@/lib/pickup"

function formatMatchResult(score: string | null | undefined) {
  return score?.trim() || "-"
}

function formatMatchDate(value: string | null) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function formatRatingDelta(value: number | null) {
  if (value == null || value === 0) {
    return "0"
  }

  return value > 0 ? `+${value}` : `${value}`
}

export function RecentMatchRow({
  match,
  onClick,
  trailingContent = "date",
}: {
  match: PickupProfileMatch
  onClick?: () => void
  trailingContent?: "date" | "rating-delta"
}) {
  const matchMap = getMapEntry(match.finalMapKey ?? "default")
  const ratingDelta = match.ratingDelta ?? 0
  const resultToneClassName =
    match.winnerTeam === "left"
      ? "text-blue-400"
      : match.winnerTeam === "right"
        ? "text-red-400"
        : "text-muted-foreground"
  const content = (
    <>
      <div className="relative flex h-12 items-center overflow-hidden pl-4">
        {matchMap?.image ? (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-full bg-cover bg-left bg-no-repeat opacity-60"
            style={{
              backgroundImage: `url(${matchMap.image})`,
              maskImage:
                "linear-gradient(to right, black 0%, black 62%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, black 0%, black 62%, transparent 100%)",
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
            }}
          />
        ) : null}
        <span
          className={`relative z-10 text-sm font-medium ${resultToneClassName}`}
          style={{
            textShadow:
              "0 1px 2px rgba(0, 0, 0, 0.95), 0 0 14px rgba(0, 0, 0, 0.82), 0 0 24px rgba(0, 0, 0, 0.58)",
          }}
        >
          {formatMatchResult(match.finalScore)}
        </span>
      </div>
      <div className="min-w-0 py-3">
        <p className="truncate text-sm font-medium text-foreground">
          {match.queue.name}
        </p>
      </div>
      {trailingContent === "rating-delta" ? (
        <div className="flex items-center justify-end py-3">
          <span
            className={`inline-flex min-w-[5.5rem] items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium ${
              ratingDelta > 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : ratingDelta < 0
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-sidebar-border/70 bg-muted text-muted-foreground"
            }`}
          >
            {ratingDelta > 0 ? (
              <ArrowUpRight className="size-3.5 shrink-0" />
            ) : ratingDelta < 0 ? (
              <ArrowDownLeft className="size-3.5 shrink-0" />
            ) : null}
            <span className="whitespace-nowrap">
              {formatRatingDelta(match.ratingDelta)}
            </span>
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1.5 py-3 text-sm text-muted-foreground tabular-nums">
          <Clock className="size-3.5 shrink-0" />
          <span className="whitespace-nowrap tabular-nums">
            {formatMatchDate(match.completedAt)}
          </span>
        </div>
      )}
    </>
  )

  if (onClick) {
    return (
      <button
        className="grid w-full cursor-pointer grid-cols-[96px_minmax(0,1fr)_180px] items-center gap-4 py-0 pr-4 text-left transition-colors hover:bg-muted/20"
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="grid w-full grid-cols-[96px_minmax(0,1fr)_180px] items-center gap-4 py-0 pr-4 text-left">
      {content}
    </div>
  )
}
