"use client"

import { useEffect, useRef, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Spinner } from "@/components/icon"
import { PlayerAvatar } from "@/components/pickup/player-avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { PickupMatchPlayerCard, PickupMatchState } from "@/lib/pickup"
import { stripQuakeColors } from "@/lib/quake"

const fogHornSound = "/sounds/fog_horn.ogg"
const tickSound = "/sounds/tick.wav"
const readyCheckFogHornVolume = 0.15
const readyCheckTickVolume = 0.3

function playAudioClip(audio: HTMLAudioElement | null, volume: number) {
  if (!audio) {
    return
  }

  audio.currentTime = 0
  audio.volume = volume
  void audio.play().catch(() => {
    // Ignore autoplay failures.
  })
}

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

function hasDeadlineExpired(deadlineAt: string | null, nowMs: number) {
  return deadlineAt ? new Date(deadlineAt).getTime() <= nowMs : false
}

function ReadyPlayerTile({
  player,
  spinnerPlayerId,
}: {
  player: PickupMatchPlayerCard
  spinnerPlayerId: string | null
}) {
  const isReady = player.readyState === "ready"
  const shouldShowAvatarImage = !!player.avatarUrl
  const normalizedName =
    stripQuakeColors(player.personaName).trim() || "Unknown player"
  const showSpinner = !isReady && spinnerPlayerId === player.id

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-center">
          <div className="relative">
            <PlayerAvatar
              avatarUrl={shouldShowAvatarImage ? player.avatarUrl : null}
              className="rounded-md"
              fallbackClassName="rounded-md"
              personaName={player.personaName}
              size="lg"
            />
            {showSpinner ? (
              <span className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/90">
                <Spinner className="size-4 animate-spin" />
              </span>
            ) : null}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={2}>
        {normalizedName}
      </TooltipContent>
    </Tooltip>
  )
}

export function PickupReadyModal({
  currentPlayerId,
  match,
  onReadyUp,
  readyActionPending = false,
  serverNow,
}: {
  currentPlayerId: string | null
  match: PickupMatchState
  onReadyUp: () => void
  readyActionPending?: boolean
  serverNow: string
}) {
  const fogHornAudioRef = useRef<HTMLAudioElement | null>(null)
  const tickAudioRef = useRef<HTMLAudioElement | null>(null)
  const playedReadyCheckMatchIdRef = useRef<string | null>(null)
  const serverClockRef = useRef({
    localNowMs: 0,
    serverNowMs: 0,
  })
  const readyCheckCountRef = useRef<{ count: number; matchId: string | null }>({
    count: 0,
    matchId: null,
  })
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now())
  const players = [...match.teams.left, ...match.teams.right]
  const readyCount = players.filter(
    (player) => player.readyState === "ready"
  ).length
  const viewerReady = players.some(
    (player) => player.id === currentPlayerId && player.readyState === "ready"
  )
  const readyExpired = hasDeadlineExpired(match.readyDeadlineAt, countdownNowMs)
  const countdownLabel = formatCountdown(match.readyDeadlineAt, countdownNowMs)
  const spinnerPlayerId =
    players.find((player) =>
      player.id === currentPlayerId ? player.readyState !== "ready" : false
    )?.id ??
    players.find((player) => player.readyState !== "ready")?.id ??
    null

  useEffect(() => {
    const nextServerNowMs = new Date(serverNow).getTime()
    const nextLocalNowMs = Date.now()

    serverClockRef.current = {
      localNowMs: nextLocalNowMs,
      serverNowMs: Number.isFinite(nextServerNowMs)
        ? nextServerNowMs
        : nextLocalNowMs,
    }
    setCountdownNowMs(serverClockRef.current.serverNowMs)
  }, [match.id, serverNow])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const { localNowMs, serverNowMs } = serverClockRef.current
      setCountdownNowMs(serverNowMs + (Date.now() - localNowMs))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const fogHornAudio = new Audio(fogHornSound)
    fogHornAudio.preload = "auto"
    fogHornAudio.volume = readyCheckFogHornVolume
    fogHornAudioRef.current = fogHornAudio

    const tickAudio = new Audio(tickSound)
    tickAudio.preload = "auto"
    tickAudio.volume = readyCheckTickVolume
    tickAudioRef.current = tickAudio

    return () => {
      fogHornAudioRef.current = null
      tickAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (match.status !== "ready_check") {
      playedReadyCheckMatchIdRef.current = null
      return
    }

    if (playedReadyCheckMatchIdRef.current === match.id) {
      return
    }

    playedReadyCheckMatchIdRef.current = match.id
    playAudioClip(fogHornAudioRef.current, readyCheckFogHornVolume)
  }, [match.id, match.status])

  useEffect(() => {
    if (match.status !== "ready_check") {
      readyCheckCountRef.current = { count: 0, matchId: null }
      return
    }

    const previous = readyCheckCountRef.current

    if (previous.matchId !== match.id) {
      readyCheckCountRef.current = { count: readyCount, matchId: match.id }
      return
    }

    if (readyCount > previous.count) {
      playAudioClip(tickAudioRef.current, readyCheckTickVolume)
    }

    readyCheckCountRef.current = { count: readyCount, matchId: match.id }
  }, [match.id, match.status, readyCount])

  return (
    <Dialog open>
      <DialogContent
        className="max-w-5xl border-0 bg-transparent p-0 shadow-none"
        showCloseButton={false}
      >
        <div className="flex flex-col gap-8 rounded-lg bg-background px-6 py-8 sm:px-8">
          <DialogHeader className="items-center text-center sm:text-center">
            <DialogTitle className="text-3xl font-semibold tracking-[0.08em] uppercase sm:text-5xl">
              Pickup started!
            </DialogTitle>
          </DialogHeader>

          <TooltipProvider>
            <div className="flex flex-wrap justify-center gap-3">
              {players.map((queuedPlayer) => (
                <ReadyPlayerTile
                  key={queuedPlayer.id}
                  player={queuedPlayer}
                  spinnerPlayerId={spinnerPlayerId}
                />
              ))}
            </div>
          </TooltipProvider>

          <div className="flex flex-col items-center gap-4">
            <p className="text-sm font-medium text-foreground">
              {readyCount} / {players.length} players ready
            </p>
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
              {viewerReady
                ? `${countdownLabel} remaining`
                : readyExpired
                  ? "Ready check expired"
                  : `Accept within ${countdownLabel}`}
            </p>
            <Button
              className="min-w-40 gap-2"
              disabled={viewerReady || readyExpired || readyActionPending}
              onClick={onReadyUp}
              size="lg"
            >
              <ShieldCheck data-icon="inline-start" />
              {viewerReady
                ? "Ready confirmed"
                : readyExpired
                  ? "Expired"
                  : readyActionPending
                    ? "Submitting..."
                    : "Ready"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
