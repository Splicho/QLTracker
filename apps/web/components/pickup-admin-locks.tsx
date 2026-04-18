"use client"

import { useMemo, useState } from "react"

import {
  ActionButton,
  Field,
  FieldInput,
  FieldTextArea,
} from "@/components/pickup-admin-fields"
import { Button, Chip, toast } from "@/components/pickup-admin-ui"
import { requestJson } from "@/lib/client/request-json"
import type {
  PickupAdminLocksDto,
  PickupPlayerLockDto,
} from "@/lib/server/pickup"

type PendingAction = "createLock" | `revokeLock:${string}` | null

type LockFormState = {
  expiresAt: string
  reason: string
  steamId: string
}

function createDefaultLockForm(): LockFormState {
  return {
    expiresAt: "",
    reason: "",
    steamId: "",
  }
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Permanent"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function getLockStatus(lock: PickupPlayerLockDto) {
  if (lock.active) {
    return lock.expiresAt ? "Temporary" : "Permanent"
  }

  if (lock.revokedAt) {
    return "Revoked"
  }

  return "Expired"
}

function getLockStatusColor(lock: PickupPlayerLockDto) {
  if (lock.active) {
    return lock.expiresAt ? "warning" : "accent"
  }

  return "default"
}

function normalizeSteamId(value: string) {
  return value.replace(/\D/g, "").slice(0, 17)
}

export function PickupAdminLocks({
  initialLocks,
}: {
  initialLocks: PickupAdminLocksDto
}) {
  const [locks, setLocks] = useState(initialLocks.locks)
  const [form, setForm] = useState(createDefaultLockForm())
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const isPending = pendingAction !== null

  const sortedLocks = useMemo(
    () =>
      [...locks].sort((left, right) => {
        if (left.active !== right.active) {
          return left.active ? -1 : 1
        }

        return (
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
        )
      }),
    [locks]
  )

  const runAction = async (
    action: Exclude<PendingAction, null>,
    callback: () => Promise<void>
  ) => {
    setPendingAction(action)
    try {
      await callback()
    } finally {
      setPendingAction((current) => (current === action ? null : current))
    }
  }

  const createLock = () => {
    void runAction("createLock", async () => {
      try {
        const payload = await requestJson<{ lock: PickupPlayerLockDto }>(
          "/api/pickup/admin/locks",
          {
            body: JSON.stringify({
              expiresAt: form.expiresAt
                ? new Date(form.expiresAt).toISOString()
                : null,
              reason: form.reason.trim() || null,
              steamId: normalizeSteamId(form.steamId),
            }),
            method: "POST",
          }
        )

        setLocks((current) => [
          payload.lock,
          ...current.map((lock) =>
            lock.player.id === payload.lock.player.id && lock.active
              ? { ...lock, active: false, revokedAt: payload.lock.createdAt }
              : lock
          ),
        ])
        setForm(createDefaultLockForm())
        toast.success("Player locked.", {
          description: "They can no longer join matchmaking queues.",
        })
      } catch (error) {
        toast.danger("Player lock failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const revokeLock = (lock: PickupPlayerLockDto) => {
    void runAction(`revokeLock:${lock.id}`, async () => {
      try {
        const payload = await requestJson<{ lock: PickupPlayerLockDto }>(
          `/api/pickup/admin/locks/${encodeURIComponent(lock.id)}`,
          {
            method: "DELETE",
          }
        )

        setLocks((current) =>
          current.map((entry) =>
            entry.id === lock.id ? payload.lock : entry
          )
        )
        toast.success("Player lock revoked.")
      } catch (error) {
        toast.danger("Player lock revoke failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 text-white">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium tracking-tight">Player Locks</h1>
          <p className="text-sm text-white/60">
            Temporarily or permanently block players from joining matchmaking
            queues.
          </p>
        </div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-[#0d0d0d] p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Field
            description="Use the SteamID64 from their QLTracker profile."
            label="SteamID64"
          >
            <FieldInput
              disabled={isPending}
              placeholder="7656119..."
              value={form.steamId}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  steamId: normalizeSteamId(value),
                }))
              }
            />
          </Field>
          <Field
            description="Leave empty for a permanent lock."
            label="Expires at"
          >
            <FieldInput
              disabled={isPending}
              type="datetime-local"
              value={form.expiresAt}
              onChange={(value) =>
                setForm((current) => ({ ...current, expiresAt: value }))
              }
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Reason">
            <FieldTextArea
              disabled={isPending}
              minRows={3}
              placeholder="Optional internal note..."
              value={form.reason}
              onChange={(value) =>
                setForm((current) => ({ ...current, reason: value }))
              }
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
          <ActionButton
            isDisabled={isPending || normalizeSteamId(form.steamId).length !== 17}
            isPending={pendingAction === "createLock"}
            onPress={createLock}
            variant="primary"
          >
            Lock Player
          </ActionButton>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-medium">Lock history</h2>
          <p className="mt-1 text-sm text-white/60">
            Active locks are enforced by the realtime queue service.
          </p>
        </div>
        {sortedLocks.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#111111] text-xs tracking-[0.18em] text-white/40 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedLocks.map((lock) => (
                  <tr key={lock.id} className="border-t border-white/10">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {lock.player.avatarUrl ? (
                          <img
                            alt=""
                            className="size-10 rounded-xl border border-white/10 object-cover"
                            src={lock.player.avatarUrl}
                          />
                        ) : (
                          <span className="size-10 rounded-xl border border-white/10 bg-white/[0.04]" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">
                            {lock.player.personaName}
                          </p>
                          <p className="font-mono text-xs text-white/45">
                            {lock.player.steamId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Chip color={getLockStatusColor(lock)}>
                        {getLockStatus(lock)}
                      </Chip>
                    </td>
                    <td className="max-w-sm px-4 py-4 text-white/65">
                      {lock.reason ?? "No reason provided."}
                    </td>
                    <td className="px-4 py-4 text-white/65">
                      {formatDateTime(lock.expiresAt)}
                    </td>
                    <td className="px-4 py-4 text-white/65">
                      {formatDateTime(lock.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        {lock.active ? (
                          <ActionButton
                            isDisabled={isPending}
                            isPending={
                              pendingAction === `revokeLock:${lock.id}`
                            }
                            onPress={() => revokeLock(lock)}
                            variant="outline"
                          >
                            Revoke
                          </ActionButton>
                        ) : (
                          <Button isDisabled variant="outline">
                            No Action
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-sm text-white/55">
            No player locks have been created yet.
          </div>
        )}
      </section>
    </div>
  )
}
