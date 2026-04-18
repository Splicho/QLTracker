import { useEffect, useRef, useState } from "react"
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
  PickupPlayerState,
  PickupProfileMatch,
  PickupPublicState,
  PickupQueueSummary,
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

function PickupActiveMatchLayout({
  canBan,
  countdownNowMs,
  currentPlayerId,
  locationFlag,
  match,
  onVetoBan,
}: {
  canBan: boolean
  countdownNowMs: number
  currentPlayerId: string | null
  locationFlag: string | null
  match: PickupMatchState
  onVetoBan: (mapKey: string) => void
}) {
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
              {turnText}
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight text-primary sm:text-6xl">
              {formatCountdown(match.veto.deadlineAt, countdownNowMs)}
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
  onConnectWithSteam,
  onJoinQueue,
  onOpenMatch,
  onOpenPlayerProfile,
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
  onConnectWithSteam: () => void
  onJoinQueue: (queue: PickupQueueSummary) => void
  onOpenMatch: (matchId: string) => void
  onOpenPlayerProfile: (playerId: string) => void
  onSetMockStage: (stage: PickupMockStage) => void
  onReadyUp: () => void
  onVetoBan: (mapKey: string) => void
  pickupAvailable: boolean
  player: PickupPlayer | null
  playerState: PickupPlayerState | null
  publicState: PickupPublicState | null
  readyActionPending?: boolean
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
  const matchServerNow =
    playerState && "match" in playerState ? playerState.serverNow : null
  const activeCaptainId = match?.veto.currentCaptainPlayerId ?? null
  const canBan =
    match && player && match.status === "veto" && activeCaptainId === player.id
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

  useEffect(() => {
    if (!match || !["ready_check", "veto", "live"].includes(match.status)) {
      return
    }

    const nextServerNowMs = matchServerNow
      ? new Date(matchServerNow).getTime()
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
    match?.readyDeadlineAt,
    match?.status,
    match?.veto.deadlineAt,
    matchServerNow,
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
            locationFlag={locationFlag}
            match={match}
            onVetoBan={onVetoBan}
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
