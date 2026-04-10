import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Medal } from "@/components/icon";
import { PlayerAvatar } from "@/components/pickup/player-avatar";
import { PlayerName } from "@/components/pickup/player-name";
import { getMapEntry } from "@/lib/maps";
import {
  fetchPickupMatchDetail,
  isPickupApiConfigured,
  type PickupMatchDetail,
} from "@/lib/pickup";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingState() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="h-48 border-b border-border bg-muted/30" />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </section>
  );
}

function TeamColumn({
  players,
  title,
  toneClassName,
}: {
  players: Array<{
    displayAfter: number | null;
    displayBefore: number;
    kills: number | null;
    player: {
      avatarUrl: string | null;
      countryCode?: string | null;
      id: string;
      personaName: string;
    };
  }>;
  title: string;
  toneClassName: string;
}) {
  return (
    <div className="space-y-2">
      <p className={`text-xs font-medium ${toneClassName}`}>{title}</p>
      <div className="space-y-2">
        {players.map((entry) => (
          <div
            className="flex items-center gap-3 rounded-md border border-border bg-sidebar px-3 py-2"
            key={entry.player.id}
          >
            <PlayerAvatar
              avatarUrl={entry.player.avatarUrl}
              personaName={entry.player.personaName}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                <PlayerName
                  country
                  countryCode={entry.player.countryCode}
                  fallbackClassName="inline-block max-w-full truncate align-bottom"
                  personaName={entry.player.personaName}
                />
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{entry.kills ?? 0} K</div>
            </div>
            <Badge
              className="h-6 shrink-0 rounded-md border-border/70 bg-muted px-2 text-xs font-semibold text-foreground"
              variant="outline"
            >
              <Medal className="size-3.5 text-amber-400" />
              {entry.displayAfter ?? entry.displayBefore}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PickupMatchPage({
  initialData,
  matchId,
  onMatchTitleChange,
}: {
  initialData?: PickupMatchDetail;
  matchId: string | null;
  onMatchTitleChange?: (title: string | null) => void;
}) {
  const matchQuery = useQuery({
    queryKey: ["pickup", "match", matchId],
    queryFn: () => fetchPickupMatchDetail(matchId!),
    enabled: isPickupApiConfigured() && Boolean(matchId),
    initialData,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const title = matchQuery.data?.match.queue.name ?? null;
    onMatchTitleChange?.(title);

    return () => {
      onMatchTitleChange?.(null);
    };
  }, [matchQuery.data?.match.queue.name, onMatchTitleChange]);

  if (matchQuery.isPending) {
    return <LoadingState />;
  }

  if (!isPickupApiConfigured()) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">Match page unavailable</p>
          <p className="text-sm text-muted-foreground">
            Set <code className="font-mono">VITE_PICKUP_API_URL</code> to load match details.
          </p>
        </div>
      </div>
    );
  }

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">Match could not be loaded</p>
          <p className="text-sm text-muted-foreground">
            {matchQuery.error instanceof Error
              ? matchQuery.error.message
              : "Unexpected pickup match error."}
          </p>
        </div>
      </div>
    );
  }

  const detail = matchQuery.data;
  const map = getMapEntry(detail.match.finalMapKey ?? detail.statsSummary?.mapKey ?? "default");
  const score = detail.match.finalScore ?? (detail.statsSummary
    ? `${detail.statsSummary.blueRounds ?? 0} - ${detail.statsSummary.redRounds ?? 0}`
    : "In progress");

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative border-b border-border">
        <div className="absolute inset-0">
          {map ? (
            <img
              alt={map.name}
              className="h-full w-full object-cover opacity-35"
              src={map.image}
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.72)_0%,rgba(10,10,10,0.92)_100%)]" />
        </div>
        <div className="relative flex min-h-48 flex-col justify-end gap-4 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{detail.match.season.name}</p>
              <h1 className="text-2xl font-semibold text-foreground">
                {detail.match.queue.name}
              </h1>
            </div>
            <Badge className="rounded-md" variant="outline">
              {detail.match.status === "completed" ? "Completed" : "Live"}
            </Badge>
          </div>
          <div className="w-fit rounded-md border border-border/70 bg-sidebar/90 px-3 py-1 text-sm font-semibold text-foreground">
            {score}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <TeamColumn
          players={detail.teams.left}
          title="Blue Team"
          toneClassName="text-blue-400"
        />
        <TeamColumn
          players={detail.teams.right}
          title="Red Team"
          toneClassName="text-red-400"
        />
      </div>
    </section>
  );
}
