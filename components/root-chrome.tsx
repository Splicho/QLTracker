"use client"

import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import "@/i18n"
import { AppFrame } from "@/components/layout/app-frame"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Header } from "@/components/layout/header"
import { NoticeBar } from "@/components/layout/notice-bar"
import { usePickupAuth } from "@/hooks/use-pickup-auth"
import { usePickupState } from "@/hooks/use-pickup-state"
import { fetchNewsArticleQuery, newsQueryKeys } from "@/lib/news-query"
import { fetchPickupNotices } from "@/lib/pickup"
import type { PublicPickupNoticeDto } from "@/lib/server/notices"
import type { InitialPickupBrowserState } from "@/lib/server/pickup-browser"

function isPublicShellPath(pathname: string) {
  if (pathname.startsWith("/pickup/admin")) {
    return false
  }

  if (pathname.startsWith("/admin")) {
    return false
  }

  if (pathname.startsWith("/auth")) {
    return false
  }

  return true
}

function getHeaderState(pathname: string) {
  if (pathname.startsWith("/favorites")) {
    return { pageTitle: "Favorites" }
  }

  if (pathname.startsWith("/watchlist")) {
    return { pageTitle: "Watchlist" }
  }

  if (pathname.startsWith("/pickup")) {
    return { pageTitle: "Pickup" }
  }

  if (pathname.startsWith("/leaderboards")) {
    return { pageTitle: "Leaderboard" }
  }

  if (pathname.startsWith("/news/archive")) {
    return { breadcrumbParent: "News", pageTitle: "Article Archive" }
  }

  if (pathname.startsWith("/news/")) {
    const slug = pathname.split("/").filter(Boolean).at(-1) ?? "Article"
    return {
      breadcrumbParent: "News",
      pageTitle: decodeURIComponent(slug),
    }
  }

  if (pathname.startsWith("/news")) {
    return { pageTitle: "News" }
  }

  if (pathname.startsWith("/players/")) {
    return { breadcrumbParent: "Player", pageTitle: "Profile" }
  }

  if (pathname.startsWith("/matches/")) {
    return { breadcrumbParent: "Match", pageTitle: "Details" }
  }

  if (pathname.startsWith("/settings")) {
    return { pageTitle: "Settings" }
  }

  return { pageTitle: "Server List" }
}

export function RootChrome({
  children,
  initialNotices,
  initialPickupState,
}: {
  children: React.ReactNode
  initialNotices: PublicPickupNoticeDto[]
  initialPickupState?: InitialPickupBrowserState
}) {
  const pathname = usePathname() ?? "/"
  const newsArticleSlug = pathname.startsWith("/news/")
    && !pathname.startsWith("/news/archive")
    ? (pathname.split("/").filter(Boolean).at(-1) ?? null)
    : null
  const pickupAuth = usePickupAuth(
    initialPickupState
      ? {
          player: initialPickupState.player,
          rating: initialPickupState.rating,
          ratings: initialPickupState.ratings,
          sessionToken: initialPickupState.sessionToken,
        }
      : undefined
  )
  const pickupState = usePickupState(
    pickupAuth.sessionToken,
    pickupAuth.pickupAvailable,
    pickupAuth.player,
    initialPickupState?.publicState ?? null,
    initialPickupState?.playerState ?? null
  )
  const noticesQuery = useQuery({
    queryKey: ["pickup", "notices"],
    queryFn: fetchPickupNotices,
    initialData: initialNotices,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const newsArticleQuery = useQuery({
    queryKey: newsArticleSlug
      ? newsQueryKeys.article(newsArticleSlug)
      : ["news", "article", "inactive"],
    queryFn: () => fetchNewsArticleQuery(newsArticleSlug ?? ""),
    enabled: newsArticleSlug != null,
    staleTime: 60_000,
  })
  const activeNotice = noticesQuery.data?.find(Boolean) ?? null
  const headerState = getHeaderState(pathname)
  const resolvedHeaderState =
    newsArticleSlug && newsArticleQuery.data
      ? {
          ...headerState,
          pageTitle: newsArticleQuery.data.title,
        }
      : headerState
  const activePickupViewer =
    pickupState.playerState?.viewer ?? pickupAuth.player
  const activeQueueId =
    pickupState.playerState?.stage === "queue"
      ? pickupState.playerState.queue.queueId
      : pickupState.playerState && "match" in pickupState.playerState
        ? pickupState.playerState.match.queueId
        : null
  const activePickupQueue = activeQueueId
    ? (pickupState.publicState?.queues.find(
        (queue) => queue.id === activeQueueId
      ) ??
      pickupState.publicState?.queue ??
      null)
    : null
  const pickupStackPlayers = !pickupState.playerState
    ? []
    : pickupState.playerState.stage === "queue"
      ? (activePickupQueue?.players ?? []).map((player) => ({
          avatarUrl: player.avatarUrl,
          id: player.id,
          personaName: player.personaName,
        }))
      : "match" in pickupState.playerState
        ? [
            ...pickupState.playerState.match.teams.left,
            ...pickupState.playerState.match.teams.right,
          ].map((player) => ({
            avatarUrl: player.avatarUrl,
            id: player.id,
            personaName: player.personaName,
          }))
        : []
  const pickupStackCount =
    pickupState.playerState?.stage === "queue"
      ? (activePickupQueue?.currentPlayers ?? pickupStackPlayers.length)
      : pickupState.playerState && "match" in pickupState.playerState
        ? pickupStackPlayers.length
        : 0
  const pickupStackCapacity =
    activePickupQueue?.playerCount ??
    (pickupStackPlayers.length > 0 ? pickupStackPlayers.length : null)

  if (!isPublicShellPath(pathname)) {
    return <>{children}</>
  }

  return (
    <AppFrame
      content={children}
      header={
        <Header
          breadcrumbParent={resolvedHeaderState.breadcrumbParent}
          onPickupLogin={
            pickupAuth.pickupAvailable && !pickupAuth.player
              ? pickupAuth.connectWithSteam
              : null
          }
          onPickupLeaveQueue={pickupState.leaveQueue}
          onPickupSignOut={pickupAuth.signOut}
          pageTitle={resolvedHeaderState.pageTitle}
          pickupLinking={pickupAuth.isLinking}
          pickupPlayer={activePickupViewer}
          pickupRatings={pickupAuth.ratings}
          pickupStackCapacity={pickupStackCapacity}
          pickupStackCount={pickupStackCount}
          pickupStackPlayers={pickupStackPlayers}
          pickupStage={pickupState.playerState?.stage ?? null}
        />
      }
      notice={activeNotice ? <NoticeBar notice={activeNotice} /> : null}
      sidebar={<AppSidebar pickupPlayer={pickupAuth.player} />}
    />
  )
}
