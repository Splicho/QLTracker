"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { Field } from "@/components/pickup-admin-fields"
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
  AbortPickupResponse,
  ActivePickup,
  ActivePickupsResponse,
  SlotState,
  SlotsResponse,
} from "@/lib/client/pickup-admin-types"
import { navigateToUrl } from "@/lib/open-url"
import { buildSteamConnectUrl } from "@/lib/server-utils"

type PendingAction =
  | `abort:${string}`
  | `start:${number}`
  | `stop:${number}`
  | null

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function timeUntil(iso: string) {
  const seconds = Math.ceil((new Date(iso).getTime() - Date.now()) / 1000)
  if (seconds <= 0) return "expired"
  if (seconds < 60) return `${seconds}s left`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.ceil(minutes / 60)
  return `${hours}h left`
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

function isPickupSlot(slot: SlotState) {
  return Boolean(
    slot.matchId && slot.queueId && !slot.matchId.startsWith("manual-")
  )
}

function formatPickupStatus(status: ActivePickup["status"] | string) {
  return status.replaceAll("_", " ")
}

function formatPlayerSummary(match: ActivePickup) {
  const names = match.players
    .map((entry) => entry.player.personaName)
    .filter(Boolean)
  return names.length > 0 ? names.join(", ") : "No roster players"
}

function SlotCard({
  slot,
  pendingAction,
  onStart,
  onAbort,
  onStop,
}: {
  slot: SlotState
  pendingAction: PendingAction
  onStart: (slotId: number) => void
  onAbort: (matchId: string, slotId?: number) => void
  onStop: (slotId: number) => void
}) {
  const isIdle = slot.state === "idle"
  const isPickup = isPickupSlot(slot)
  const pickupMatchId = isPickup ? slot.matchId : null
  const joinUrl =
    !isIdle && slot.joinAddress ? buildSteamConnectUrl(slot.joinAddress) : null

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0d0d0d] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-white">
            Slot {slot.slotId}
          </span>
          <span className="text-sm text-white/40">:{slot.gamePort}</span>
        </div>
        <Chip color={statusColor(slot.state)} variant="soft">
          {slot.state}
        </Chip>
      </div>

      {!isIdle && (
        <div className="mt-3 space-y-1 text-sm text-white/50">
          {slot.matchId && (
            <p>
              Match:{" "}
              <span className="font-mono text-xs text-white/70">
                {slot.matchId.slice(0, 12)}...
              </span>
            </p>
          )}
          {slot.queueId && <p>Queue: {slot.queueId}</p>}
          <p>Updated: {timeAgo(slot.updatedAt)}</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {isIdle ? (
          <Button
            isPending={pendingAction === `start:${slot.slotId}`}
            variant="primary"
            size="sm"
            onPress={() => onStart(slot.slotId)}
          >
            Start Server
          </Button>
        ) : (
          <>
            {joinUrl && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => navigateToUrl(joinUrl)}
              >
                Join Server
              </Button>
            )}
            {pickupMatchId ? (
              <Button
                isPending={pendingAction === `abort:${pickupMatchId}`}
                variant="danger"
                size="sm"
                onPress={() => onAbort(pickupMatchId, slot.slotId)}
              >
                Abort Pickup
              </Button>
            ) : (
              <Button
                isPending={pendingAction === `stop:${slot.slotId}`}
                variant="danger"
                size="sm"
                onPress={() => onStop(slot.slotId)}
              >
                Stop Server
              </Button>
            )}
            <Link href={`/admin/servers/${slot.slotId}`}>
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function ActivePickupCard({
  match,
  pendingAction,
  slot,
  onAbort,
}: {
  match: ActivePickup
  pendingAction: PendingAction
  slot?: SlotState
  onAbort: (matchId: string, slotId?: number) => void
}) {
  const deadline = match.readyDeadlineAt ?? match.vetoDeadlineAt

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0d0d0d] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-medium text-white">
              {match.queue.name}
            </h3>
            <Chip color="warning" variant="soft">
              {formatPickupStatus(match.status)}
            </Chip>
            {slot && (
              <Chip color={statusColor(slot.state)} variant="soft">
                Slot {slot.slotId}
              </Chip>
            )}
          </div>
          <p className="mt-1 text-sm text-white/50">
            {match.finalMapKey ? `Map: ${match.finalMapKey}` : "Map undecided"}
          </p>
        </div>
        <Button
          isPending={pendingAction === `abort:${match.id}`}
          variant="danger"
          size="sm"
          onPress={() => onAbort(match.id, slot?.slotId)}
        >
          Abort Pickup
        </Button>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-white/55 md:grid-cols-2">
        <div>
          <span className="text-white/35">Match</span>
          <p className="font-mono text-xs text-white/70">{match.id}</p>
        </div>
        <div>
          <span className="text-white/35">Players</span>
          <p className="truncate text-white/70">{formatPlayerSummary(match)}</p>
        </div>
        <div>
          <span className="text-white/35">Created</span>
          <p>{timeAgo(match.createdAt)}</p>
        </div>
        <div>
          <span className="text-white/35">Deadline</span>
          <p>{deadline ? timeUntil(deadline) : "None"}</p>
        </div>
      </div>
    </div>
  )
}

export function PickupAdminServers() {
  const [slots, setSlots] = useState<SlotState[]>([])
  const [activePickups, setActivePickups] = useState<ActivePickup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [startMap, setStartMap] = useState("")
  const [startTeamSize, setStartTeamSize] = useState(4)
  const startSlotRef = useRef<number | null>(null)
  const abortTargetRef = useRef<{ matchId: string; slotId?: number } | null>(
    null
  )

  const startModal = useOverlayState()
  const stopModal = useOverlayState()
  const abortModal = useOverlayState()
  const stopSlotRef = useRef<number | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      const [slotsData, activePickupsData] = await Promise.all([
        requestJson<SlotsResponse>("/api/pickup/admin/servers"),
        requestJson<ActivePickupsResponse>("/api/pickup/admin/pickups/active"),
      ])
      setSlots(slotsData.slots)
      setActivePickups(activePickupsData.matches)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch servers.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDashboard()
    const interval = setInterval(() => void fetchDashboard(), 5000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  const openStartModal = (slotId: number) => {
    startSlotRef.current = slotId
    setStartMap("")
    setStartTeamSize(4)
    startModal.open()
  }

  const openStopModal = (slotId: number) => {
    stopSlotRef.current = slotId
    stopModal.open()
  }

  const openAbortModal = (matchId: string, slotId?: number) => {
    abortTargetRef.current = { matchId, slotId }
    abortModal.open()
  }

  const confirmStart = async () => {
    const slotId = startSlotRef.current
    if (slotId === null || !startMap.trim()) return

    setPendingAction(`start:${slotId}`)
    try {
      await requestJson(`/api/pickup/admin/servers/${slotId}/start`, {
        method: "POST",
        body: JSON.stringify({ map: startMap.trim(), teamSize: startTeamSize }),
      })
      toast.success(`Server started on Slot ${slotId}.`)
      startModal.close()
      void fetchDashboard()
    } catch (err) {
      toast.danger("Failed to start server.", {
        description: err instanceof Error ? err.message : "Request failed.",
      })
    } finally {
      setPendingAction(null)
    }
  }

  const confirmStop = async () => {
    const slotId = stopSlotRef.current
    if (slotId === null) return

    setPendingAction(`stop:${slotId}`)
    try {
      await requestJson(`/api/pickup/admin/servers/${slotId}/stop`, {
        method: "POST",
      })
      toast.success(`Server on Slot ${slotId} stopped.`)
      stopModal.close()
      void fetchDashboard()
    } catch (err) {
      toast.danger("Failed to stop server.", {
        description: err instanceof Error ? err.message : "Request failed.",
      })
    } finally {
      setPendingAction(null)
    }
  }

  const confirmAbort = async () => {
    const target = abortTargetRef.current
    if (!target) return

    setPendingAction(`abort:${target.matchId}`)
    try {
      const data = await requestJson<AbortPickupResponse>(
        `/api/pickup/admin/pickups/${target.matchId}/abort`,
        {
          method: "POST",
          body: JSON.stringify({ slotId: target.slotId }),
        }
      )

      if (data.abort.aborted) {
        toast.success("Pickup aborted.", {
          description:
            data.slotStopWarning ??
            (data.slotStopped && data.slotId
              ? `Stopped Slot ${data.slotId}.`
              : "No matching server slot was active."),
        })
      } else {
        toast.success("Pickup already inactive.", {
          description: data.abort.warning,
        })
      }

      abortModal.close()
      void fetchDashboard()
    } catch (err) {
      toast.danger("Failed to abort pickup.", {
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

  const slotByMatchId = new Map(
    slots
      .filter((slot) => slot.matchId)
      .map((slot) => [slot.matchId as string, slot])
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 text-white">
      <header className="space-y-1">
        <h1 className="text-3xl font-medium tracking-tight">Servers</h1>
        <p className="text-sm text-white/60">
          View and manage the 4 game server slots on the provisioner.
        </p>
      </header>

      {error && (
        <div className="border-danger/30 bg-danger/10 text-danger rounded-2xl border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.18em] text-white/40 uppercase">
            Active Pickups
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Abort cancels the pickup, skips requeue/rating, and stops the slot
            when one exists.
          </p>
        </div>

        {activePickups.length > 0 ? (
          <div className="grid gap-4">
            {activePickups.map((match) => (
              <ActivePickupCard
                key={match.id}
                match={match}
                pendingAction={pendingAction}
                slot={slotByMatchId.get(match.id)}
                onAbort={openAbortModal}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/55">
            No active pickups.
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-[0.18em] text-white/40 uppercase">
          Server Slots
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {slots.map((slot) => (
            <SlotCard
              key={slot.slotId}
              slot={slot}
              pendingAction={pendingAction}
              onStart={openStartModal}
              onAbort={openAbortModal}
              onStop={openStopModal}
            />
          ))}
        </div>

        {slots.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/55">
            No slot data available. Ensure the provision API URL is configured
            in Settings.
          </div>
        )}
      </section>

      <Modal state={startModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-white/10 px-6 py-4">
                <div>
                  <Modal.Heading className="text-xl font-medium">
                    Start Server
                  </Modal.Heading>
                  <p className="mt-1 text-sm text-white/60">
                    Manually start a game server on Slot {startSlotRef.current}.
                  </p>
                </div>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <div className="grid gap-4">
                  <Field label="Slot">
                    <Input
                      disabled
                      value={`Slot ${startSlotRef.current}`}
                      variant="secondary"
                    />
                  </Field>
                  <Field label="Map">
                    <Input
                      placeholder="campgrounds"
                      value={startMap}
                      variant="secondary"
                      onChange={(e) => setStartMap(e.target.value)}
                    />
                  </Field>
                  <Field label="Team Size">
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      value={String(startTeamSize)}
                      variant="secondary"
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (v >= 1 && v <= 8) setStartTeamSize(v)
                      }}
                    />
                  </Field>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                <Button variant="secondary" onPress={startModal.close}>
                  Cancel
                </Button>
                <Button
                  isDisabled={!startMap.trim() || pendingAction !== null}
                  isPending={pendingAction?.startsWith("start:") ?? false}
                  variant="primary"
                  onPress={() => void confirmStart()}
                >
                  {({ isPending }) => (
                    <>
                      {isPending ? <Spinner color="current" size="sm" /> : null}
                      Start Server
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

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
                    This will immediately kill the game server on Slot{" "}
                    {stopSlotRef.current}.
                  </p>
                </div>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-white/70">
                  Are you sure? Any active match on this slot will be terminated
                  and players will be disconnected immediately.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                <Button variant="secondary" onPress={stopModal.close}>
                  Cancel
                </Button>
                <Button
                  isPending={pendingAction?.startsWith("stop:") ?? false}
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

      <Modal state={abortModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header className="border-b border-white/10 px-6 py-4">
                <div>
                  <Modal.Heading className="text-xl font-medium">
                    Abort Pickup
                  </Modal.Heading>
                  <p className="mt-1 text-sm text-white/60">
                    This cancels the pickup and stops the server slot when one
                    exists.
                  </p>
                </div>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="px-6 py-5">
                <p className="text-sm text-white/70">
                  Aborting disconnects players if a server exists, does not
                  requeue anyone, and does not apply rating.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                <Button variant="secondary" onPress={abortModal.close}>
                  Cancel
                </Button>
                <Button
                  isPending={pendingAction?.startsWith("abort:") ?? false}
                  variant="danger"
                  onPress={() => void confirmAbort()}
                >
                  {({ isPending }) => (
                    <>
                      {isPending ? <Spinner color="current" size="sm" /> : null}
                      Abort Pickup
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  )
}
