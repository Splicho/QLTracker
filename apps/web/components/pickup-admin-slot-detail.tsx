"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"

import {
  Button,
  Chip,
  Input,
  Modal,
  Spinner,
  toast,
  useOverlayState,
} from "@/components/pickup-admin-ui"
import { requestJson } from "@/lib/client/request-json"
import type {
  SlotEvent,
  SlotEventsResponse,
  SlotMetadata,
  SlotPlayer,
  SlotState,
  SlotsResponse,
} from "@/lib/client/pickup-admin-types"
import { navigateToUrl } from "@/lib/open-url"
import { buildSteamConnectUrl } from "@/lib/server-utils"

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function statusColor(state: SlotState["state"]) {
  switch (state) {
    case "idle":
      return "default" as const
    case "provisioning":
      return "warning" as const
    case "busy":
      return "success" as const
  }
}

function eventColor(type: string) {
  if (type.startsWith("ADMIN_")) return "text-amber-300"
  if (type.includes("KILL") || type.includes("DEATH")) return "text-red-400"
  if (type === "CHAT") return "text-green-400"
  if (type.includes("MATCH") || type.includes("ROUND")) return "text-accent"
  if (type.includes("CONNECT") || type.includes("DISCONNECT"))
    return "text-white/40"
  return "text-white/60"
}

function formatEventLine(event: SlotEvent): string {
  const data = event.data as Record<string, unknown>

  switch (event.type) {
    case "PLAYER_CONNECT":
      return `${data.NAME ?? "unknown"} connected`
    case "PLAYER_DISCONNECT":
      return `${data.NAME ?? "unknown"} disconnected`
    case "PLAYER_KILL": {
      const killer = data.KILLER as Record<string, unknown> | undefined
      const victim = data.VICTIM as Record<string, unknown> | undefined
      return `${killer?.NAME ?? "?"} killed ${victim?.NAME ?? "?"}`
    }
    case "PLAYER_DEATH": {
      const victim = data.VICTIM as Record<string, unknown> | undefined
      return `${victim?.NAME ?? "?"} died`
    }
    case "MATCH_STARTED":
      return `Match started on ${data.MAP ?? "unknown"} (${data.GAME_TYPE ?? ""})`
    case "MATCH_REPORT":
      return `Match ended${data.ABORTED ? " (aborted)" : ""}`
    case "ROUND_OVER":
      return `Round over`
    case "PLAYER_SWITCHTEAM": {
      const player = data.PLAYER as Record<string, unknown> | undefined
      return `${player?.NAME ?? data.NAME ?? "?"} switched to ${player?.TEAM ?? data.TEAM ?? "?"}`
    }
    case "CHAT":
      return `${data.NAME ?? "?"}: ${data.MESSAGE ?? ""}`
    case "PLAYER_STATS":
      return `Stats for ${data.NAME ?? "?"}`
    case "ADMIN_SAY":
      return `Admin broadcast: ${data.MESSAGE ?? ""}`
    case "ADMIN_COMMAND":
      return `Executed command: ${data.COMMAND ?? ""}`
    case "ADMIN_KICK":
      return `Kicked ${data.NAME ?? data.STEAM_ID ?? "player"}`
    case "ADMIN_BAN":
      return `Banned ${data.NAME ?? data.STEAM_ID ?? "player"}`
    default:
      return event.type
  }
}

function teamColor(team: string) {
  switch (team.toLowerCase()) {
    case "red":
      return "text-red-400"
    case "blue":
      return "text-blue-400"
    default:
      return "text-white/40"
  }
}

function normalizeLiveFeedError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Could not fetch live slot events."

  if (
    message.includes("Cannot GET /api/admin/slots/") ||
    message.includes("<!DOCTYPE html>")
  ) {
    return "Live slot events are unavailable on the running provisioner build."
  }

  return message
}

function ConsolePanel({
  events,
  errorMessage,
}: {
  events: SlotEvent[]
  errorMessage: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  useEffect(() => {
    const el = containerRef.current
    if (el && shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [events])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    shouldAutoScroll.current = nearBottom
  }

  return (
    <div
      ref={containerRef}
      className="h-[420px] overflow-y-auto rounded-2xl border border-white/10 bg-[#080808] p-3 font-mono text-xs leading-relaxed"
      onScroll={handleScroll}
    >
      {errorMessage && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
          {errorMessage}
        </div>
      )}
      {events.length === 0 && !errorMessage && (
        <p className="text-white/30">Waiting for live server events...</p>
      )}
      {events.map((event, i) => (
        <div
          key={`${event.timestamp}-${i}`}
          className={`${eventColor(event.type)}`}
        >
          <span className="text-white/25">[{formatTime(event.timestamp)}]</span>{" "}
          <span className="font-semibold">{event.type}</span>{" "}
          {formatEventLine(event)}
        </div>
      ))}
    </div>
  )
}

function PlayerRow({
  player,
  pendingAction,
  onKick,
  onBan,
}: {
  player: SlotPlayer
  pendingAction: string | null
  onKick: (steamId: string) => void
  onBan: (steamId: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{player.name}</p>
        <p className="font-mono text-xs text-white/30">{player.steamId}</p>
      </div>
      <span
        className={`text-xs font-semibold uppercase ${teamColor(player.team)}`}
      >
        {player.team}
      </span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          isDisabled={pendingAction !== null}
          onPress={() => onKick(player.steamId)}
        >
          Kick
        </Button>
        <Button
          size="sm"
          variant="danger"
          isDisabled={pendingAction !== null}
          onPress={() => onBan(player.steamId)}
        >
          Ban
        </Button>
      </div>
    </div>
  )
}

function MetadataSection({
  slot,
  slotId,
}: {
  slot: SlotState | null
  slotId: number
}) {
  const [metadata, setMetadata] = useState<SlotMetadata | null>(null)
  const activePickupMatchId =
    slot &&
    slot.state !== "idle" &&
    slot.matchId &&
    slot.queueId &&
    !slot.matchId.startsWith("manual-")
      ? slot.matchId
      : null

  useEffect(() => {
    if (!activePickupMatchId) {
      return
    }

    let isCancelled = false
    requestJson<SlotMetadata>(`/api/pickup/admin/servers/${slotId}/metadata`)
      .then((nextMetadata) => {
        if (!isCancelled && nextMetadata.matchId === activePickupMatchId) {
          setMetadata(nextMetadata)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setMetadata(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [activePickupMatchId, slotId])

  const visibleMetadata =
    metadata?.matchId === activePickupMatchId ? metadata : null

  if (!visibleMetadata) return null

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0d0d0d] p-5">
      <h3 className="mb-3 text-sm font-semibold tracking-[0.18em] text-white/40 uppercase">
        Match Metadata
      </h3>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="text-xs text-white/40">Map</span>
          <p className="text-white">{visibleMetadata.finalMapKey}</p>
        </div>
        <div>
          <span className="text-xs text-white/40">Match ID</span>
          <p className="font-mono text-xs text-white/70">
            {visibleMetadata.matchId}
          </p>
        </div>
        <div>
          <span className="text-xs text-white/40">Queue</span>
          <p className="text-white">{visibleMetadata.queueId}</p>
        </div>
        <div>
          <span className="text-xs text-white/40">Season</span>
          <p className="text-white">{visibleMetadata.seasonId}</p>
        </div>
        {visibleMetadata.teams.red.length > 0 && (
          <div className="sm:col-span-2">
            <span className="text-xs text-red-400">Red Team</span>
            <p className="text-white/80">
              {visibleMetadata.teams.red.map((p) => p.personaName).join(", ")}
            </p>
          </div>
        )}
        {visibleMetadata.teams.blue.length > 0 && (
          <div className="sm:col-span-2">
            <span className="text-xs text-blue-400">Blue Team</span>
            <p className="text-white/80">
              {visibleMetadata.teams.blue.map((p) => p.personaName).join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function PickupAdminSlotDetail({ slotId }: { slotId: number }) {
  const [slot, setSlot] = useState<SlotState | null>(null)
  const [events, setEvents] = useState<SlotEvent[]>([])
  const [players, setPlayers] = useState<SlotPlayer[]>([])
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [sayInput, setSayInput] = useState("")
  const [cmdInput, setCmdInput] = useState("")
  const lastTimestamp = useRef<string | undefined>(undefined)
  const stopModal = useOverlayState()
  const confirmTarget = useRef<{
    action: string
    steamId: string
    name: string
  } | null>(null)
  const confirmModal = useOverlayState()

  // Poll slot status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await requestJson<SlotsResponse>(
          "/api/pickup/admin/servers"
        )
        const found = data.slots.find((s) => s.slotId === slotId) ?? null
        setSlot(found)
      } catch {
        // Ignore
      } finally {
        setIsLoading(false)
      }
    }

    void fetchStatus()
    const interval = setInterval(() => void fetchStatus(), 5000)
    return () => clearInterval(interval)
  }, [slotId])

  // Poll events
  useEffect(() => {
    if (!slot || slot.state === "idle") {
      setEventsError(null)
      return
    }

    const fetchEvents = async () => {
      try {
        const since = lastTimestamp.current
        const data = await requestJson<SlotEventsResponse>(
          `/api/pickup/admin/servers/${slotId}/events${since ? `?since=${encodeURIComponent(since)}` : ""}`
        )

        if (data.events.length > 0) {
          setEvents((prev) => {
            const merged = [...prev, ...data.events]
            return merged.length > 500 ? merged.slice(-500) : merged
          })
          lastTimestamp.current = data.events[data.events.length - 1]!.timestamp
        }

        setPlayers(data.players)
        setEventsError(null)
      } catch (error) {
        setEventsError(normalizeLiveFeedError(error))
      }
    }

    void fetchEvents()
    const interval = setInterval(() => void fetchEvents(), 2000)
    return () => clearInterval(interval)
  }, [slot, slotId, slot?.state])

  const appendLocalAdminEvent = useCallback(
    (type: string, data: Record<string, unknown>) => {
      setEvents((prev) => {
        const next = [
          ...prev,
          {
            type,
            data,
            timestamp: new Date().toISOString(),
          },
        ]

        return next.length > 500 ? next.slice(-500) : next
      })
    },
    []
  )

  const sendCommand = useCallback(
    async (action: string, target?: string, message?: string) => {
      setPendingAction(action)
      try {
        await requestJson(`/api/pickup/admin/servers/${slotId}/command`, {
          method: "POST",
          body: JSON.stringify({ action, target, message }),
        })
        const player = target
          ? players.find((entry) => entry.steamId === target)
          : null

        if (action === "say" && message) {
          appendLocalAdminEvent("ADMIN_SAY", { MESSAGE: message })
        } else if (action === "cmd" && message) {
          appendLocalAdminEvent("ADMIN_COMMAND", { COMMAND: message })
        } else if (action === "kick" && target) {
          appendLocalAdminEvent("ADMIN_KICK", {
            NAME: player?.name ?? null,
            STEAM_ID: target,
          })
        } else if (action === "ban" && target) {
          appendLocalAdminEvent("ADMIN_BAN", {
            NAME: player?.name ?? null,
            STEAM_ID: target,
          })
        }

        toast.success(`Command "${action}" sent.`)
      } catch (err) {
        toast.danger("Command failed.", {
          description: err instanceof Error ? err.message : "Request failed.",
        })
      } finally {
        setPendingAction(null)
      }
    },
    [appendLocalAdminEvent, players, slotId]
  )

  const handleSay = () => {
    if (!sayInput.trim()) return
    void sendCommand("say", undefined, sayInput.trim())
    setSayInput("")
  }

  const handleCmd = () => {
    if (!cmdInput.trim()) return
    void sendCommand("cmd", undefined, cmdInput.trim())
    setCmdInput("")
  }

  const openKickConfirm = (steamId: string) => {
    const player = players.find((p) => p.steamId === steamId)
    confirmTarget.current = {
      action: "kick",
      steamId,
      name: player?.name ?? steamId,
    }
    confirmModal.open()
  }

  const openBanConfirm = (steamId: string) => {
    const player = players.find((p) => p.steamId === steamId)
    confirmTarget.current = {
      action: "ban",
      steamId,
      name: player?.name ?? steamId,
    }
    confirmModal.open()
  }

  const executeConfirmedAction = async () => {
    if (!confirmTarget.current) return
    const { action, steamId } = confirmTarget.current
    confirmModal.close()
    await sendCommand(action, steamId)
  }

  const confirmStop = async () => {
    setPendingAction("stop")
    try {
      await requestJson(`/api/pickup/admin/servers/${slotId}/stop`, {
        method: "POST",
      })
      toast.success(`Server on Slot ${slotId} stopped.`)
      stopModal.close()
      setEvents([])
      setEventsError(null)
      setPlayers([])
      lastTimestamp.current = undefined
    } catch (err) {
      toast.danger("Failed to stop server.", {
        description: err instanceof Error ? err.message : "Request failed.",
      })
    } finally {
      setPendingAction(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-6 py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  const isActive = slot && slot.state !== "idle"
  const joinUrl =
    isActive && slot.joinAddress ? buildSteamConnectUrl(slot.joinAddress) : null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-10 text-white">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
            href="/admin/servers"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="14"
              viewBox="0 0 24 24"
              width="14"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 19l-7-7 7-7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            Servers
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-medium">Slot {slotId}</h1>
              <span className="text-sm text-white/40">
                :{slot?.gamePort ?? "?"}
              </span>
              {slot && (
                <Chip color={statusColor(slot.state)} variant="soft">
                  {slot.state}
                </Chip>
              )}
            </div>
            {slot && slot.state !== "idle" && (
              <p className="mt-0.5 text-xs text-white/40">
                Updated {timeAgo(slot.updatedAt)}
              </p>
            )}
          </div>
        </div>
        {isActive && (
          <div className="flex items-center gap-2">
            {joinUrl && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => navigateToUrl(joinUrl)}
              >
                Join Server
              </Button>
            )}
            <Button variant="danger" size="sm" onPress={stopModal.open}>
              Stop Server
            </Button>
          </div>
        )}
      </header>

      {!isActive && (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/55">
          This slot is idle. Go back to{" "}
          <Link className="text-accent underline" href="/admin/servers">
            Servers
          </Link>{" "}
          to start a server.
        </div>
      )}

      {isActive && (
        <>
          {/* Console + Players */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <div className="mb-2">
                <h2 className="text-sm font-semibold tracking-[0.18em] text-white/40 uppercase">
                  Live Events
                </h2>
              </div>
              <ConsolePanel events={events} errorMessage={eventsError} />
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold tracking-[0.18em] text-white/40 uppercase">
                Players ({players.length})
              </h2>
              <div className="flex h-[420px] flex-col gap-1.5 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0d] p-3">
                {players.length === 0 && (
                  <p className="py-4 text-center text-xs text-white/30">
                    No players connected
                  </p>
                )}
                {players.map((player) => (
                  <PlayerRow
                    key={player.steamId}
                    player={player}
                    pendingAction={pendingAction}
                    onKick={openKickConfirm}
                    onBan={openBanConfirm}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Command bar */}
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-[#0d0d0d] p-4 sm:grid-cols-2">
            <div className="flex gap-2">
              <Input
                placeholder="Say something to all players..."
                value={sayInput}
                variant="secondary"
                onChange={(e) => setSayInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSay()
                }}
              />
              <Button
                variant="primary"
                size="sm"
                isDisabled={!sayInput.trim() || pendingAction !== null}
                onPress={handleSay}
              >
                Say
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Raw console command..."
                value={cmdInput}
                variant="secondary"
                onChange={(e) => setCmdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCmd()
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                isDisabled={!cmdInput.trim() || pendingAction !== null}
                onPress={handleCmd}
              >
                Execute
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <MetadataSection slot={slot} slotId={slotId} />
        </>
      )}

      {/* Stop confirmation modal */}
      <Modal state={stopModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-white/10 px-6 py-4">
                <div>
                  <Modal.Heading className="text-xl font-medium">
                    Stop Server
                  </Modal.Heading>
                  <p className="mt-1 text-sm text-white/60">
                    This will immediately kill the game server on Slot {slotId}.
                  </p>
                </div>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-white/70">
                  Are you sure? Any active match will be terminated and players
                  will be disconnected immediately.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                <Button variant="secondary" onPress={stopModal.close}>
                  Cancel
                </Button>
                <Button
                  isPending={pendingAction === "stop"}
                  variant="danger"
                  onPress={() => void confirmStop()}
                >
                  {({ isPending }) => (
                    <>
                      {isPending ? <Spinner color="current" size="sm" /> : null}
                      Stop Server
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Kick/Ban confirmation modal */}
      <Modal state={confirmModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-white/10 px-6 py-4">
                <div>
                  <Modal.Heading className="text-xl font-medium">
                    {confirmTarget.current?.action === "ban" ? "Ban" : "Kick"}{" "}
                    Player
                  </Modal.Heading>
                </div>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-white/70">
                  {confirmTarget.current?.action === "ban"
                    ? `Are you sure you want to ban "${confirmTarget.current?.name}" from this server?`
                    : `Are you sure you want to kick "${confirmTarget.current?.name}" from this server?`}
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                <Button variant="secondary" onPress={confirmModal.close}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={() => void executeConfirmedAction()}
                >
                  {confirmTarget.current?.action === "ban" ? "Ban" : "Kick"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}
