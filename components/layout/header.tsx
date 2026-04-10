"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LoaderCircle, LogOut, Settings } from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  PickupPlayer,
  PickupPlayerState,
  PickupSeasonalRating,
} from "@/lib/pickup";
import { Medal, Steam } from "@/components/icon";
import { PlayerAvatar } from "@/components/pickup/player-avatar";
import { PlayerName } from "@/components/pickup/player-name";
import { PickupQueueStack } from "@/components/pickup/pickup-queue-stack";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

function sortSeasonalRatings(ratings: PickupSeasonalRating[]) {
  return [...ratings].sort((left, right) => {
    if (right.displayRating !== left.displayRating) {
      return right.displayRating - left.displayRating;
    }

    return left.queueName.localeCompare(right.queueName);
  });
}

function SeasonalRatingsMenu({
  ratings,
}: {
  ratings: PickupSeasonalRating[];
}) {
  const router = useRouter();
  const sortedRatings = useMemo(() => sortSeasonalRatings(ratings), [ratings]);
  const highestRating = sortedRatings[0];

  if (!highestRating) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-10 rounded-full px-3" variant="outline">
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Medal className="size-3.5 text-amber-400" />
              {highestRating.displayRating}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Seasonal Ratings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-1 p-1">
          {sortedRatings.map((rating) => (
            <button
              key={`${rating.seasonId}:${rating.queueId}`}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
              onClick={() => router.push("/leaderboards")}
              type="button"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {rating.queueName}
              </span>
              <Badge
                className="h-6 shrink-0 rounded-md border-border/70 bg-muted px-2 text-xs font-semibold text-foreground"
                variant="outline"
              >
                <Medal className="size-3.5 text-amber-400" />
                {rating.displayRating}
              </Badge>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PickupHeaderMenu({
  onSignOut,
  player,
}: {
  onSignOut: () => void;
  player: PickupPlayer;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-10 rounded-full px-2" variant="outline">
          <span className="flex items-center gap-1.5">
            <PlayerAvatar
              avatarUrl={player.avatarUrl}
              personaName={player.personaName}
              size="sm"
            />
            <ChevronDown className="size-4 text-muted-foreground" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="p-1">
          <button
            className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50"
            onClick={() => router.push(`/players/${player.steamId}`)}
            type="button"
          >
            <PlayerAvatar
              avatarUrl={player.avatarUrl}
              personaName={player.personaName}
              size="lg"
            />
            <div className="min-w-0">
              <PlayerName
                className="truncate"
                country
                countryCode={player.countryCode}
                personaName={player.personaName}
              />
            </div>
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onClick={() => router.push("/settings/profile")}
        >
          <Settings className="size-4" />
          Profile settings
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2" onClick={onSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({
  breadcrumbParent,
  pageTitle,
  pickupLinking,
  pickupStackCapacity,
  pickupStackCount,
  pickupStackPlayers,
  onPickupLeaveQueue,
  pickupStage,
  onPickupLogin,
  onPickupSignOut,
  pickupPlayer,
  pickupRatings,
}: {
  breadcrumbParent?: string | null;
  pageTitle: string;
  pickupLinking?: boolean;
  pickupStackCapacity?: number | null;
  pickupStackCount?: number | null;
  pickupStackPlayers?: Array<
    Pick<PickupPlayer, "avatarUrl" | "id" | "personaName">
  >;
  onPickupLeaveQueue?: (() => void) | null;
  pickupStage?: PickupPlayerState["stage"] | null;
  onPickupLogin?: (() => void) | null;
  onPickupSignOut?: (() => void) | null;
  pickupPlayer?: PickupPlayer | null;
  pickupRatings?: PickupSeasonalRating[];
}) {
  const showQueueBanner =
    pickupPlayer != null &&
    (pickupStage === "queue" || pickupStage === "ready_check");

  return (
    <header className="relative flex h-16 items-center gap-3 border-b border-border px-4">
      <div className="relative z-20 flex min-w-0 items-center gap-3">
        <SidebarTrigger />
        <Separator className="h-4" orientation="vertical" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbParent ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbPage>{breadcrumbParent}</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="relative z-20 ml-auto flex items-center gap-3">
        {!pickupPlayer && onPickupLogin ? (
          <Button
            className="gap-2"
            disabled={pickupLinking}
            onClick={onPickupLogin}
            type="button"
          >
            {pickupLinking ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Steam className="size-4" />
            )}
            {pickupLinking ? "Opening Steam sign-in..." : "Login with Steam"}
          </Button>
        ) : null}
        {pickupPlayer && pickupRatings && pickupRatings.length > 0 ? (
          <SeasonalRatingsMenu ratings={pickupRatings} />
        ) : null}
        {pickupPlayer && onPickupSignOut ? (
          <PickupHeaderMenu
            onSignOut={onPickupSignOut}
            player={pickupPlayer}
          />
        ) : null}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {showQueueBanner ? (
          <motion.div
            key="queue-banner"
            animate={{ filter: "blur(0px)", opacity: 1, rotateX: 0, y: 0 }}
            className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-4 sm:px-24"
            exit={{ filter: "blur(4px)", opacity: 0, rotateX: -54, y: 12 }}
            initial={{ filter: "blur(4px)", opacity: 0, rotateX: 72, y: -16 }}
            style={{ transformPerspective: 1200 }}
            transition={{
              delay: 0.04,
              filter: { duration: 0.18, ease: "easeOut" },
              opacity: { duration: 0.2, ease: "easeOut" },
              rotateX: { duration: 0.28, ease: [0.22, 0.61, 0.36, 1] },
              y: { duration: 0.28, ease: [0.22, 0.61, 0.36, 1] },
            }}
          >
            <div className="pointer-events-auto w-full max-w-[30rem]">
              <PickupQueueStack
                capacity={pickupStackCapacity ?? null}
                currentCount={pickupStackCount ?? null}
                onLeaveQueue={onPickupLeaveQueue ?? null}
                participants={pickupStackPlayers ?? []}
                stage={pickupStage ?? null}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
