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
import type { SlotState, SlotsResponse } from "@/lib/client/pickup-admin-types"
import { navigateToUrl } from "@/lib/open-url"
import { buildSteamConnectUrl } from "@/lib/server-utils"

type PendingAction = `start:${number}` | `stop:${number}` | null

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
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

function SlotCard({
  slot,
  pendingAction,
  onStart,
  onStop,
}: {
  slot: SlotState
  pendingAction: PendingAction
  onStart: (slotId: number) => void
  onStop: (slotId: number) => void
}) {
  const isIdle = slot.state === "idle"
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
            <Button
              isPending={pendingAction === `stop:${slot.slotId}`}
              variant="danger"
              size="sm"
              onPress={() => onStop(slot.slotId)}
            >
              Stop Server
            </Button>
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

export function PickupAdminServers() {
  const [slots, setSlots] = useState<SlotState[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [startMap, setStartMap] = useState("")
  const [startTeamSize, setStartTeamSize] = useState(4)
  const startSlotRef = useRef<number | null>(null)

  const startModal = useOverlayState()
  const stopModal = useOverlayState()
  const stopSlotRef = useRef<number | null>(null)

  const fetchSlots = useCallback(async () => {
    try {
      const data = await requestJson<SlotsResponse>("/api/pickup/admin/servers")
      setSlots(data.slots)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch servers.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSlots()
    const interval = setInterval(() => void fetchSlots(), 5000)
    return () => clearInterval(interval)
  }, [fetchSlots])

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
      void fetchSlots()
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
      void fetchSlots()
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

      <div className="grid gap-4 sm:grid-cols-2">
        {slots.map((slot) => (
          <SlotCard
            key={slot.slotId}
            slot={slot}
            pendingAction={pendingAction}
            onStart={openStartModal}
            onStop={openStopModal}
          />
        ))}
      </div>

      {slots.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/55">
          No slot data available. Ensure the provision API URL is configured in
          Settings.
        </div>
      )}

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
    </div>
  )
}
