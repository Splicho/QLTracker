import { type ReactNode, useEffect, useRef, useState } from "react"
import { Crown, LoaderCircle, MapPinned } from "lucide-react"
import { Medal, Steam } from "@/components/icon"
import { PickupEmptyBackground } from "@/components/pickup/pickup-empty-background"
import { PickupLiveMatches } from "@/components/pickup/pickup-live-matches"
import { PlayerAvatar } from "@/components/pickup/player-avatar"
import { PlayerName } from "@/components/pickup/player-name"
import { PickupRecentMatches } from "@/components/pickup/pickup-recent-matches"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getCountryFlagSrc } from "@/lib/countries"
import { getMapEntry } from "@/lib/maps"
import { navigateToUrl } from "@/lib/open-url"
import type { PickupMockStage } from "@/lib/pickup-mock"
import { stripQuakeColors } from "@/lib/quake"
import { buildSteamConnectUrl } from "@/lib/server-utils"
import type {
  PickupMatchState,
  PickupMatchPlayerCard,
  PickupPlayer,
  PickupPlayerLock,
  PickupPlayerSearchResult,
  PickupPlayerState,
  PickupProfileMatch,
  PickupPublicState,
  PickupQueueSummary,
  PickupSubRequest,
} from "@/lib/pickup"

function formatCountdown(deadlineAt: string | null, nowMs = Date.now()) {
  if (!deadlineAt) {
    return "--:--"
  }

  const remainingMs = Math.max(0, new Date(deadlineAt).getTime() - nowMs)
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function formatElapsed(startedAt: string | null, nowMs: number) {
  if (!startedAt) {
    return null
  }

  const elapsedMs = Math.max(0, nowMs - new Date(startedAt).getTime())
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function getMatchJoinAddress(match: PickupMatchState) {
  if (match.server.joinAddress?.trim()) {
    return match.server.joinAddress.trim()
  }

  if (match.server.ip?.trim() && typeof match.server.port === "number") {
    return `${match.server.ip.trim()}:${match.server.port}`
  }

  return null
}

function VetoPlayerSlot({
  highlightTone,
  player,
  isActiveCaptain,
}: {
  highlightTone?: "blue" | "red" | null
  player: PickupMatchPlayerCard
  isActiveCaptain: boolean
}) {
  const highlightClasses =
    highlightTone === "blue"
      ? "border-primary/35 bg-primary/8 text-foreground opacity-100"
      : highlightTone === "red"
        ? "border-destructive/35 bg-destructive/8 text-foreground opacity-100"
        : null
  const displayRating = player.displayAfter ?? player.displayBefore
  const ratingDelta =
    player.displayAfter != null && player.displayBefore != null
      ? player.displayAfter - player.displayBefore
      : null

  return (
    <div
      className={`flex h-[4.5rem] items-center gap-3 rounded-md border px-4 transition ${
        highlightClasses
          ? highlightClasses
          : isActiveCaptain
            ? "border-primary/35 bg-primary/8 text-foreground"
            : "border-border/40 bg-card/20 text-muted-foreground opacity-40"
      }`}
    >
      <PlayerAvatar
        avatarUrl={player.avatarUrl}
        className={!isActiveCaptain && !highlightClasses ? "opacity-60" : ""}
        personaName={player.personaName}
        size="lg"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className={`truncate text-sm font-semibold ${
              highlightClasses || isActiveCaptain
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <PlayerName
              className="max-w-full"
              fallbackClassName="truncate"
              personaName={player.personaName}
            />
          </div>
          {player.isCaptain ? (
            <Crown
              className={`size-3.5 ${
                highlightTone === "red"
                  ? "text-destructive"
                  : highlightClasses || isActiveCaptain
                    ? "text-warning"
                    : "text-muted-foreground"
              }`}
            />
          ) : null}
        </div>
      </div>
      <span className="inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-md border border-sidebar-border/70 bg-muted px-2 text-xs leading-none text-muted-foreground">
        <span>{displayRating}</span>
        {ratingDelta !== null && ratingDelta !== 0 ? (
          <span
            className={
              ratingDelta > 0 ? "text-emerald-400" : "text-destructive"
            }
          >
            {ratingDelta > 0 ? `+${ratingDelta}` : ratingDelta}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function VetoTeamColumn({
  players,
  activeCaptainId,
  highlightTone,
}: {
  players: PickupMatchPlayerCard[]
  activeCaptainId: string | null
  highlightTone?: "blue" | "red" | null
}) {
  return (
    <div className="flex flex-col gap-3">
      {players.map((player) => (
        <VetoPlayerSlot
          highlightTone={highlightTone}
          isActiveCaptain={activeCaptainId === player.id}
          key={player.id}
          player={player}
        />
      ))}
    </div>
  )
}

function VetoMapCard({
  canBan,
  isBanned,
  isFinal,
  mapKey,
  onBan,
}: {
  canBan: boolean
  isBanned: boolean
  isFinal: boolean
  mapKey: string
  onBan: (mapKey: string) => void
}) {
  const map = getMapEntry(mapKey)

  return (
    <button
      className="group flex h-[4.5rem] w-full items-center gap-3 rounded-md border border-border bg-card px-2 pr-4 text-left transition hover:border-primary/50 disabled:cursor-default"
      disabled={!canBan || isBanned || isFinal}
      onClick={() => onBan(mapKey)}
      type="button"
    >
      <div className="h-[3.5rem] w-24 shrink-0 overflow-hidden rounded-md bg-muted">
        {map ? (
          <img
            alt={map.name}
            className={`h-full w-full object-cover ${isBanned ? "grayscale" : ""}`}
            src={map.image}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-semibold ${isBanned ? "text-muted-foreground" : "text-foreground"}`}
        >
          {map?.name ?? mapKey}
        </div>
      </div>
      <div className="shrink-0 text-sm font-semibold tracking-[0.16em] text-primary uppercase">
        {isFinal ? "Selected" : isBanned ? "Banned" : canBan ? "Ban" : ""}
      </div>
    </button>
  )
}

function SubstituteSearchPanel({
  onRequestSubstitute,
}: {
  onRequestSubstitute: (targetPlayerId: string) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickupPlayerSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/pickup/players/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            cache: "no-store",
          }
        )

        if (!response.ok) {
          let nextMessage = "Pickup player search failed."
          try {
            const payload = (await response.json()) as { message?: string }
            if (payload.message) {
              nextMessage = payload.message
            }
          } catch {
            // Ignore invalid search errors.
          }

          throw new Error(nextMessage)
        }

        const payload = (await response.json()) as {
          players: PickupPlayerSearchResult[]
        }
        if (!cancelled) {
          setResults(payload.players ?? [])
        }
      } catch (nextError) {
        if (!cancelled) {
          setResults([])
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Pickup player search failed."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query])

  return (
    <Card className="border-border/70 bg-card/70">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Find Substitute
          </p>
          <p className="text-sm text-muted-foreground">
            Search by player name or SteamID, then send a direct substitute
            request.
          </p>
        </div>

        <Input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search player or SteamID"
          value={query}
        />

        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Searching players...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!loading && !error && query.trim().length >= 2 && results.length === 0 ? (
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              No matching pickup players found.
            </div>
          ) : null}

          {results.map((result) => (
            <div
              className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
              key={result.id}
            >
              <PlayerAvatar
                avatarUrl={result.avatarUrl}
                personaName={result.personaName}
                size="default"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {stripQuakeColors(result.personaName).trim()}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {result.steamId}
                </p>
              </div>
              <Button
                onClick={() => onRequestSubstitute(result.id)}
                size="sm"
                type="button"
              >
                Request
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SubstitutePromptCard({
  countdownNowMs,
  request,
  description,
  title,
  children,
}: {
  countdownNowMs: number
  request: PickupSubRequest
  description?: ReactNode
  title: string
  children?: ReactNode
}) {
  const defaultDescription = (
    <p className="text-sm text-foreground">
      <span className="font-semibold">
        {stripQuakeColors(request.requester.personaName).trim()}
      </span>{" "}
      wants you to substitute into{" "}
      <span className="font-semibold">{request.queueName}</span>
      {request.finalMapKey
        ? ` on ${getMapEntry(request.finalMapKey)?.name ?? request.finalMapKey}`
        : ""}
      .
    </p>
  )

  return (
    <Card className="border-primary/25 bg-card/70">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
              {title}
            </p>
            {description ?? defaultDescription}
          </div>
          <Badge className="border-border/70" variant="outline">
            {formatCountdown(request.expiresAt, countdownNowMs)}
          </Badge>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function PickupActiveMatchLayout({
  canBan,
  countdownNowMs,
  currentPlayerId,
  incomingSubRequest,
  locationFlag,
  match,
  onCancelSubstituteRequest,
  onRequestSubstitute,
  onRespondToSubstituteRequest,
  onVetoBan,
  outgoingSubRequest,
}: {
  canBan: boolean
  countdownNowMs: number
  currentPlayerId: string | null
  incomingSubRequest: PickupSubRequest | null
  locationFlag: string | null
  match: PickupMatchState
  onCancelSubstituteRequest: () => void
  onRequestSubstitute: (targetPlayerId: string) => void
  onRespondToSubstituteRequest: (
    requestId: string,
    action: "accept" | "decline"
  ) => void
  onVetoBan: (mapKey: string) => void
  outgoingSubRequest: PickupSubRequest | null
}) {
  const [showSubstituteSearch, setShowSubstituteSearch] = useState(false)
  const isVeto = match.status === "veto"
  const isProvisioning = match.status === "provisioning"
  const isServerReady = match.status === "server_ready"
  const isLive = match.status === "live"
  const isCompleted = match.status === "completed"
  const serverJoinAddress = getMatchJoinAddress(match)
  const liveElapsed = formatElapsed(match.liveStartedAt, countdownNowMs)
  const activeCaptain =
    [...match.teams.left, ...match.teams.right].find(
      (player) => player.id === match.veto.currentCaptainPlayerId
    ) ?? null
  const activeCaptainId = isVeto ? match.veto.currentCaptainPlayerId : null
  const pendingSubRequest = match.pendingSubRequest
  const canOpenSubstituteSearch =
    (isVeto || isServerReady) &&
    !pendingSubRequest &&
    !outgoingSubRequest &&
    !incomingSubRequest
  const turnText =
    match.veto.currentCaptainPlayerId === currentPlayerId
      ? "Your turn to ban"
      : activeCaptain
        ? `${stripQuakeColors(activeCaptain.personaName).trim()}'s turn`
        : "Waiting for captain"
  const mapOrder = [...match.veto.availableMaps, ...match.veto.bannedMaps]
  const statusTitle =
    match.status === "server_ready"
      ? "Server ready"
      : match.status === "live"
        ? "Match live"
        : match.status === "completed"
          ? "Match completed"
          : "Pickup match"
  const leftHighlightTone = isCompleted
    ? match.winnerTeam === "left"
      ? "blue"
      : null
    : null
  const rightHighlightTone = isCompleted
    ? match.winnerTeam === "right"
      ? "red"
      : null
    : null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex min-h-32 items-center justify-center text-center sm:min-h-40">
        {isVeto ? (
          <div className="flex flex-col items-center">
            <p className="text-lg font-semibold text-foreground sm:text-xl">
              {pendingSubRequest
                ? "Veto paused for substitute request"
                : turnText}
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight text-primary sm:text-6xl">
              {pendingSubRequest
                ? formatCountdown(pendingSubRequest.expiresAt, countdownNowMs)
                : formatCountdown(match.veto.deadlineAt, countdownNowMs)}
            </p>
          </div>
        ) : isProvisioning ? (
          <div className="flex flex-col items-center gap-3">
            <LoaderCircle className="size-10 animate-spin text-primary" />
            <p className="text-2xl font-semibold text-foreground sm:text-3xl">
              Starting server...
            </p>
          </div>
        ) : isServerReady ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-4xl font-semibold text-foreground sm:text-6xl">
              Server Ready
            </p>
          </div>
        ) : isLive ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-4xl font-semibold text-foreground sm:text-6xl">
              Match Live
            </p>
            <p className="text-sm text-muted-foreground">
              {liveElapsed
                ? `Live for ${liveElapsed}`
                : (serverJoinAddress ?? "Server is live")}
            </p>
          </div>
        ) : isCompleted ? (
          <p className="text-4xl font-semibold text-foreground sm:text-6xl">
            Match completed
          </p>
        ) : (
          <div className="flex flex-col items-center">
            <p className="text-lg font-semibold text-foreground sm:text-xl">
              {statusTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Match #{match.id.slice(0, 8)} | Rating delta{" "}
              {match.balanceSummary?.ratingDelta ?? 0}
            </p>
          </div>
        )}
      </div>

      {incomingSubRequest && incomingSubRequest.matchId === match.id ? (
        <SubstitutePromptCard
          countdownNowMs={countdownNowMs}
          request={incomingSubRequest}
          title="Incoming Substitute Request"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() =>
                onRespondToSubstituteRequest(incomingSubRequest.id, "accept")
              }
              size="sm"
              type="button"
            >
              Accept
            </Button>
            <Button
              onClick={() =>
                onRespondToSubstituteRequest(incomingSubRequest.id, "decline")
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Decline
            </Button>
          </div>
        </SubstitutePromptCard>
      ) : null}

      {outgoingSubRequest && outgoingSubRequest.matchId === match.id ? (
        <SubstitutePromptCard
          countdownNowMs={countdownNowMs}
          description={
            <p className="text-sm text-foreground">
              Waiting for{" "}
              <span className="font-semibold">
                {stripQuakeColors(outgoingSubRequest.target.personaName).trim()}
              </span>{" "}
              to accept your substitute request for{" "}
              <span className="font-semibold">
                {outgoingSubRequest.queueName}
              </span>
              {outgoingSubRequest.finalMapKey
                ? ` on ${getMapEntry(outgoingSubRequest.finalMapKey)?.name ?? outgoingSubRequest.finalMapKey}`
                : ""}
              .
            </p>
          }
          request={outgoingSubRequest}
          title="Substitute Pending"
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Waiting for{" "}
              <span className="font-semibold text-foreground">
                {stripQuakeColors(outgoingSubRequest.target.personaName).trim()}
              </span>{" "}
              to accept.
            </p>
            <Button
              onClick={onCancelSubstituteRequest}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel Request
            </Button>
          </div>
        </SubstitutePromptCard>
      ) : null}

      {canOpenSubstituteSearch ? (
        <div className="flex justify-center">
          {!showSubstituteSearch ? (
            <Button
              onClick={() => setShowSubstituteSearch(true)}
              type="button"
              variant="outline"
            >
              Find Substitute
            </Button>
          ) : (
            <div className="w-full max-w-2xl space-y-3">
              <SubstituteSearchPanel
                onRequestSubstitute={(targetPlayerId) => {
                  onRequestSubstitute(targetPlayerId)
                  setShowSubstituteSearch(false)
                }}
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => setShowSubstituteSearch(false)}
                  type="button"
                  variant="ghost"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_minmax(22rem,30rem)_1fr]">
        <VetoTeamColumn
          activeCaptainId={activeCaptainId}
          highlightTone={leftHighlightTone}
          players={match.teams.left}
        />

        <div className="flex flex-col gap-3 self-start">
          {isVeto ? (
            mapOrder.map((mapKey) => (
              <VetoMapCard
                canBan={canBan}
                isBanned={match.veto.bannedMaps.includes(mapKey)}
                isFinal={match.finalMapKey === mapKey}
                key={mapKey}
                mapKey={mapKey}
                onBan={onVetoBan}
              />
            ))
          ) : isProvisioning && match.finalMapKey ? (
            <VetoMapCard
              canBan={false}
              isBanned={false}
              isFinal={true}
              key={match.finalMapKey}
              mapKey={match.finalMapKey}
              onBan={onVetoBan}
            />
          ) : isServerReady || isLive || isCompleted ? (
            <>
              {(isServerReady || isLive || isCompleted) && match.finalMapKey ? (
                <VetoMapCard
                  canBan={false}
                  isBanned={false}
                  isFinal={true}
                  key={match.finalMapKey}
                  mapKey={match.finalMapKey}
                  onBan={onVetoBan}
                />
              ) : null}

              {isCompleted ? (
                <>
                  <div className="flex h-[4.5rem] items-center justify-between rounded-md border border-border bg-card px-4">
                    <p className="text-sm font-semibold text-foreground">
                      Winner
                    </p>
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-2 text-xs leading-none ${
                        match.winnerTeam === "left"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : match.winnerTeam === "right"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-sidebar-border/70 bg-muted text-muted-foreground"
                      }`}
                    >
                      {match.winnerTeam === "left"
                        ? "Blue team"
                        : match.winnerTeam === "right"
                          ? "Red team"
                          : "Pending"}
                    </span>
                  </div>
                  <div className="flex h-[4.5rem] items-center justify-between rounded-md border border-border bg-card px-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Final score
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {match.finalScore ?? "Final score pending"}
                      </p>
                    </div>
                    <Badge variant="secondary">Completed</Badge>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-[4.5rem] items-center gap-3 rounded-md border border-border bg-card px-4">
                    {locationFlag ? (
                      <img
                        alt={match.server.countryName ?? "Server location"}
                        className="h-5 w-auto rounded-sm"
                        src={locationFlag}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {match.server.countryName ?? "Unknown location"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {serverJoinAddress ?? "Awaiting IP and port"}
                      </p>
                    </div>
                  </div>

                  <Button
                    className="h-12 w-full"
                    disabled={!serverJoinAddress}
                    onClick={() => {
                      if (!serverJoinAddress) {
                        return
                      }

                      navigateToUrl(buildSteamConnectUrl(serverJoinAddress))
                    }}
                  >
                    <Steam data-icon="inline-start" />
                    {isLive ? "Join live server" : "Join server"}
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex h-[4.5rem] items-center justify-between rounded-md border border-border bg-card px-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {isProvisioning ? "Provisioning match server" : statusTitle}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isProvisioning
                      ? "Waiting for server provisioning callback"
                      : serverJoinAddress
                        ? "Server is ready to join"
                        : "Match state is syncing"}
                  </p>
                </div>
                <Badge variant="secondary">
                  {match.status.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="flex h-[4.5rem] items-center gap-3 rounded-md border border-border bg-card px-4">
                {serverJoinAddress ? (
                  <Button
                    className="h-10 min-w-36"
                    onClick={() => {
                      navigateToUrl(buildSteamConnectUrl(serverJoinAddress))
                    }}
                  >
                    <Steam data-icon="inline-start" />
                    Join game
                  </Button>
                ) : (
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Awaiting server
                  </div>
                )}

                {match.finalMapKey ? (
                  <div className="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-sidebar-border/70 bg-muted px-2 text-xs leading-none text-muted-foreground">
                    {match.finalMapKey}
                  </div>
                ) : null}
              </div>

              <div className="flex h-[4.5rem] items-center gap-3 rounded-md border border-border bg-card px-4">
                <MapPinned className="size-4 text-muted-foreground" />
                {locationFlag ? (
                  <img
                    alt={match.server.countryName ?? "Server location"}
                    className="h-5 w-auto rounded-sm"
                    src={locationFlag}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {match.server.countryName ?? "Unknown location"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {serverJoinAddress ?? "Awaiting IP and port"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <VetoTeamColumn
          activeCaptainId={activeCaptainId}
          highlightTone={rightHighlightTone}
          players={match.teams.right}
        />
      </div>
    </div>
  )
}

const mockStages: PickupMockStage[] = [
  "idle",
  "queue",
  "ready_check",
  "veto",
  "provisioning",
  "server_ready",
  "live",
  "completed",
]

export function PickupPage({
  activeLock,
  guestMode,
  liveMatches,
  mockMode,
  mockStage,
  onCancelSubstituteRequest,
  onConnectWithSteam,
  onJoinQueue,
  onOpenMatch,
  onOpenPlayerProfile,
  onRequestSubstitute,
  onRespondToSubstituteRequest,
  onSetMockStage,
  onVetoBan,
  pickupAvailable,
  player,
  playerState,
  publicState,
  recentMatches,
  userLoading = false,
}: {
  activeLock?: PickupPlayerLock | null
  guestMode: boolean
  liveMatches: PickupMatchState[]
  mockMode: boolean
  mockStage: PickupMockStage
  onCancelSubstituteRequest: () => void
  onConnectWithSteam: () => void
  onJoinQueue: (queue: PickupQueueSummary) => void
  onOpenMatch: (matchId: string) => void
  onOpenPlayerProfile: (playerId: string) => void
  onRequestSubstitute: (targetPlayerId: string) => void
  onRespondToSubstituteRequest: (
    requestId: string,
    action: "accept" | "decline"
  ) => void
  onSetMockStage: (stage: PickupMockStage) => void
  onVetoBan: (mapKey: string) => void
  pickupAvailable: boolean
  player: PickupPlayer | null
  playerState: PickupPlayerState | null
  publicState: PickupPublicState | null
  recentMatches: PickupProfileMatch[]
  userLoading?: boolean
}) {
  const shouldGatePlayAction = guestMode || (!player && !userLoading)
  const activeState = playerState?.stage ?? "idle"
  const visibleActiveLock = playerState?.activeLock ?? activeLock ?? null
  const serverClockRef = useRef({
    localNowMs: 0,
    serverNowMs: 0,
  })
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now())
  const match = playerState && "match" in playerState ? playerState.match : null
  const stateServerNow = playerState?.serverNow ?? null
  const activeCaptainId = match?.veto.currentCaptainPlayerId ?? null
  const canBan =
    match &&
    player &&
    match.status === "veto" &&
    !match.pendingSubRequest &&
    activeCaptainId === player.id
  const locationFlag = match?.server.countryCode
    ? getCountryFlagSrc(match.server.countryCode)
    : null
  const showHeroBackground =
    activeState === "idle" ||
    activeState === "queue" ||
    activeState === "ready_check"
  const availableQueues = publicState?.queues ?? []
  const selectedQueue =
    (playerState?.stage === "queue"
      ? availableQueues.find((queue) => queue.id === playerState.queue.queueId)
      : null) ??
    publicState?.queue ??
    availableQueues[0] ??
    null
  const isMatchStage =
    activeState === "veto" ||
    activeState === "provisioning" ||
    activeState === "server_ready" ||
    activeState === "completed" ||
    activeState === "live"
  const pageClassName = showHeroBackground
    ? ""
    : isMatchStage
      ? "flex min-h-[calc(100vh-8rem)] flex-1 flex-col gap-6 bg-[linear-gradient(180deg,#050505_0%,#121212_100%)] p-6"
      : "flex flex-1 flex-col gap-6 p-6"
  const incomingSubRequest = playerState?.incomingSubRequest ?? null
  const outgoingSubRequest = playerState?.outgoingSubRequest ?? null

  useEffect(() => {
    const shouldTrackClock =
      Boolean(incomingSubRequest) ||
      Boolean(outgoingSubRequest) ||
      (match != null &&
        (["ready_check", "veto", "live"].includes(match.status) ||
          Boolean(match.pendingSubRequest)))

    if (!shouldTrackClock) {
      return
    }

    const nextServerNowMs = stateServerNow
      ? new Date(stateServerNow).getTime()
      : Number.NaN
    const nextLocalNowMs = Date.now()

    serverClockRef.current = {
      localNowMs: nextLocalNowMs,
      serverNowMs: Number.isFinite(nextServerNowMs)
        ? nextServerNowMs
        : nextLocalNowMs,
    }
    setCountdownNowMs(serverClockRef.current.serverNowMs)

    const intervalId = window.setInterval(() => {
      const { localNowMs, serverNowMs } = serverClockRef.current
      setCountdownNowMs(serverNowMs + (Date.now() - localNowMs))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    match,
    match?.id,
    match?.liveStartedAt,
    match?.pendingSubRequest?.expiresAt,
    match?.readyDeadlineAt,
    match?.status,
    match?.veto.deadlineAt,
    incomingSubRequest,
    outgoingSubRequest,
    stateServerNow,
  ])

  if (!pickupAvailable) {
    return (
      <div className="p-6">
        <Empty className="border border-dashed border-border bg-muted/20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Medal />
            </EmptyMedia>
            <EmptyTitle>Pickup service unavailable</EmptyTitle>
            <EmptyDescription>
              Set <code>VITE_PICKUP_API_URL</code> and{" "}
              <code>VITE_REALTIME_URL</code> to enable Steam pickup login and
              queue state.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className={pageClassName}>
      {incomingSubRequest && (!match || incomingSubRequest.matchId !== match.id) ? (
        <div className="mx-auto w-full max-w-[104rem]">
          <SubstitutePromptCard
            countdownNowMs={countdownNowMs}
            request={incomingSubRequest}
            title="Incoming Substitute Request"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() =>
                  onRespondToSubstituteRequest(incomingSubRequest.id, "accept")
                }
                size="sm"
                type="button"
              >
                Accept
              </Button>
              <Button
                onClick={() =>
                  onRespondToSubstituteRequest(incomingSubRequest.id, "decline")
                }
                size="sm"
                type="button"
                variant="outline"
              >
                Decline
              </Button>
            </div>
          </SubstitutePromptCard>
        </div>
      ) : null}

      {showHeroBackground ? (
        <>
          <PickupEmptyBackground
            activeLock={visibleActiveLock}
            guestMode={shouldGatePlayAction}
            isQueued={activeState === "queue" || activeState === "ready_check"}
            onConnectWithSteam={onConnectWithSteam}
            onJoinQueue={onJoinQueue}
            queues={availableQueues}
            selectedQueue={selectedQueue}
          />
          <div className="flex flex-1 flex-col">
            <PickupLiveMatches
              matches={liveMatches}
              onOpenMatch={onOpenMatch}
              onOpenPlayerProfile={onOpenPlayerProfile}
            />
            <PickupRecentMatches
              matches={recentMatches}
              onOpenMatch={onOpenMatch}
            />
          </div>
        </>
      ) : null}

      {mockMode ? (
        <div className="pointer-events-none fixed right-6 bottom-6 z-50">
          <Card className="pointer-events-auto w-[22rem] border-white/10 bg-black/80 py-0 text-white backdrop-blur">
            <CardContent className="flex flex-col gap-3 p-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-white/45 uppercase">
                  Mock Pickup Flow
                </p>
                <p className="mt-1 text-xs text-white/60">
                  Force the next pickup screen locally without waiting for 8
                  players.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {mockStages.map((stage) => (
                  <Button
                    className="capitalize"
                    key={stage}
                    onClick={() => onSetMockStage(stage)}
                    size="sm"
                    variant={mockStage === stage ? "default" : "outline"}
                  >
                    {stage.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {match && player && activeState !== "ready_check" ? (
        <div className="mx-auto w-full max-w-[104rem]">
          <PickupActiveMatchLayout
            canBan={!!canBan}
            countdownNowMs={countdownNowMs}
            currentPlayerId={player.id}
            incomingSubRequest={incomingSubRequest}
            locationFlag={locationFlag}
            match={match}
            onCancelSubstituteRequest={onCancelSubstituteRequest}
            onRequestSubstitute={onRequestSubstitute}
            onRespondToSubstituteRequest={onRespondToSubstituteRequest}
            onVetoBan={onVetoBan}
            outgoingSubRequest={outgoingSubRequest}
          />
        </div>
      ) : null}

      {!match && activeState !== "queue" && activeState !== "idle" ? (
        <Empty className="border border-white/10 bg-black/40 text-white">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Medal />
            </EmptyMedia>
            <EmptyTitle>Pickup state syncing</EmptyTitle>
            <EmptyDescription>
              Reconnects restore your active lobby or match automatically.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent />
        </Empty>
      ) : null}
    </div>
  )
}
