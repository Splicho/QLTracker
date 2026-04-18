"use client"

import { useEffect, useMemo, useState } from "react"

import {
  ActionButton,
  Field,
  FieldInput,
} from "@/components/pickup-admin-fields"
import { Button, Input, Switch, toast } from "@/components/pickup-admin-ui"
import { requestJson } from "@/lib/client/request-json"
import type {
  PickupAdminOverviewDto,
  PickupRankDto,
} from "@/lib/server/pickup"

type PendingAction =
  | "createRank"
  | `deleteRank:${string}`
  | `updateRank:${string}`
  | `uploadRankBadge:${string}`
  | null

type RankFormState = {
  active: boolean
  badgeUrl: string
  minRating: number
  sortOrder: number
  title: string
}

function createDefaultRankForm(): RankFormState {
  return {
    active: true,
    badgeUrl: "",
    minRating: 1000,
    sortOrder: 0,
    title: "",
  }
}

function createRankForm(rank: PickupRankDto): RankFormState {
  return {
    active: rank.active,
    badgeUrl: rank.badgeUrl ?? "",
    minRating: rank.minRating,
    sortOrder: rank.sortOrder,
    title: rank.title,
  }
}

function createRankDrafts(ranks: PickupRankDto[]) {
  return Object.fromEntries(ranks.map((rank) => [rank.id, createRankForm(rank)]))
}

function sortRanks(ranks: PickupRankDto[]) {
  return [...ranks].sort(
    (left, right) =>
      left.minRating - right.minRating ||
      left.sortOrder - right.sortOrder ||
      left.title.localeCompare(right.title)
  )
}

async function readUploadResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | T
    | null

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object"
        ? (payload as { error?: string; message?: string })
        : null
    throw new Error(
      errorPayload?.error ?? errorPayload?.message ?? "Request failed."
    )
  }

  return payload as T
}

function RankBadgeDropzone({
  disabled,
  imageUrl,
  isPending,
  label,
  onPickFile,
}: {
  disabled?: boolean
  imageUrl: string
  isPending: boolean
  label: string
  onPickFile: (file: File | null) => void
}) {
  return (
    <label
      className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-5 text-center transition hover:bg-white/[0.04]"
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        if (disabled || isPending) {
          return
        }

        onPickFile(event.dataTransfer.files.item(0))
      }}
    >
      {imageUrl ? (
        <img
          alt=""
          className="size-14 rounded-lg border border-white/10 object-contain"
          src={imageUrl}
        />
      ) : (
        <span className="size-14 rounded-lg border border-white/10 bg-black/20" />
      )}
      <span className="text-sm font-medium text-white">
        {isPending ? "Uploading..." : label}
      </span>
      <span className="text-xs text-white/45">
        Drop or pick an AVIF, GIF, JPEG, PNG, or WEBP badge.
      </span>
      <input
        accept="image/*"
        className="sr-only"
        disabled={disabled || isPending}
        type="file"
        onChange={(event) => {
          onPickFile(event.currentTarget.files?.[0] ?? null)
          event.currentTarget.value = ""
        }}
      />
    </label>
  )
}

export function PickupAdminRanks({
  initialOverview,
}: {
  initialOverview: PickupAdminOverviewDto
}) {
  const [overview, setOverview] = useState(initialOverview)
  const [selectedQueueId, setSelectedQueueId] = useState(
    initialOverview.queues[0]?.queue.id ?? ""
  )
  const [rankForm, setRankForm] = useState(createDefaultRankForm())
  const [rankDrafts, setRankDrafts] = useState<Record<string, RankFormState>>(
    initialOverview.queues[0]
      ? createRankDrafts(initialOverview.queues[0].ranks)
      : {}
  )
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const selectedQueueOverview = useMemo(
    () =>
      overview.queues.find((entry) => entry.queue.id === selectedQueueId) ??
      overview.queues[0] ??
      null,
    [overview.queues, selectedQueueId]
  )
  const selectedQueue = selectedQueueOverview?.queue ?? null
  const isPending = pendingAction !== null

  useEffect(() => {
    if (!selectedQueueOverview) {
      setRankDrafts({})
      return
    }

    setRankDrafts(createRankDrafts(selectedQueueOverview.ranks))
    setRankForm(createDefaultRankForm())
  }, [selectedQueueOverview])

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

  const patchRanks = (
    queueId: string,
    updater: (ranks: PickupRankDto[]) => PickupRankDto[]
  ) => {
    setOverview((current) => ({
      ...current,
      queues: current.queues.map((entry) =>
        entry.queue.id === queueId
          ? { ...entry, ranks: updater(entry.ranks) }
          : entry
      ),
    }))
  }

  const uploadRankBadge = (
    target: "new" | string,
    title: string,
    file: File | null
  ) => {
    if (!selectedQueue || !file) {
      return
    }

    void runAction(`uploadRankBadge:${target}`, async () => {
      try {
        const formData = new FormData()
        formData.set("queueId", selectedQueue.id)
        formData.set("title", title.trim() || "rank-badge")
        formData.set("file", file)

        const payload = await readUploadResponse<{ url: string }>(
          await fetch("/api/pickup/admin/ranks/upload", {
            body: formData,
            credentials: "include",
            method: "POST",
          })
        )

        if (target === "new") {
          setRankForm((current) => ({ ...current, badgeUrl: payload.url }))
        } else {
          setRankDrafts((current) => ({
            ...current,
            [target]: {
              ...(current[target] ?? createDefaultRankForm()),
              badgeUrl: payload.url,
            },
          }))
        }

        toast.success("Rank badge uploaded.")
      } catch (error) {
        toast.danger("Rank badge upload failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const createRank = () => {
    if (!selectedQueue) {
      return
    }

    void runAction("createRank", async () => {
      try {
        const payload = await requestJson<{ rank: PickupRankDto }>(
          `/api/pickup/admin/queues/${encodeURIComponent(selectedQueue.id)}/ranks`,
          {
            body: JSON.stringify({
              ...rankForm,
              badgeUrl: rankForm.badgeUrl.trim() || null,
            }),
            method: "POST",
          }
        )

        patchRanks(selectedQueue.id, (ranks) =>
          sortRanks([...ranks, payload.rank])
        )
        setRankDrafts((current) => ({
          ...current,
          [payload.rank.id]: createRankForm(payload.rank),
        }))
        setRankForm(createDefaultRankForm())
        toast.success("Rank created.")
      } catch (error) {
        toast.danger("Rank creation failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const updateRank = (rank: PickupRankDto) => {
    if (!selectedQueue) {
      return
    }

    const draft = rankDrafts[rank.id]
    if (!draft) {
      return
    }

    void runAction(`updateRank:${rank.id}`, async () => {
      try {
        const payload = await requestJson<{ rank: PickupRankDto }>(
          `/api/pickup/admin/ranks/${encodeURIComponent(rank.id)}`,
          {
            body: JSON.stringify({
              ...draft,
              badgeUrl: draft.badgeUrl.trim() || null,
            }),
            method: "PATCH",
          }
        )

        patchRanks(selectedQueue.id, (ranks) =>
          sortRanks(
            ranks.map((entry) => (entry.id === rank.id ? payload.rank : entry))
          )
        )
        setRankDrafts((current) => ({
          ...current,
          [rank.id]: createRankForm(payload.rank),
        }))
        toast.success("Rank saved.")
      } catch (error) {
        toast.danger("Rank update failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const deleteRank = (rank: PickupRankDto) => {
    if (!selectedQueue) {
      return
    }

    void runAction(`deleteRank:${rank.id}`, async () => {
      try {
        await requestJson<{ deletedRankId: string }>(
          `/api/pickup/admin/ranks/${encodeURIComponent(rank.id)}`,
          {
            method: "DELETE",
          }
        )

        patchRanks(selectedQueue.id, (ranks) =>
          ranks.filter((entry) => entry.id !== rank.id)
        )
        setRankDrafts((current) => {
          const next = { ...current }
          delete next[rank.id]
          return next
        })
        toast.success("Rank deleted.")
      } catch (error) {
        toast.danger("Rank delete failed.", {
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
          <h1 className="text-3xl font-medium tracking-tight">Ranks</h1>
          <p className="text-sm text-white/60">
            Manage queue-specific rank thresholds and uploaded badge images.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview.queues.map((entry) => (
            <Button
              key={entry.queue.id}
              variant={entry.queue.id === selectedQueueId ? "primary" : "outline"}
              onPress={() => setSelectedQueueId(entry.queue.id)}
            >
              {entry.queue.name}
            </Button>
          ))}
        </div>
      </header>

      {selectedQueue ? (
        <>
          <section className="rounded-3xl border border-white/10 bg-[#0d0d0d] p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_8rem_7rem_18rem]">
              <Field label="Title">
                <FieldInput
                  disabled={isPending}
                  placeholder="Gold"
                  value={rankForm.title}
                  onChange={(value) =>
                    setRankForm((current) => ({ ...current, title: value }))
                  }
                />
              </Field>
              <Field label="Min rating">
                <FieldInput
                  disabled={isPending}
                  min={0}
                  type="number"
                  value={String(rankForm.minRating)}
                  onChange={(value) =>
                    setRankForm((current) => ({
                      ...current,
                      minRating: Math.max(0, Number(value) || 0),
                    }))
                  }
                />
              </Field>
              <Field label="Order">
                <FieldInput
                  disabled={isPending}
                  min={0}
                  type="number"
                  value={String(rankForm.sortOrder)}
                  onChange={(value) =>
                    setRankForm((current) => ({
                      ...current,
                      sortOrder: Math.max(0, Number(value) || 0),
                    }))
                  }
                />
              </Field>
              <RankBadgeDropzone
                disabled={isPending}
                imageUrl={rankForm.badgeUrl}
                isPending={pendingAction === "uploadRankBadge:new"}
                label="Upload badge"
                onPickFile={(file) =>
                  uploadRankBadge("new", rankForm.title, file)
                }
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <Switch
                isDisabled={isPending}
                isSelected={rankForm.active}
                size="sm"
                onChange={(active) =>
                  setRankForm((current) => ({ ...current, active }))
                }
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>Rank active</Switch.Content>
              </Switch>
              <ActionButton
                isDisabled={isPending || rankForm.title.trim().length === 0}
                isPending={pendingAction === "createRank"}
                onPress={createRank}
                variant="primary"
              >
                Create Rank
              </ActionButton>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d]">
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-medium">{selectedQueue.name} ranks</h2>
              <p className="mt-1 text-sm text-white/60">
                Players reveal a rank after 10 rated placement games.
              </p>
            </div>
            {selectedQueueOverview?.ranks.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#111111] text-xs tracking-[0.18em] text-white/40 uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Badge</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Min Rating</th>
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Active</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQueueOverview.ranks.map((rank) => {
                      const draft = rankDrafts[rank.id] ?? createRankForm(rank)

                      return (
                        <tr
                          key={rank.id}
                          className="border-t border-white/10 align-top"
                        >
                          <td className="px-4 py-4">
                            <RankBadgeDropzone
                              disabled={isPending}
                              imageUrl={draft.badgeUrl}
                              isPending={
                                pendingAction ===
                                `uploadRankBadge:${rank.id}`
                              }
                              label="Replace badge"
                              onPickFile={(file) =>
                                uploadRankBadge(rank.id, draft.title, file)
                              }
                            />
                          </td>
                          <td className="px-4 py-4">
                            <Input
                              className="h-10 min-w-40 border-white/10 bg-transparent text-white"
                              disabled={isPending}
                              value={draft.title}
                              onChange={(event) =>
                                setRankDrafts((current) => ({
                                  ...current,
                                  [rank.id]: {
                                    ...draft,
                                    title: event.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                          <td className="px-4 py-4">
                            <Input
                              className="h-10 max-w-28 border-white/10 bg-transparent text-white"
                              disabled={isPending}
                              min={0}
                              type="number"
                              value={String(draft.minRating)}
                              onChange={(event) =>
                                setRankDrafts((current) => ({
                                  ...current,
                                  [rank.id]: {
                                    ...draft,
                                    minRating: Math.max(
                                      0,
                                      Number(event.target.value) || 0
                                    ),
                                  },
                                }))
                              }
                            />
                          </td>
                          <td className="px-4 py-4">
                            <Input
                              className="h-10 max-w-24 border-white/10 bg-transparent text-white"
                              disabled={isPending}
                              min={0}
                              type="number"
                              value={String(draft.sortOrder)}
                              onChange={(event) =>
                                setRankDrafts((current) => ({
                                  ...current,
                                  [rank.id]: {
                                    ...draft,
                                    sortOrder: Math.max(
                                      0,
                                      Number(event.target.value) || 0
                                    ),
                                  },
                                }))
                              }
                            />
                          </td>
                          <td className="px-4 py-4">
                            <Switch
                              isDisabled={isPending}
                              isSelected={draft.active}
                              size="sm"
                              onChange={(active) =>
                                setRankDrafts((current) => ({
                                  ...current,
                                  [rank.id]: {
                                    ...draft,
                                    active,
                                  },
                                }))
                              }
                            >
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-3">
                              <ActionButton
                                isDisabled={isPending}
                                isPending={
                                  pendingAction === `updateRank:${rank.id}`
                                }
                                onPress={() => updateRank(rank)}
                                variant="secondary"
                              >
                                Save
                              </ActionButton>
                              <ActionButton
                                isDisabled={isPending}
                                isPending={
                                  pendingAction === `deleteRank:${rank.id}`
                                }
                                onPress={() => deleteRank(rank)}
                                variant="outline"
                              >
                                Delete
                              </ActionButton>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-8 text-sm text-white/55">
                No ranks yet. Create the first threshold to start revealing
                badges after placements.
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-3xl border border-dashed border-white/10 bg-[#0d0d0d] px-6 py-8 text-sm text-white/55">
          Create a queue before adding ranks.
        </section>
      )}
    </div>
  )
}
