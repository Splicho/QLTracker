"use client"

import { useEffect, useMemo, useState } from "react"

import {
  ActionButton,
  Field,
  FieldDateTimePicker,
  FieldInput,
  FieldSelect,
  FieldTextArea,
} from "@/components/pickup-admin-fields"
import {
  Button,
  Chip,
  Input,
  Modal,
  Switch,
  Tabs,
  toast,
  useOverlayState,
} from "@/components/pickup-admin-ui"
import { requestJson } from "@/lib/client/request-json"
import type {
  PickupAdminOverviewDto,
  PickupMapPoolDto,
  PickupQueueDto,
  PickupRankDto,
  PickupSeasonDto,
} from "@/lib/server/pickup"

type PendingAction =
  | "createQueue"
  | "createRank"
  | "createSeason"
  | `deleteRank:${string}`
  | "saveMaps"
  | "saveQueue"
  | `updateRank:${string}`
  | `updateSeason:${string}`
  | `uploadRankBadge:${string}`
  | null

type SeasonFormState = {
  durationPreset: "one_month" | "three_month" | "custom"
  endsAt: string
  name: string
  startsAt: string
  startingRating: number
  status: "draft" | "active" | "completed"
}

type RankFormState = {
  active: boolean
  badgeUrl: string
  minRating: number
  sortOrder: number
  title: string
}

function formatDateTimeInput(value: string) {
  return value.slice(0, 16)
}

function createDefaultSeasonForm(): SeasonFormState {
  return {
    durationPreset: "one_month",
    endsAt: "",
    name: "",
    startsAt: formatDateTimeInput(new Date().toISOString()),
    startingRating: 1000,
    status: "draft",
  }
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

function createSeasonDrafts(seasons: PickupSeasonDto[]) {
  return Object.fromEntries(
    seasons.map((season) => [
      season.id,
      { startingRating: season.startingRating },
    ])
  )
}

function createQueueForm(queue: PickupQueueDto) {
  return {
    description: queue.description ?? "",
    enabled: queue.enabled,
    name: queue.name,
    playerCount: queue.playerCount,
    teamSize: queue.teamSize,
  }
}

function createMapsText(maps: PickupMapPoolDto[]) {
  return maps
    .map((map) => `${map.mapKey}|${map.label}|${map.active ? "1" : "0"}`)
    .join("\n")
}

const seasonPresetOptions = [
  { key: "one_month", label: "1 month" },
  { key: "three_month", label: "3 months" },
  { key: "custom", label: "Custom" },
] as const

const seasonStatusOptions = [
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
] as const

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
    const message =
      errorPayload?.error ?? errorPayload?.message ?? "Request failed."
    throw new Error(message ?? "Request failed.")
  }

  return payload as T
}

export function PickupAdminDashboard({
  initialOverview,
}: {
  initialOverview: PickupAdminOverviewDto
}) {
  const [overview, setOverview] = useState(initialOverview)
  const [selectedQueueId, setSelectedQueueId] = useState(
    initialOverview.queues[0]?.queue.id ?? ""
  )
  const [adminTab, setAdminTab] = useState("settings")
  const [queueForm, setQueueForm] = useState(
    initialOverview.queues[0]
      ? createQueueForm(initialOverview.queues[0].queue)
      : null
  )
  const [seasonForm, setSeasonForm] = useState(createDefaultSeasonForm())
  const [seasonDrafts, setSeasonDrafts] = useState<
    Record<string, { startingRating: number }>
  >(
    initialOverview.queues[0]
      ? createSeasonDrafts(initialOverview.queues[0].seasons)
      : {}
  )
  const [rankForm, setRankForm] = useState(createDefaultRankForm())
  const [rankDrafts, setRankDrafts] = useState<Record<string, RankFormState>>(
    initialOverview.queues[0]
      ? createRankDrafts(initialOverview.queues[0].ranks)
      : {}
  )
  const [mapsText, setMapsText] = useState(
    initialOverview.queues[0]
      ? createMapsText(initialOverview.queues[0].maps)
      : ""
  )
  const [newQueueForm, setNewQueueForm] = useState({
    description: "",
    enabled: true,
    name: "",
    playerCount: 8,
    teamSize: 4,
  })
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const createQueueModal = useOverlayState()

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
    if (!overview.queues.length) {
      if (selectedQueueId) {
        setSelectedQueueId("")
      }

      return
    }

    if (!selectedQueueOverview) {
      setSelectedQueueId(overview.queues[0]!.queue.id)
    }
  }, [overview.queues, selectedQueueId, selectedQueueOverview])

  useEffect(() => {
    if (!selectedQueueOverview) {
      setQueueForm(null)
      setMapsText("")
      setRankDrafts({})
      setSeasonDrafts({})
      return
    }

    setQueueForm(createQueueForm(selectedQueueOverview.queue))
    setMapsText(createMapsText(selectedQueueOverview.maps))
    setRankDrafts(createRankDrafts(selectedQueueOverview.ranks))
    setRankForm(createDefaultRankForm())
    setSeasonForm(createDefaultSeasonForm())
    setSeasonDrafts(createSeasonDrafts(selectedQueueOverview.seasons))
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

  const patchQueueOverview = (
    queueId: string,
    updater: (
      entry: PickupAdminOverviewDto["queues"][number]
    ) => PickupAdminOverviewDto["queues"][number]
  ) => {
    setOverview((current) => ({
      ...current,
      queues: current.queues.map((entry) =>
        entry.queue.id === queueId ? updater(entry) : entry
      ),
    }))
  }

  const selectQueue = (entry: PickupAdminOverviewDto["queues"][number]) => {
    setSelectedQueueId(entry.queue.id)
    setQueueForm(createQueueForm(entry.queue))
    setMapsText(createMapsText(entry.maps))
    setRankDrafts(createRankDrafts(entry.ranks))
    setRankForm(createDefaultRankForm())
    setSeasonForm(createDefaultSeasonForm())
    setSeasonDrafts(createSeasonDrafts(entry.seasons))
  }

  const createQueue = () => {
    void runAction("createQueue", async () => {
      try {
        const payload = await requestJson<{ queue: PickupQueueDto }>(
          "/api/pickup/admin/queues",
          {
            body: JSON.stringify(newQueueForm),
            method: "POST",
          }
        )

        const nextEntry = {
          activeSeason: null,
          maps: [],
          queue: payload.queue,
          ranks: [],
          seasons: [],
        }

        setOverview((current) => ({
          ...current,
          queues: [...current.queues, nextEntry].sort((left, right) =>
            left.queue.name.localeCompare(right.queue.name)
          ),
        }))
        setSelectedQueueId(payload.queue.id)
        setAdminTab("settings")
        createQueueModal.close()
        setNewQueueForm({
          description: "",
          enabled: true,
          name: "",
          playerCount: 8,
          teamSize: 4,
        })
        toast.success("Queue created.")
      } catch (error) {
        toast.danger("Queue creation failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const saveQueue = () => {
    if (!selectedQueue || !queueForm) {
      return
    }

    void runAction("saveQueue", async () => {
      try {
        const payload = await requestJson<{ queue: PickupQueueDto }>(
          `/api/pickup/admin/queues/${encodeURIComponent(selectedQueue.id)}`,
          {
            body: JSON.stringify(queueForm),
            method: "PATCH",
          }
        )

        patchQueueOverview(selectedQueue.id, (entry) => ({
          ...entry,
          queue: payload.queue,
        }))
        toast.success("Queue settings saved.")
      } catch (error) {
        toast.danger("Queue settings failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const saveMaps = () => {
    if (!selectedQueue) {
      return
    }

    void runAction("saveMaps", async () => {
      try {
        const maps = mapsText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line, index) => {
            const [mapKey, label, active] = line
              .split("|")
              .map((part) => part.trim())
            return {
              active: active !== "0",
              label: label || mapKey,
              mapKey,
              sortOrder: index,
            }
          })

        const payload = await requestJson<{ maps: PickupMapPoolDto[] }>(
          `/api/pickup/admin/queues/${encodeURIComponent(selectedQueue.id)}/maps`,
          {
            body: JSON.stringify({ maps }),
            method: "PUT",
          }
        )

        patchQueueOverview(selectedQueue.id, (entry) => ({
          ...entry,
          maps: payload.maps,
        }))
        toast.success("Map pool saved.")
      } catch (error) {
        toast.danger("Map pool save failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const createSeason = () => {
    if (!selectedQueue) {
      return
    }

    void runAction("createSeason", async () => {
      try {
        const payload = await requestJson<{ season: PickupSeasonDto }>(
          "/api/pickup/admin/seasons",
          {
            body: JSON.stringify({
              ...seasonForm,
              endsAt: seasonForm.endsAt
                ? new Date(seasonForm.endsAt).toISOString()
                : undefined,
              queueId: selectedQueue.id,
              startsAt: new Date(seasonForm.startsAt).toISOString(),
            }),
            method: "POST",
          }
        )

        patchQueueOverview(selectedQueue.id, (entry) => {
          const seasons = [payload.season, ...entry.seasons].sort(
            (left, right) => right.startsAt.localeCompare(left.startsAt)
          )

          return {
            ...entry,
            activeSeason:
              seasons.find((season) => season.status === "active") ?? null,
            seasons,
          }
        })
        setSeasonForm(createDefaultSeasonForm())
        toast.success("Season created.")
      } catch (error) {
        toast.danger("Season creation failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const updateSeasonStatus = (
    seasonId: string,
    status: PickupSeasonDto["status"]
  ) => {
    if (!selectedQueue) {
      return
    }

    void runAction(`updateSeason:${seasonId}`, async () => {
      try {
        const payload = await requestJson<{ season: PickupSeasonDto }>(
          `/api/pickup/admin/seasons/${encodeURIComponent(seasonId)}`,
          {
            body: JSON.stringify({ status }),
            method: "PATCH",
          }
        )

        patchQueueOverview(selectedQueue.id, (entry) => {
          const seasons = entry.seasons.map((season) =>
            season.id === seasonId
              ? payload.season
              : status === "active" && season.status === "active"
                ? { ...season, status: "completed" as const }
                : season
          )

          return {
            ...entry,
            activeSeason:
              seasons.find((season) => season.status === "active") ?? null,
            seasons,
          }
        })
        toast.success("Season updated.")
      } catch (error) {
        toast.danger("Season update failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
  }

  const updateSeasonStartingRating = (season: PickupSeasonDto) => {
    if (!selectedQueue) {
      return
    }

    const draft = seasonDrafts[season.id]
    if (!draft) {
      return
    }

    void runAction(`updateSeason:${season.id}`, async () => {
      try {
        const payload = await requestJson<{ season: PickupSeasonDto }>(
          `/api/pickup/admin/seasons/${encodeURIComponent(season.id)}`,
          {
            body: JSON.stringify({
              startingRating: draft.startingRating,
            }),
            method: "PATCH",
          }
        )

        patchQueueOverview(selectedQueue.id, (entry) => {
          const seasons = entry.seasons.map((entrySeason) =>
            entrySeason.id === season.id ? payload.season : entrySeason
          )

          return {
            ...entry,
            activeSeason:
              seasons.find((entrySeason) => entrySeason.status === "active") ??
              null,
            seasons,
          }
        })
        toast.success("Season starting rating saved.")
      } catch (error) {
        toast.danger("Season update failed.", {
          description:
            error instanceof Error ? error.message : "Request failed.",
        })
      }
    })
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

        patchQueueOverview(selectedQueue.id, (entry) => ({
          ...entry,
          ranks: sortRanks([...entry.ranks, payload.rank]),
        }))
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

        patchQueueOverview(selectedQueue.id, (entry) => ({
          ...entry,
          ranks: sortRanks(
            entry.ranks.map((entryRank) =>
              entryRank.id === rank.id ? payload.rank : entryRank
            )
          ),
        }))
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

        patchQueueOverview(selectedQueue.id, (entry) => ({
          ...entry,
          ranks: entry.ranks.filter((entryRank) => entryRank.id !== rank.id),
        }))
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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-medium tracking-tight">Queues</h1>
          <p className="text-sm text-white/60">
            Manage queue formats, seasonal ladders, and map pools.
          </p>
        </div>
        <Modal state={createQueueModal}>
          <Modal.Trigger>
            <Button className="h-11" variant="secondary">
              Create Queue
            </Button>
          </Modal.Trigger>
          <Modal.Backdrop>
            <Modal.Container placement="center" size="lg">
              <Modal.Dialog>
                <Modal.Header className="border-b border-white/10 px-6 py-4">
                  <div>
                    <Modal.Heading className="text-xl font-medium">
                      Create Queue
                    </Modal.Heading>
                    <p className="mt-1 text-sm text-white/60">
                      Add new queue formats like 2v2 CA, each with its own map
                      pool, season timeline, and seasonal rating ladder. Shared
                      timers and provision settings stay global.
                    </p>
                  </div>
                  <Modal.CloseTrigger />
                </Modal.Header>
                <Modal.Body className="px-6 py-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Queue name">
                      <FieldInput
                        disabled={isPending}
                        placeholder="2v2 CA"
                        value={newQueueForm.name}
                        onChange={(value) =>
                          setNewQueueForm((current) => ({
                            ...current,
                            name: value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Team size">
                      <FieldInput
                        disabled={isPending}
                        min={1}
                        type="number"
                        value={String(newQueueForm.teamSize)}
                        onChange={(value) => {
                          const teamSize = Math.max(1, Number(value) || 1)
                          setNewQueueForm((current) => ({
                            ...current,
                            playerCount: teamSize * 2,
                            teamSize,
                          }))
                        }}
                      />
                    </Field>
                    <Field label="Player count">
                      <FieldInput
                        disabled
                        type="number"
                        value={String(newQueueForm.playerCount)}
                        onChange={() => {}}
                      />
                    </Field>
                    <Field className="lg:col-span-2" label="Description">
                      <FieldTextArea
                        disabled={isPending}
                        placeholder="Seasonal 2v2 Clan Arena pickup queue."
                        value={newQueueForm.description}
                        onChange={(value) =>
                          setNewQueueForm((current) => ({
                            ...current,
                            description: value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                </Modal.Body>
                <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      onPress={createQueueModal.close}
                    >
                      Cancel
                    </Button>
                    <ActionButton
                      isDisabled={
                        isPending || newQueueForm.name.trim().length === 0
                      }
                      isPending={pendingAction === "createQueue"}
                      onPress={createQueue}
                      variant="primary"
                    >
                      Create Queue
                    </ActionButton>
                  </div>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </header>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-medium">Queue Directory</h2>
          <p className="mt-1 text-sm text-white/60">
            Select a queue to edit its settings, seasonal ladder, and map pool.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#111111] text-xs tracking-[0.18em] text-white/40 uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Queue</th>
                <th className="px-6 py-3 font-medium">Format</th>
                <th className="px-6 py-3 font-medium">Season</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {overview.queues.map((entry) => {
                const isSelected = entry.queue.id === selectedQueueId

                return (
                  <tr
                    key={entry.queue.id}
                    className={`cursor-pointer border-t border-white/10 transition ${
                      isSelected ? "bg-accent/10" : "hover:bg-white/[0.03]"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectQueue(entry)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        selectQueue(entry)
                      }
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex w-full flex-col text-left">
                        <span className="font-medium text-white">
                          {entry.queue.name}
                        </span>
                        <span className="mt-1 text-xs tracking-[0.18em] text-white/40 uppercase">
                          {entry.queue.slug}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {entry.queue.teamSize}v{entry.queue.teamSize}
                      <div className="mt-1 text-xs text-white/40">
                        {entry.queue.playerCount} players
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {entry.activeSeason?.name ?? "No active season"}
                      <div className="mt-1 text-xs text-white/40">
                        {entry.maps.length} maps, {entry.seasons.length} seasons
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Chip
                        color={entry.queue.enabled ? "accent" : "default"}
                        variant="soft"
                      >
                        {entry.queue.enabled ? "Enabled" : "Disabled"}
                      </Chip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-medium">
                {selectedQueue ? selectedQueue.name : "Queue workspace"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                Manage queue-specific fields here. Shared timers and server
                provisioning settings live on the separate shared settings page.
              </p>
            </div>
            {selectedQueue ? <div /> : null}
          </div>
        </div>

        <div className="px-6 py-6">
          <Tabs
            selectedKey={adminTab}
            variant="secondary"
            onSelectionChange={(key) => setAdminTab(String(key))}
          >
            <Tabs.ListContainer className="mb-6">
              <Tabs.List aria-label="Pickup admin sections">
                <Tabs.Tab id="settings">
                  Settings
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="seasons">
                  Seasons
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="ranks">
                  Ranks
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="maps">
                  Map Pool
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="settings" className="space-y-6">
              {selectedQueue && queueForm ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Queue name">
                      <FieldInput
                        disabled={isPending}
                        value={queueForm.name}
                        onChange={(value) =>
                          setQueueForm((current) =>
                            current ? { ...current, name: value } : current
                          )
                        }
                      />
                    </Field>
                    <Field className="lg:col-span-2" label="Description">
                      <FieldTextArea
                        disabled={isPending}
                        value={queueForm.description}
                        onChange={(value) =>
                          setQueueForm((current) =>
                            current
                              ? { ...current, description: value }
                              : current
                          )
                        }
                      />
                    </Field>
                    <Field label="Team size">
                      <FieldInput
                        disabled={isPending}
                        min={1}
                        type="number"
                        value={String(queueForm.teamSize)}
                        onChange={(value) => {
                          const teamSize = Math.max(1, Number(value) || 1)
                          setQueueForm((current) =>
                            current
                              ? {
                                  ...current,
                                  playerCount: teamSize * 2,
                                  teamSize,
                                }
                              : current
                          )
                        }}
                      />
                    </Field>
                    <Field label="Player count">
                      <FieldInput
                        disabled
                        type="number"
                        value={String(queueForm.playerCount)}
                        onChange={() => {}}
                      />
                    </Field>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <Switch
                      isDisabled={isPending}
                      isSelected={queueForm.enabled}
                      size="sm"
                      onChange={(enabled) =>
                        setQueueForm((current) =>
                          current ? { ...current, enabled } : current
                        )
                      }
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Content>Queue enabled</Switch.Content>
                    </Switch>
                    <ActionButton
                      isPending={pendingAction === "saveQueue"}
                      onPress={saveQueue}
                      variant="primary"
                    >
                      Save Queue
                    </ActionButton>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
                  Select a queue to edit its settings.
                </div>
              )}
            </Tabs.Panel>

            <Tabs.Panel id="seasons" className="space-y-6">
              {selectedQueue ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field className="md:col-span-2" label="Season name">
                        <FieldInput
                          disabled={isPending}
                          placeholder="Spring 2v2"
                          value={seasonForm.name}
                          onChange={(value) =>
                            setSeasonForm((current) => ({
                              ...current,
                              name: value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Starts at">
                        <FieldDateTimePicker
                          disabled={isPending}
                          value={seasonForm.startsAt}
                          onChange={(value) =>
                            setSeasonForm((current) => ({
                              ...current,
                              startsAt: value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Duration">
                        <FieldSelect
                          disabled={isPending}
                          options={seasonPresetOptions.map((option) => ({
                            label: option.label,
                            value: option.key,
                          }))}
                          value={seasonForm.durationPreset}
                          onChange={(value) =>
                            setSeasonForm((current) => ({
                              ...current,
                              durationPreset: value,
                            }))
                          }
                        />
                      </Field>
                      {seasonForm.durationPreset === "custom" ? (
                        <Field label="Ends at">
                          <FieldDateTimePicker
                            disabled={isPending}
                            value={seasonForm.endsAt}
                            onChange={(value) =>
                              setSeasonForm((current) => ({
                                ...current,
                                endsAt: value,
                              }))
                            }
                          />
                        </Field>
                      ) : null}
                      <Field label="Initial status">
                        <FieldSelect
                          disabled={isPending}
                          options={seasonStatusOptions.map((option) => ({
                            label: option.label,
                            value: option.key,
                          }))}
                          value={seasonForm.status}
                          onChange={(value) =>
                            setSeasonForm((current) => ({
                              ...current,
                              status: value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Starting rating">
                        <FieldInput
                          disabled={isPending}
                          min={0}
                          type="number"
                          value={String(seasonForm.startingRating)}
                          onChange={(value) =>
                            setSeasonForm((current) => ({
                              ...current,
                              startingRating: Math.max(0, Number(value) || 0),
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <div className="flex items-end">
                      <ActionButton
                        isDisabled={
                          isPending || seasonForm.name.trim().length === 0
                        }
                        isPending={pendingAction === "createSeason"}
                        onPress={createSeason}
                        variant="primary"
                      >
                        Create Season
                      </ActionButton>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    {selectedQueueOverview?.seasons.length ? (
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#111111] text-xs tracking-[0.18em] text-white/40 uppercase">
                          <tr>
                            <th className="px-4 py-3 font-medium">Season</th>
                            <th className="px-4 py-3 font-medium">Window</th>
                            <th className="px-4 py-3 font-medium">
                              Start Rating
                            </th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 text-right font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedQueueOverview.seasons.map((season) => (
                            <tr
                              key={season.id}
                              className="border-t border-white/10"
                            >
                              <td className="px-4 py-4 font-medium">
                                {season.name}
                              </td>
                              <td className="px-4 py-4 text-white/60">
                                {new Date(season.startsAt).toLocaleString()}
                                <div className="mt-1 text-xs text-white/40">
                                  to {new Date(season.endsAt).toLocaleString()}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex min-w-48 items-center gap-2">
                                  <Input
                                    className="h-10 max-w-24 border-white/10 bg-transparent text-white"
                                    disabled={isPending}
                                    min={0}
                                    type="number"
                                    value={String(
                                      seasonDrafts[season.id]
                                        ?.startingRating ??
                                        season.startingRating
                                    )}
                                    onChange={(event) =>
                                      setSeasonDrafts((current) => ({
                                        ...current,
                                        [season.id]: {
                                          startingRating: Math.max(
                                            0,
                                            Number(event.target.value) || 0
                                          ),
                                        },
                                      }))
                                    }
                                  />
                                  <ActionButton
                                    isDisabled={isPending}
                                    isPending={
                                      pendingAction ===
                                      `updateSeason:${season.id}`
                                    }
                                    onPress={() =>
                                      updateSeasonStartingRating(season)
                                    }
                                    variant="outline"
                                  >
                                    Save
                                  </ActionButton>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <Chip color="accent" variant="soft">
                                  {season.status}
                                </Chip>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex justify-end gap-3">
                                  <ActionButton
                                    isDisabled={
                                      isPending || season.status === "active"
                                    }
                                    isPending={
                                      pendingAction ===
                                      `updateSeason:${season.id}`
                                    }
                                    onPress={() =>
                                      updateSeasonStatus(season.id, "active")
                                    }
                                    variant="secondary"
                                  >
                                    Set active
                                  </ActionButton>
                                  <ActionButton
                                    isDisabled={
                                      isPending || season.status === "completed"
                                    }
                                    isPending={
                                      pendingAction ===
                                      `updateSeason:${season.id}`
                                    }
                                    onPress={() =>
                                      updateSeasonStatus(season.id, "completed")
                                    }
                                    variant="outline"
                                  >
                                    Mark completed
                                  </ActionButton>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-4 py-5 text-sm text-white/55">
                        No seasons yet. Create one to enable queue-specific
                        seasonal pickup ratings.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
                  Select a queue to manage seasons.
                </div>
              )}
            </Tabs.Panel>

            <Tabs.Panel id="ranks" className="space-y-6">
              {selectedQueue ? (
                <>
                  <div>
                    <h3 className="text-lg font-medium">Queue Ranks</h3>
                    <p className="mt-1 text-sm text-white/60">
                      Ranks are queue-specific. Players stay Unranked until 10
                      rated placement games, then the highest active threshold
                      at or below their display rating is shown.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]">
                      <Field label="Title">
                        <FieldInput
                          disabled={isPending}
                          placeholder="Gold"
                          value={rankForm.title}
                          onChange={(value) =>
                            setRankForm((current) => ({
                              ...current,
                              title: value,
                            }))
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
                      <div className="flex items-end">
                        <ActionButton
                          isDisabled={
                            isPending || rankForm.title.trim().length === 0
                          }
                          isPending={pendingAction === "createRank"}
                          onPress={createRank}
                          variant="primary"
                        >
                          Create Rank
                        </ActionButton>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <Field label="Badge URL">
                        <FieldInput
                          disabled={isPending}
                          placeholder="https://..."
                          value={rankForm.badgeUrl}
                          onChange={(value) =>
                            setRankForm((current) => ({
                              ...current,
                              badgeUrl: value,
                            }))
                          }
                        />
                      </Field>
                      <div className="flex items-end gap-3">
                        <Switch
                          isDisabled={isPending}
                          isSelected={rankForm.active}
                          size="sm"
                          onChange={(active) =>
                            setRankForm((current) => ({
                              ...current,
                              active,
                            }))
                          }
                        >
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <Switch.Content>Active</Switch.Content>
                        </Switch>
                        <label className="inline-flex h-10 cursor-pointer items-center rounded-2xl border border-white/10 px-4 text-sm text-white/70 transition hover:bg-white/[0.04]">
                          Upload Badge
                          <input
                            accept="image/*"
                            className="sr-only"
                            disabled={isPending}
                            type="file"
                            onChange={(event) => {
                              uploadRankBadge(
                                "new",
                                rankForm.title,
                                event.currentTarget.files?.[0] ?? null
                              )
                              event.currentTarget.value = ""
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    {selectedQueueOverview?.ranks.length ? (
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#111111] text-xs tracking-[0.18em] text-white/40 uppercase">
                          <tr>
                            <th className="px-4 py-3 font-medium">Badge</th>
                            <th className="px-4 py-3 font-medium">Title</th>
                            <th className="px-4 py-3 font-medium">
                              Min Rating
                            </th>
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
                                  <div className="flex items-center gap-3">
                                    {draft.badgeUrl ? (
                                      <img
                                        alt=""
                                        className="size-10 rounded-lg border border-white/10 object-contain"
                                        src={draft.badgeUrl}
                                      />
                                    ) : (
                                      <div className="size-10 rounded-lg border border-dashed border-white/15" />
                                    )}
                                    <label className="inline-flex h-10 cursor-pointer items-center rounded-2xl border border-white/10 px-3 text-xs text-white/70 transition hover:bg-white/[0.04]">
                                      Upload
                                      <input
                                        accept="image/*"
                                        className="sr-only"
                                        disabled={isPending}
                                        type="file"
                                        onChange={(event) => {
                                          uploadRankBadge(
                                            rank.id,
                                            draft.title,
                                            event.currentTarget.files?.[0] ??
                                              null
                                          )
                                          event.currentTarget.value = ""
                                        }}
                                      />
                                    </label>
                                  </div>
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
                                  <Input
                                    className="mt-2 h-10 min-w-56 border-white/10 bg-transparent text-white/70"
                                    disabled={isPending}
                                    placeholder="Badge URL"
                                    value={draft.badgeUrl}
                                    onChange={(event) =>
                                      setRankDrafts((current) => ({
                                        ...current,
                                        [rank.id]: {
                                          ...draft,
                                          badgeUrl: event.target.value,
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
                                        pendingAction ===
                                        `updateRank:${rank.id}`
                                      }
                                      onPress={() => updateRank(rank)}
                                      variant="secondary"
                                    >
                                      Save
                                    </ActionButton>
                                    <ActionButton
                                      isDisabled={isPending}
                                      isPending={
                                        pendingAction ===
                                        `deleteRank:${rank.id}`
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
                    ) : (
                      <div className="px-4 py-5 text-sm text-white/55">
                        No ranks yet. Create the first threshold to start
                        revealing badges after placements.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
                  Select a queue to manage ranks.
                </div>
              )}
            </Tabs.Panel>

            <Tabs.Panel id="maps" className="space-y-6">
              {selectedQueue ? (
                <>
                  <div>
                    <h3 className="text-lg font-medium">Queue Map Pool</h3>
                    <p className="mt-1 text-sm text-white/60">
                      This queue owns its own map list. One map per line in the
                      format <code>mapKey|Label|1</code>.
                    </p>
                  </div>

                  <Field label="Maps">
                    <FieldTextArea
                      disabled={isPending}
                      minRows={16}
                      value={mapsText}
                      onChange={setMapsText}
                    />
                  </Field>

                  <div className="flex justify-end border-t border-white/10 pt-4">
                    <ActionButton
                      isPending={pendingAction === "saveMaps"}
                      onPress={saveMaps}
                      variant="primary"
                    >
                      Save Map Pool
                    </ActionButton>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
                  Select a queue to manage its map pool.
                </div>
              )}
            </Tabs.Panel>
          </Tabs>
        </div>
      </section>
    </div>
  )
}
