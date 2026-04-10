"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import type { PickupPlayer, PickupPlayerState } from "@/lib/pickup"
import { PlayerAvatar } from "@/components/pickup/player-avatar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { stripQuakeColors } from "@/lib/quake"

function QueueDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-end gap-0.5">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={`queue-dot-${index}`}
          animate={{ opacity: [0.32, 1, 0.32], y: [0, -1.5, 0] }}
          className="inline-block text-success-foreground"
          transition={{
            delay: index * 0.14,
            duration: 0.95,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
          }}
        >
          .
        </motion.span>
      ))}
    </span>
  )
}

function normalizeTooltipName(name: string) {
  const strippedName = stripQuakeColors(name).trim()
  return strippedName.length > 0 ? strippedName : "Unknown player"
}

export function PickupQueueStack({
  capacity,
  currentCount,
  onLeaveQueue,
  participants,
  stage,
}: {
  capacity: number | null
  currentCount: number | null
  onLeaveQueue?: (() => void) | null
  participants: Array<Pick<PickupPlayer, "avatarUrl" | "id" | "personaName">>
  player?: Pick<PickupPlayer, "avatarUrl" | "id" | "personaName">
  stage: PickupPlayerState["stage"] | null
}) {
  const uniqueParticipants = useMemo(() => {
    const seenIds = new Set<string>()
    const result: Array<
      Pick<PickupPlayer, "avatarUrl" | "id" | "personaName">
    > = []

    for (const participant of participants) {
      if (seenIds.has(participant.id)) {
        continue
      }

      seenIds.add(participant.id)
      result.push(participant)
    }

    return result
  }, [participants])
  const visibleParticipants = useMemo(
    () => uniqueParticipants.slice(-4),
    [uniqueParticipants]
  )
  const overflowCount = Math.max(
    uniqueParticipants.length - visibleParticipants.length,
    0
  )
  const isQueueStage = stage === "queue"
  const isStartedStage = stage === "ready_check"
  const participantCount = currentCount ?? uniqueParticipants.length
  const queueCapacity = capacity ?? participantCount
  const showBanner = isQueueStage || isStartedStage

  if (!showBanner) {
    return null
  }

  return (
    <div className="relative w-full max-w-[30rem]">
      <div className="pointer-events-none absolute inset-x-10 bottom-[-16px] h-8 rounded-full bg-success/70 opacity-70 blur-2xl" />
      <div className="relative h-11 w-full rounded-full border border-success-foreground/15 bg-success px-3 text-success-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
        <div className="absolute top-1/2 left-3 flex min-w-[6.25rem] -translate-y-1/2 items-center">
          <AnimatePresence initial={false} mode="popLayout">
            {visibleParticipants.map((participant, index) => (
              <Tooltip key={participant.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    layout
                    className="relative"
                    initial={{ opacity: 0, scale: 0.92, x: 14 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.94, x: -10 }}
                    style={{
                      marginLeft: index === 0 ? 0 : -8,
                      zIndex: visibleParticipants.length - index,
                    }}
                    transition={{
                      layout: {
                        type: "spring",
                        stiffness: 420,
                        damping: 32,
                        mass: 0.72,
                      },
                      opacity: { duration: 0.18, ease: "easeOut" },
                      scale: { duration: 0.2, ease: "easeOut" },
                      x: {
                        type: "spring",
                        stiffness: 420,
                        damping: 30,
                        mass: 0.7,
                      },
                    }}
                  >
                    <PlayerAvatar
                      avatarUrl={participant.avatarUrl}
                      className="border border-black/10 bg-black/12 ring-1 ring-black/10"
                      fallbackClassName="bg-black/14 text-success-foreground"
                      personaName={participant.personaName}
                      size="sm"
                    />
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {normalizeTooltipName(participant.personaName)}
                </TooltipContent>
              </Tooltip>
            ))}
          </AnimatePresence>
          {overflowCount > 0 ? (
            <motion.div
              layout
              className="relative ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black/14 px-1.5 text-[11px] font-semibold text-success-foreground/92 ring-1 ring-black/10"
            >
              +{overflowCount}
            </motion.div>
          ) : null}
        </div>

        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center px-20 text-sm font-semibold tracking-[0.01em] sm:px-24"
        >
          <AnimatePresence mode="wait">
            {isQueueStage ? (
              <motion.span
                key="queue-copy"
                animate={{
                  clipPath: "inset(0% 0% 0% 0%)",
                  filter: "blur(0px)",
                  opacity: 1,
                  rotateX: 0,
                  y: 0,
                }}
                className="relative inline-flex max-w-full items-center"
                exit={{
                  clipPath: "inset(0% 0% 100% 0%)",
                  filter: "blur(4px)",
                  opacity: 0,
                  rotateX: 82,
                  y: 10,
                }}
                initial={{
                  clipPath: "inset(100% 0% 0% 0%)",
                  filter: "blur(6px)",
                  opacity: 0,
                  rotateX: -82,
                  y: -16,
                }}
                style={{ transformPerspective: 1000 }}
                transition={{
                  clipPath: {
                    duration: 0.34,
                    ease: [0.22, 0.61, 0.36, 1],
                  },
                  filter: { duration: 0.24, ease: "easeOut" },
                  opacity: { duration: 0.2, ease: "easeOut" },
                  rotateX: {
                    type: "spring",
                    stiffness: 340,
                    damping: 26,
                    mass: 0.82,
                  },
                  y: {
                    type: "spring",
                    stiffness: 360,
                    damping: 28,
                    mass: 0.78,
                  },
                }}
              >
                <motion.span
                  animate={{
                    backgroundPositionX: ["160%", "-80%"],
                  }}
                  className="truncate bg-[length:220%_100%] bg-clip-text text-transparent"
                  style={{
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundImage:
                      "linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) 38%, rgba(255,255,255,0.56) 48%, rgba(255,255,255,1) 56%, rgba(255,255,255,0.92) 66%, rgba(255,255,255,0.92) 100%)",
                  }}
                  transition={{
                    duration: 1.9,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: 1.1,
                  }}
                >
                  Looking for a match
                </motion.span>
                <span className="ml-0.5">
                  <QueueDots />
                </span>
              </motion.span>
            ) : (
              <motion.span
                key="started-copy"
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex max-w-full items-center bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(255,255,255,0.82))] bg-clip-text text-transparent"
                exit={{ opacity: 0, y: -8 }}
                initial={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                Pickup started!
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {isQueueStage ? (
          <div className="absolute top-1/2 right-2 -translate-y-1/2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={`Leave queue. ${participantCount}/${queueCapacity} players in queue.`}
                  className="size-7 rounded-full border border-transparent bg-black/14 text-success-foreground shadow-none hover:bg-black/22 hover:text-success-foreground"
                  onClick={onLeaveQueue ?? undefined}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Leave queue</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </div>
    </div>
  )
}
