"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ActionButton,
  Field,
  FieldDateTimePicker,
  FieldInput,
  FieldSelect,
  FieldTextArea,
} from "@/components/pickup-admin-fields";
import {
  Button,
  Chip,
  Modal,
  Switch,
  Tabs,
  toast,
  useOverlayState,
} from "@/components/pickup-admin-ui";
import { requestJson } from "@/lib/client/request-json";
import type {
  PickupAdminOverviewDto,
  PickupMapPoolDto,
  PickupQueueDto,
  PickupSeasonDto,
} from "@/lib/server/pickup";

type PendingAction =
  | "createQueue"
  | "createSeason"
  | "saveMaps"
  | "saveQueue"
  | `updateSeason:${string}`
  | null;

type SeasonFormState = {
  durationPreset: "one_month" | "three_month" | "custom";
  endsAt: string;
  name: string;
  startsAt: string;
  status: "draft" | "active" | "completed";
};

function formatDateTimeInput(value: string) {
  return value.slice(0, 16);
}

function createDefaultSeasonForm(): SeasonFormState {
  return {
    durationPreset: "one_month",
    endsAt: "",
    name: "",
    startsAt: formatDateTimeInput(new Date().toISOString()),
    status: "draft",
  };
}

function createQueueForm(queue: PickupQueueDto) {
  return {
    description: queue.description ?? "",
    enabled: queue.enabled,
    name: queue.name,
    playerCount: queue.playerCount,
    teamSize: queue.teamSize,
  };
}

function createMapsText(maps: PickupMapPoolDto[]) {
  return maps
    .map((map) => `${map.mapKey}|${map.label}|${map.active ? "1" : "0"}`)
    .join("\n");
}

const seasonPresetOptions = [
  { key: "one_month", label: "1 month" },
  { key: "three_month", label: "3 months" },
  { key: "custom", label: "Custom" },
] as const;

const seasonStatusOptions = [
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
] as const;

export function PickupAdminDashboard({
  initialOverview,
}: {
  initialOverview: PickupAdminOverviewDto;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [selectedQueueId, setSelectedQueueId] = useState(
    initialOverview.queues[0]?.queue.id ?? "",
  );
  const [adminTab, setAdminTab] = useState("settings");
  const [queueForm, setQueueForm] = useState(
    initialOverview.queues[0] ? createQueueForm(initialOverview.queues[0].queue) : null,
  );
  const [seasonForm, setSeasonForm] = useState(createDefaultSeasonForm());
  const [mapsText, setMapsText] = useState(
    initialOverview.queues[0] ? createMapsText(initialOverview.queues[0].maps) : "",
  );
  const [newQueueForm, setNewQueueForm] = useState({
    description: "",
    enabled: true,
    name: "",
    playerCount: 8,
    teamSize: 4,
  });
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const createQueueModal = useOverlayState();

  const selectedQueueOverview = useMemo(
    () =>
      overview.queues.find((entry) => entry.queue.id === selectedQueueId) ??
      overview.queues[0] ??
      null,
    [overview.queues, selectedQueueId],
  );

  const selectedQueue = selectedQueueOverview?.queue ?? null;
  const isPending = pendingAction !== null;

  useEffect(() => {
    if (!overview.queues.length) {
      if (selectedQueueId) {
        setSelectedQueueId("");
      }

      return;
    }

    if (!selectedQueueOverview) {
      setSelectedQueueId(overview.queues[0]!.queue.id);
    }
  }, [overview.queues, selectedQueueId, selectedQueueOverview]);

  useEffect(() => {
    if (!selectedQueueOverview) {
      setQueueForm(null);
      setMapsText("");
      return;
    }

    setQueueForm(createQueueForm(selectedQueueOverview.queue));
    setMapsText(createMapsText(selectedQueueOverview.maps));
    setSeasonForm(createDefaultSeasonForm());
  }, [selectedQueueOverview]);

  const runAction = async (action: Exclude<PendingAction, null>, callback: () => Promise<void>) => {
    setPendingAction(action);
    try {
      await callback();
    } finally {
      setPendingAction((current) => (current === action ? null : current));
    }
  };

  const patchQueueOverview = (
    queueId: string,
    updater: (
      entry: PickupAdminOverviewDto["queues"][number],
    ) => PickupAdminOverviewDto["queues"][number],
  ) => {
    setOverview((current) => ({
      ...current,
      queues: current.queues.map((entry) => (entry.queue.id === queueId ? updater(entry) : entry)),
    }));
  };

  const selectQueue = (entry: PickupAdminOverviewDto["queues"][number]) => {
    setSelectedQueueId(entry.queue.id);
    setQueueForm(createQueueForm(entry.queue));
    setMapsText(createMapsText(entry.maps));
    setSeasonForm(createDefaultSeasonForm());
  };

  const createQueue = () => {
    void runAction("createQueue", async () => {
      try {
        const payload = await requestJson<{ queue: PickupQueueDto }>(
          "/api/pickup/admin/queues",
          {
            body: JSON.stringify(newQueueForm),
            method: "POST",
          },
        );

        const nextEntry = {
          activeSeason: null,
          maps: [],
          queue: payload.queue,
          seasons: [],
        };

        setOverview((current) => ({
          ...current,
          queues: [...current.queues, nextEntry].sort((left, right) =>
            left.queue.name.localeCompare(right.queue.name),
          ),
        }));
        setSelectedQueueId(payload.queue.id);
        setAdminTab("settings");
        createQueueModal.close();
        setNewQueueForm({
          description: "",
          enabled: true,
          name: "",
          playerCount: 8,
          teamSize: 4,
        });
        toast.success("Queue created.");
      } catch (error) {
        toast.danger("Queue creation failed.", {
          description: error instanceof Error ? error.message : "Request failed.",
        });
      }
    });
  };

  const saveQueue = () => {
    if (!selectedQueue || !queueForm) {
      return;
    }

    void runAction("saveQueue", async () => {
      try {
        const payload = await requestJson<{ queue: PickupQueueDto }>(
          `/api/pickup/admin/queues/${encodeURIComponent(selectedQueue.id)}`,
          {
            body: JSON.stringify(queueForm),
            method: "PATCH",
          },
        );

        patchQueueOverview(selectedQueue.id, (entry) => ({
          ...entry,
          queue: payload.queue,
        }));
        toast.success("Queue settings saved.");
      } catch (error) {
        toast.danger("Queue settings failed.", {
          description: error instanceof Error ? error.message : "Request failed.",
        });
      }
    });
  };

  const saveMaps = () => {
    if (!selectedQueue) {
      return;
    }

    void runAction("saveMaps", async () => {
      try {
        const maps = mapsText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line, index) => {
            const [mapKey, label, active] = line.split("|").map((part) => part.trim());
            return {
              active: active !== "0",
              label: label || mapKey,
              mapKey,
              sortOrder: index,
            };
          });

        const payload = await requestJson<{ maps: PickupMapPoolDto[] }>(
          `/api/pickup/admin/queues/${encodeURIComponent(selectedQueue.id)}/maps`,
          {
            body: JSON.stringify({ maps }),
            method: "PUT",
          },
        );

        patchQueueOverview(selectedQueue.id, (entry) => ({
          ...entry,
          maps: payload.maps,
        }));
        toast.success("Map pool saved.");
      } catch (error) {
        toast.danger("Map pool save failed.", {
          description: error instanceof Error ? error.message : "Request failed.",
        });
      }
    });
  };

  const createSeason = () => {
    if (!selectedQueue) {
      return;
    }

    void runAction("createSeason", async () => {
      try {
        const payload = await requestJson<{ season: PickupSeasonDto }>(
          "/api/pickup/admin/seasons",
          {
            body: JSON.stringify({
              ...seasonForm,
              endsAt: seasonForm.endsAt ? new Date(seasonForm.endsAt).toISOString() : undefined,
              queueId: selectedQueue.id,
              startsAt: new Date(seasonForm.startsAt).toISOString(),
            }),
            method: "POST",
          },
        );

        patchQueueOverview(selectedQueue.id, (entry) => {
          const seasons = [payload.season, ...entry.seasons].sort((left, right) =>
            right.startsAt.localeCompare(left.startsAt),
          );

          return {
            ...entry,
            activeSeason: seasons.find((season) => season.status === "active") ?? null,
            seasons,
          };
        });
        setSeasonForm(createDefaultSeasonForm());
        toast.success("Season created.");
      } catch (error) {
        toast.danger("Season creation failed.", {
          description: error instanceof Error ? error.message : "Request failed.",
        });
      }
    });
  };

  const updateSeasonStatus = (seasonId: string, status: PickupSeasonDto["status"]) => {
    if (!selectedQueue) {
      return;
    }

    void runAction(`updateSeason:${seasonId}`, async () => {
      try {
        const payload = await requestJson<{ season: PickupSeasonDto }>(
          `/api/pickup/admin/seasons/${encodeURIComponent(seasonId)}`,
          {
            body: JSON.stringify({ status }),
            method: "PATCH",
          },
        );

        patchQueueOverview(selectedQueue.id, (entry) => {
          const seasons = entry.seasons.map((season) =>
            season.id === seasonId
              ? payload.season
              : status === "active" && season.status === "active"
                ? { ...season, status: "completed" as const }
                : season,
          );

          return {
            ...entry,
            activeSeason: seasons.find((season) => season.status === "active") ?? null,
            seasons,
          };
        });
        toast.success("Season updated.");
      } catch (error) {
        toast.danger("Season update failed.", {
          description: error instanceof Error ? error.message : "Request failed.",
        });
      }
    });
  };

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
            <Button className="h-11" variant="secondary">Create Queue</Button>
          </Modal.Trigger>
          <Modal.Backdrop>
            <Modal.Container placement="center" size="lg">
              <Modal.Dialog>
                <Modal.Header className="border-b border-white/10 px-6 py-4">
                  <div>
                    <Modal.Heading className="text-xl font-medium">Create Queue</Modal.Heading>
                    <p className="mt-1 text-sm text-white/60">
                      Add new queue formats like 2v2 CA, each with its own map pool, season
                      timeline, and seasonal rating ladder. Shared timers and provision settings
                      stay global.
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
                          const teamSize = Math.max(1, Number(value) || 1);
                          setNewQueueForm((current) => ({
                            ...current,
                            playerCount: teamSize * 2,
                            teamSize,
                          }));
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
                          setNewQueueForm((current) => ({ ...current, description: value }))
                        }
                      />
                    </Field>
                  </div>
                </Modal.Body>
                <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" onPress={createQueueModal.close}>
                      Cancel
                    </Button>
                    <ActionButton
                      isDisabled={isPending || newQueueForm.name.trim().length === 0}
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
            <thead className="bg-[#111111] text-xs uppercase tracking-[0.18em] text-white/40">
              <tr>
                <th className="px-6 py-3 font-medium">Queue</th>
                <th className="px-6 py-3 font-medium">Format</th>
                <th className="px-6 py-3 font-medium">Season</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {overview.queues.map((entry) => {
                const isSelected = entry.queue.id === selectedQueueId;

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
                        event.preventDefault();
                        selectQueue(entry);
                      }
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex w-full flex-col text-left">
                        <span className="font-medium text-white">{entry.queue.name}</span>
                        <span className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
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
                      <Chip color={entry.queue.enabled ? "accent" : "default"} variant="soft">
                        {entry.queue.enabled ? "Enabled" : "Disabled"}
                      </Chip>
                    </td>
                  </tr>
                );
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
                Manage queue-specific fields here. Shared timers and server provisioning settings
                live on the separate shared settings page.
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
                            current ? { ...current, name: value } : current,
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
                            current ? { ...current, description: value } : current,
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
                          const teamSize = Math.max(1, Number(value) || 1);
                          setQueueForm((current) =>
                            current
                              ? { ...current, playerCount: teamSize * 2, teamSize }
                              : current,
                          );
                        }}
                      />
                    </Field>
                    <Field label="Player count">
                      <FieldInput disabled type="number" value={String(queueForm.playerCount)} onChange={() => {}} />
                    </Field>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <Switch
                      isDisabled={isPending}
                      isSelected={queueForm.enabled}
                      size="sm"
                      onChange={(enabled) =>
                        setQueueForm((current) =>
                          current ? { ...current, enabled } : current,
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
                            setSeasonForm((current) => ({ ...current, name: value }))
                          }
                        />
                      </Field>
                      <Field label="Starts at">
                        <FieldDateTimePicker
                          disabled={isPending}
                          value={seasonForm.startsAt}
                          onChange={(value) =>
                            setSeasonForm((current) => ({ ...current, startsAt: value }))
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
                              setSeasonForm((current) => ({ ...current, endsAt: value }))
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
                    </div>

                    <div className="flex items-end">
                      <ActionButton
                        isDisabled={isPending || seasonForm.name.trim().length === 0}
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
                        <thead className="bg-[#111111] text-xs uppercase tracking-[0.18em] text-white/40">
                          <tr>
                            <th className="px-4 py-3 font-medium">Season</th>
                            <th className="px-4 py-3 font-medium">Window</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedQueueOverview.seasons.map((season) => (
                            <tr key={season.id} className="border-t border-white/10">
                              <td className="px-4 py-4 font-medium">{season.name}</td>
                              <td className="px-4 py-4 text-white/60">
                                {new Date(season.startsAt).toLocaleString()}
                                <div className="mt-1 text-xs text-white/40">
                                  to {new Date(season.endsAt).toLocaleString()}
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
                                    isDisabled={isPending || season.status === "active"}
                                    isPending={pendingAction === `updateSeason:${season.id}`}
                                    onPress={() => updateSeasonStatus(season.id, "active")}
                                    variant="secondary"
                                  >
                                    Set active
                                  </ActionButton>
                                  <ActionButton
                                    isDisabled={isPending || season.status === "completed"}
                                    isPending={pendingAction === `updateSeason:${season.id}`}
                                    onPress={() => updateSeasonStatus(season.id, "completed")}
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
                        No seasons yet. Create one to enable queue-specific seasonal pickup ratings.
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

            <Tabs.Panel id="maps" className="space-y-6">
              {selectedQueue ? (
                <>
                  <div>
                    <h3 className="text-lg font-medium">Queue Map Pool</h3>
                    <p className="mt-1 text-sm text-white/60">
                      This queue owns its own map list. One map per line in the format{" "}
                      <code>mapKey|Label|1</code>.
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
  );
}
