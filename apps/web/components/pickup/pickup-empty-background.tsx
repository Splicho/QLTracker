import { ChevronDown } from "lucide-react"
import { Play, Spinner, Steam } from "@/components/icon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { PickupPlayerLock, PickupQueueSummary } from "@/lib/pickup"

const pickupQueueGroupLabels: Record<string, string> = {
  ca: "Clan Arena",
  ctf: "Capture the Flag",
  duel: "Duel",
  ffa: "Free For All",
  tdm: "Team Deathmatch",
}

function buildQueueGroups(queues: PickupQueueSummary[]) {
  const groups = new Map<
    string,
    Array<{ label: string; queue: PickupQueueSummary }>
  >()

  for (const queue of queues) {
    const segments = queue.name.trim().split(/\s+/).filter(Boolean)
    const label = segments[0] ?? queue.name
    const rawGroupName =
      segments.length > 1 ? segments.slice(1).join(" ") : "Queues"
    const normalizedGroupKey = rawGroupName.trim().toLowerCase()
    const groupName = pickupQueueGroupLabels[normalizedGroupKey] ?? rawGroupName
    const group = groups.get(groupName)

    if (group) {
      group.push({ label, queue })
      continue
    }

    groups.set(groupName, [{ label, queue }])
  }

  return Array.from(groups.entries()).map(([name, entries]) => ({
    entries,
    name,
  }))
}

function formatPickupLockUntil(lock: PickupPlayerLock) {
  if (!lock.expiresAt) {
    return "permanently"
  }

  const expiresAt = new Date(lock.expiresAt)

  if (Number.isNaN(expiresAt.getTime())) {
    return "temporarily"
  }

  return `until ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAt)}`
}

export function PickupEmptyBackground({
  activeLock,
  guestMode,
  isQueued,
  onConnectWithSteam,
  onJoinQueue,
  queues,
  selectedQueue,
}: {
  activeLock?: PickupPlayerLock | null
  guestMode: boolean
  isQueued: boolean
  onConnectWithSteam: () => void
  onJoinQueue: (queue: PickupQueueSummary) => void
  queues: PickupQueueSummary[]
  selectedQueue: PickupQueueSummary | null
}) {
  const enabledQueues = queues.filter((queue) => queue.enabled)
  const groupedQueues = buildQueueGroups(enabledQueues)
  const lockReason = activeLock?.reason?.trim()

  return (
    <div className="relative h-[26rem] w-full overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-90"
        style={{
          backgroundImage: "url(/images/pickup-bg.jpg)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/20 to-background" />
      <div className="relative z-10 flex h-full items-center justify-center px-8 text-center sm:px-10">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Step into the next match.
          </h1>
          <p className="mt-3 text-sm leading-7 text-foreground/72 sm:text-base">
            Queue up, lock in, and launch straight into balanced Clan Arena
            matches the moment the lobby is ready.
          </p>
          <div className="mt-8 flex justify-center">
            {guestMode ? (
              <Button
                className="!h-14 gap-2 px-8 text-lg"
                onClick={onConnectWithSteam}
                size="lg"
              >
                <Steam data-icon="inline-start" />
                Continue with Steam
              </Button>
            ) : activeLock ? (
              <div
                className="max-w-xl rounded-xl border border-orange-500/45 bg-orange-500/10 px-5 py-4 text-left shadow-[0_0_30px_color-mix(in_oklch,var(--color-orange-500)_14%,transparent)]"
                role="alert"
              >
                <p className="text-sm font-semibold text-foreground">
                  You have been locked from matchmaking{" "}
                  {formatPickupLockUntil(activeLock)}.
                </p>
                {lockReason ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reason: {lockReason}
                  </p>
                ) : null}
              </div>
            ) : isQueued ? (
              <Button
                className="!h-14 gap-2 bg-success px-8 text-lg text-success-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--color-success)_28%,transparent)]"
                disabled
                size="lg"
              >
                <Spinner data-icon="inline-start" />
                In Queue
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="!h-14 cursor-pointer gap-2 bg-success px-8 text-lg text-success-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--color-success)_28%,transparent)] hover:bg-success-hover hover:shadow-[0_0_34px_color-mix(in_oklch,var(--color-success-hover)_34%,transparent)]"
                    size="lg"
                  >
                    <Play data-icon="inline-start" />
                    Play
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="w-48 overflow-hidden"
                >
                  {groupedQueues.map((group) =>
                    group.entries.length === 1 ? (
                      <DropdownMenuItem
                        className="cursor-pointer justify-between gap-4"
                        key={group.entries[0].queue.id}
                        onClick={() => onJoinQueue(group.entries[0].queue)}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Play className="size-4" />
                          {group.entries[0].queue.name}
                        </span>
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border/70 bg-muted px-2 text-xs leading-none">
                          {group.entries[0].queue.currentPlayers}/
                          {group.entries[0].queue.playerCount}
                        </span>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuSub key={group.name}>
                        <DropdownMenuSubTrigger className="w-full cursor-pointer">
                          {group.name}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48 overflow-hidden">
                          {group.entries.map((entry) => (
                            <DropdownMenuItem
                              className="cursor-pointer justify-between gap-4"
                              key={entry.queue.id}
                              onClick={() => onJoinQueue(entry.queue)}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Play className="size-4" />
                                {entry.label}
                              </span>
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border/70 bg-muted px-2 text-xs leading-none">
                                {entry.queue.currentPlayers}/
                                {entry.queue.playerCount}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )
                  )}
                  {enabledQueues.length === 0 && selectedQueue ? (
                    <DropdownMenuItem
                      className="cursor-pointer justify-between gap-4"
                      onClick={() => onJoinQueue(selectedQueue)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Play className="size-4" />
                        {selectedQueue.name}
                      </span>
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border/70 bg-muted px-2 text-xs leading-none">
                        {selectedQueue.currentPlayers}/
                        {selectedQueue.playerCount}
                      </span>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
