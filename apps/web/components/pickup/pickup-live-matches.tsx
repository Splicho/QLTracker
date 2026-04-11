import { Eye, InfoCircle, Medal } from "@/components/icon"
import { PlayerAvatar } from "@/components/pickup/player-avatar"
import { PlayerName } from "@/components/pickup/player-name"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { getMapEntry } from "@/lib/maps"
import { navigateToUrl } from "@/lib/open-url"
import type { PickupMatchState } from "@/lib/pickup"
import { buildSteamConnectUrl } from "@/lib/server-utils"

function getMatchJoinAddress(match: PickupMatchState) {
  if (match.server.joinAddress?.trim()) {
    return match.server.joinAddress.trim()
  }

  if (match.server.ip?.trim() && typeof match.server.port === "number") {
    return `${match.server.ip.trim()}:${match.server.port}`
  }

  return null
}

export function PickupLiveMatches({
  matches,
  onOpenMatch,
  onOpenPlayerProfile,
}: {
  matches: PickupMatchState[]
  onOpenMatch: (matchId: string) => void
  onOpenPlayerProfile: (playerId: string) => void
}) {
  return (
    <section className="border-t border-border">
      <div className="border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          {matches.length > 0 ? (
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
          ) : null}
          Live Matches
        </h2>
      </div>
      {matches.length > 0 ? (
        <div className="grid items-stretch gap-4 px-6 py-6 xl:grid-cols-2">
          {matches.map((match) => {
            const map = getMapEntry(match.finalMapKey ?? "default")
            const serverJoinAddress = getMatchJoinAddress(match)
            const maxTeamSize = Math.max(
              match.teams.left.length,
              match.teams.right.length
            )

            return (
              <Card
                className="group h-full cursor-pointer overflow-hidden border-border/80 bg-card/40 py-0 transition-colors hover:border-border"
                key={match.id}
                onClick={() => onOpenMatch(match.id)}
              >
                <CardContent className="relative h-full p-0">
                  <div className="absolute inset-0">
                    {map ? (
                      <img
                        alt={map.name}
                        className="h-full w-full object-cover opacity-35 transition-opacity duration-200 group-hover:opacity-50"
                        src={map.image}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-black/50" />
                  </div>
                  <div className="relative flex h-full flex-col gap-5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-base font-semibold text-foreground">
                        {match.balanceSummary
                          ? `${match.teams.left.length}v${match.teams.right.length} CA`
                          : "Pickup Match"}
                      </h3>
                      <Badge className="rounded-md" variant="outline">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                          <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                        </span>
                        {match.status === "live" ? "Live" : "Server Ready"}
                      </Badge>
                    </div>

                    <div className="flex justify-center">
                      <div className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-sidebar/90 px-3 py-1 text-center text-sm font-semibold text-foreground">
                        {match.finalScore ? (
                          match.finalScore
                        ) : (
                          <>
                            <Spinner className="size-3.5" />
                            <span>Round in progress</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-blue-400">
                          Blue Team
                        </p>
                        <div className="space-y-2">
                          {Array.from({ length: maxTeamSize }).map(
                            (_, index) => {
                              const player = match.teams.left[index]

                              if (!player) {
                                return (
                                  <div
                                    className="h-[46px] rounded-md border border-border bg-sidebar"
                                    key={`left-empty-${match.id}-${index}`}
                                  />
                                )
                              }

                              return (
                                <button
                                  className="flex h-[46px] w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-sidebar px-2.5 py-2 text-left transition-colors hover:border-border/80 hover:bg-sidebar-accent"
                                  key={player.id}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onOpenPlayerProfile(player.steamId)
                                  }}
                                  type="button"
                                >
                                  <PlayerAvatar
                                    avatarUrl={player.avatarUrl}
                                    className="size-6"
                                    personaName={player.personaName}
                                    size="sm"
                                  />
                                  <PlayerName
                                    className="min-w-0 flex-1 text-sm font-medium text-foreground"
                                    country
                                    countryClassName="h-3 w-4 rounded-[2px]"
                                    countryCode={player.countryCode}
                                    fallbackClassName="truncate"
                                    personaName={player.personaName}
                                  />
                                  <Badge
                                    className="h-5 shrink-0 gap-1 rounded-md border-border/70 bg-muted px-1.5 text-[11px] font-semibold text-foreground"
                                    variant="outline"
                                  >
                                    <Medal className="size-3 text-amber-400" />
                                    {player.displayAfter ??
                                      player.displayBefore}
                                  </Badge>
                                </button>
                              )
                            }
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-red-400">
                          Red Team
                        </p>
                        <div className="space-y-2">
                          {Array.from({ length: maxTeamSize }).map(
                            (_, index) => {
                              const player = match.teams.right[index]

                              if (!player) {
                                return (
                                  <div
                                    className="h-[46px] rounded-md border border-border bg-sidebar"
                                    key={`right-empty-${match.id}-${index}`}
                                  />
                                )
                              }

                              return (
                                <button
                                  className="flex h-[46px] w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-sidebar px-2.5 py-2 text-left transition-colors hover:border-border/80 hover:bg-sidebar-accent"
                                  key={player.id}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    onOpenPlayerProfile(player.steamId)
                                  }}
                                  type="button"
                                >
                                  <PlayerAvatar
                                    avatarUrl={player.avatarUrl}
                                    className="size-6"
                                    personaName={player.personaName}
                                    size="sm"
                                  />
                                  <PlayerName
                                    className="min-w-0 flex-1 text-sm font-medium text-foreground"
                                    country
                                    countryClassName="h-3 w-4 rounded-[2px]"
                                    countryCode={player.countryCode}
                                    fallbackClassName="truncate"
                                    personaName={player.personaName}
                                  />
                                  <Badge
                                    className="h-5 shrink-0 gap-1 rounded-md border-border/70 bg-muted px-1.5 text-[11px] font-semibold text-foreground"
                                    variant="outline"
                                  >
                                    <Medal className="size-3 text-amber-400" />
                                    {player.displayAfter ??
                                      player.displayBefore}
                                  </Badge>
                                </button>
                              )
                            }
                          )}
                        </div>
                      </div>
                    </div>

                    <ButtonGroup className="w-full [&>*]:flex-1">
                      <Button
                        className="cursor-pointer"
                        disabled={!serverJoinAddress}
                        onClick={(event) => {
                          event.stopPropagation()

                          if (!serverJoinAddress) {
                            return
                          }

                          navigateToUrl(buildSteamConnectUrl(serverJoinAddress))
                        }}
                        type="button"
                        variant="default"
                      >
                        <Eye data-icon="inline-start" />
                        Join to spectate
                      </Button>
                      <Button
                        className="cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenMatch(match.id)
                        }}
                        type="button"
                        variant="secondary"
                      >
                        <InfoCircle data-icon="inline-start" />
                        Match info
                      </Button>
                    </ButtonGroup>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="px-6 py-6">
          <Empty className="border border-dashed border-border bg-muted/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Medal />
              </EmptyMedia>
              <EmptyTitle>No live matches right now</EmptyTitle>
              <EmptyDescription>
                Active pickup matches will show up here once the live match feed
                is wired.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </section>
  )
}
