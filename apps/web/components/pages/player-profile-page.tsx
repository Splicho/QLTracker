import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUpRight, CoverImage, GameController } from "@/components/icon"
import { CropImageDialog } from "@/components/profile/crop-image"
import { ManageCoverModal } from "@/components/profile/manage-cover-modal"
import { PlayerProfileMatchesPane } from "@/components/profile/player-profile-matches-pane"
import { PlayerProfileOverviewPane } from "@/components/profile/player-profile-overview-pane"
import { PlayerProfileStatsPane } from "@/components/profile/player-profile-stats-pane"
import { UploadCoverModal } from "@/components/profile/upload-cover-modal"
import { PlayerAvatar } from "@/components/pickup/player-avatar"
import { PlayerName } from "@/components/pickup/player-name"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useImageUploadFlow } from "@/hooks/use-image-upload-flow"
import { useRealtimePlayerPresence } from "@/hooks/use-realtime-player-presence"
import { useMutation } from "@tanstack/react-query"
import {
  fetchPickupPlayerProfile,
  isPickupApiConfigured,
  type PickupPlayerProfile,
  updatePickupProfileMedia,
  uploadPickupProfileImage,
} from "@/lib/pickup"
import { stripQuakeColors } from "@/lib/quake"
import { createFallbackServerFromPresence } from "@/lib/server-utils"
import type { ServerInteractionContext } from "@/hooks/use-server-interactions"
import type { SteamServer } from "@/lib/steam"

const pickupCoverCropFileName = "pickup-cover.webp"
const pickupAvatarCropFileName = "pickup-avatar.webp"

function LoadingState() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="h-40 border-b border-border bg-muted/40" />
      <div className="flex-1 p-6">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>
    </section>
  )
}

function getProfileErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unexpected pickup profile error."
}

export function PlayerProfilePage({
  currentPlayerId,
  initialData,
  onOpenMatch,
  onOpenServer,
  onProfileNameChange,
  playerId,
  sessionToken,
  servers,
}: {
  currentPlayerId: string | null
  initialData?: PickupPlayerProfile
  onOpenMatch: (matchId: string) => void
  onOpenServer: (context: ServerInteractionContext) => void
  onProfileNameChange?: (name: string | null) => void
  playerId: string | null
  sessionToken: string
  servers: SteamServer[]
}) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("overview")
  const profileQuery = useQuery({
    queryKey: ["pickup", "player-profile", playerId],
    queryFn: () => fetchPickupPlayerProfile(playerId!),
    enabled: isPickupApiConfigured() && Boolean(playerId),
    initialData,
    staleTime: 30_000,
  })
  const profile = profileQuery.data ?? null
  const player = profile?.player ?? null
  const coverProfilePlayerId = player?.id ?? playerId ?? ""
  const meQueryKey = ["pickup", "me", sessionToken] as const

  useEffect(() => {
    if (!player) {
      onProfileNameChange?.(null)
      return
    }

    onProfileNameChange?.(stripQuakeColors(player.personaName))

    return () => {
      onProfileNameChange?.(null)
    }
  }, [onProfileNameChange, player])

  const playerPresence = useRealtimePlayerPresence(
    player?.steamId ?? null,
    true
  )
  const activeServer = useMemo(() => {
    if (!playerPresence.presence) {
      return null
    }

    return (
      servers.find((server) => server.addr === playerPresence.presence?.addr) ??
      createFallbackServerFromPresence(playerPresence.presence)
    )
  }, [playerPresence.presence, servers])

  const canEditCover =
    Boolean(player) &&
    Boolean(sessionToken.trim()) &&
    Boolean(currentPlayerId) &&
    currentPlayerId === player?.id
  const coverUpload = useImageUploadFlow({
    errorMessage: "Cover upload failed.",
    onUpload: async (file) => {
      const uploaded = await uploadPickupProfileImage(
        sessionToken,
        "cover",
        file
      )
      await updatePickupProfileMedia(sessionToken, {
        customCoverUrl: uploaded.url,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pickup", "player-profile", coverProfilePlayerId],
        }),
        queryClient.invalidateQueries({
          queryKey: meQueryKey,
        }),
      ])
    },
    successMessage: "Profile cover updated.",
  })
  const deleteCoverMutation = useMutation({
    mutationFn: async () => {
      await updatePickupProfileMedia(sessionToken, {
        customCoverUrl: null,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pickup", "player-profile", coverProfilePlayerId],
        }),
        queryClient.invalidateQueries({
          queryKey: meQueryKey,
        }),
      ])
    },
  })
  const avatarUpload = useImageUploadFlow({
    errorMessage: "Avatar upload failed.",
    onUpload: async (file) => {
      const uploaded = await uploadPickupProfileImage(
        sessionToken,
        "avatar",
        file
      )
      await updatePickupProfileMedia(sessionToken, {
        customAvatarUrl: uploaded.url,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pickup", "player-profile", coverProfilePlayerId],
        }),
        queryClient.invalidateQueries({
          queryKey: meQueryKey,
        }),
      ])
    },
    successMessage: "Profile avatar updated.",
  })

  if (!playerId) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">
            Player profile is unavailable
          </p>
        </div>
      </section>
    )
  }

  if (!isPickupApiConfigured()) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">
            Profiles are unavailable
          </p>
          <p className="text-sm text-muted-foreground">
            Set <code className="font-mono">VITE_PICKUP_API_URL</code> to load
            pickup player profiles.
          </p>
        </div>
      </section>
    )
  }

  if (profileQuery.isPending) {
    return <LoadingState />
  }

  if (profileQuery.isError || !profile) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">
            Profile could not be loaded
          </p>
          <p className="text-sm text-muted-foreground">
            {getProfileErrorMessage(profileQuery.error)}
          </p>
        </div>
      </section>
    )
  }
  if (!player) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">
            Profile could not be loaded
          </p>
          <p className="text-sm text-muted-foreground">
            Unexpected pickup profile error.
          </p>
        </div>
      </section>
    )
  }
  const resolvedPlayer = player
  const bestActiveRank =
    [...profile.ratings]
      .filter((rating) => rating.isPlaced && rating.rank)
      .sort((left, right) => right.displayRating - left.displayRating)[0]
      ?.rank ?? null

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative">
        <div
          className="group/cover relative h-44 border-b border-border bg-muted/40"
          style={
            resolvedPlayer.coverImageUrl
              ? {
                  backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.45)), url(${resolvedPlayer.coverImageUrl})`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }
              : undefined
          }
        >
          {canEditCover ? (
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
                resolvedPlayer.coverImageUrl
                  ? "opacity-0 group-hover/cover:opacity-100"
                  : "opacity-100"
              }`}
            >
              <Button
                className="cursor-pointer gap-2 rounded-lg border border-white/15 bg-background/90 text-foreground hover:bg-background"
                onClick={
                  resolvedPlayer.coverImageUrl
                    ? coverUpload.openManageModal
                    : coverUpload.openUploadModal
                }
                type="button"
                variant="secondary"
              >
                <CoverImage className="size-4" />
                {resolvedPlayer.coverImageUrl ? "Change cover" : "Set cover"}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="absolute bottom-0 left-6 flex translate-y-1/2 items-end gap-4">
          <div className="group/avatar relative">
            <PlayerAvatar
              avatarUrl={resolvedPlayer.avatarUrl}
              className="size-24 rounded-md border-4 border-background shadow-lg"
              fallbackClassName="rounded-[calc(var(--radius-md)-2px)] text-xl font-semibold"
              personaName={resolvedPlayer.personaName}
            />
            {canEditCover ? (
              <button
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-black/45 text-white opacity-0 transition-opacity group-hover/avatar:opacity-100"
                onClick={avatarUpload.openUploadModal}
                type="button"
              >
                <CoverImage className="size-5" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-1 pb-3">
            <PlayerName
              className="gap-3 text-2xl font-semibold text-foreground"
              country
              countryClassName="h-5 w-5 rounded-sm"
              personaName={resolvedPlayer.personaName}
              countryCode={resolvedPlayer.countryCode}
              rank={bestActiveRank}
            />
            {activeServer ? (
              <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <GameController className="size-3.5 text-lime-400" />
                <span>Currently playing</span>
                <button
                  type="button"
                  onClick={() =>
                    onOpenServer({
                      modeLabel: null,
                      server: activeServer,
                    })
                  }
                  className="cursor-pointer font-medium text-foreground transition-colors hover:text-primary"
                >
                  Quake Live
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <Tabs
        className="flex min-h-0 flex-1 flex-col gap-0 bg-background pt-16"
        onValueChange={setActiveTab}
        value={activeTab}
      >
        <div className="border-b border-border">
          <div className="flex min-h-14 items-center px-4">
            <TabsList
              className="h-auto gap-1 rounded-none bg-transparent p-0"
              variant="line"
            >
              <TabsTrigger
                className="h-14 rounded-none px-3 text-sm font-medium after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]"
                value="overview"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                className="h-14 rounded-none px-3 text-sm font-medium after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]"
                value="stats"
              >
                Stats
              </TabsTrigger>
              <TabsTrigger
                className="h-14 rounded-none px-3 text-sm font-medium after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]"
                value="matches"
              >
                Matches
              </TabsTrigger>
              {resolvedPlayer.profileUrl ? (
                <a
                  className="inline-flex h-14 items-center gap-1.5 px-3 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
                  href={resolvedPlayer.profileUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Steam
                  <ArrowUpRight className="size-4" />
                </a>
              ) : null}
            </TabsList>
          </div>
        </div>
        <TabsContent
          className="min-h-0 flex-1 data-[state=inactive]:hidden"
          value="overview"
        >
          <PlayerProfileOverviewPane
            key={resolvedPlayer.id}
            onOpenMatch={onOpenMatch}
            onOpenMatches={() => setActiveTab("matches")}
            profile={profile}
          />
        </TabsContent>
        <TabsContent
          className="min-h-0 flex-1 data-[state=inactive]:hidden"
          value="stats"
        >
          <PlayerProfileStatsPane profile={profile} />
        </TabsContent>
        <TabsContent
          className="min-h-0 flex-1 data-[state=inactive]:hidden"
          value="matches"
        >
          <PlayerProfileMatchesPane
            onOpenMatch={onOpenMatch}
            profile={profile}
          />
        </TabsContent>
      </Tabs>
      <ManageCoverModal
        coverUrl={resolvedPlayer.coverImageUrl ?? ""}
        isDeleting={deleteCoverMutation.isPending}
        onChangeCover={() => {
          coverUpload.closeManageModal()
          coverUpload.openUploadModal()
        }}
        onClose={coverUpload.closeManageModal}
        onDeleteCover={async () => {
          await deleteCoverMutation.mutateAsync()
          coverUpload.closeManageModal()
        }}
        open={
          coverUpload.isManageModalOpen && Boolean(resolvedPlayer.coverImageUrl)
        }
      />
      <UploadCoverModal
        description="Drop a JPG, PNG, or WEBP image here."
        hint="Recommended: wide landscape image, at least 1600px wide."
        onClose={coverUpload.closeUploadModal}
        onPickFile={coverUpload.handlePickFile}
        open={coverUpload.isUploadModalOpen}
        title="Upload cover"
      />
      <CropImageDialog
        aspect={16 / 4}
        description="Adjust the framing before saving your profile cover."
        file={coverUpload.cropFile}
        fileName={pickupCoverCropFileName}
        onClose={coverUpload.handleCloseCrop}
        onSave={coverUpload.handleSaveCrop}
        open={coverUpload.isCropOpen}
        title="Crop cover"
      />
      <UploadCoverModal
        description="Drop a JPG, PNG, or WEBP image here."
        hint="Recommended: square image, at least 512px by 512px."
        onClose={avatarUpload.closeUploadModal}
        onPickFile={avatarUpload.handlePickFile}
        open={avatarUpload.isUploadModalOpen}
        title="Upload avatar"
      />
      <CropImageDialog
        aspect={1}
        description="Adjust the framing before saving your profile avatar."
        file={avatarUpload.cropFile}
        fileName={pickupAvatarCropFileName}
        onClose={avatarUpload.handleCloseCrop}
        onSave={avatarUpload.handleSaveCrop}
        open={avatarUpload.isCropOpen}
        title="Crop avatar"
      />
    </section>
  )
}
