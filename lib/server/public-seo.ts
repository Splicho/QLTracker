import { cache } from "react";

import { getNewsArticleBySlug } from "@/lib/server/news";
import { getPickupMatchDetail, getPickupPlayerProfile } from "@/lib/server/pickup";
import { getPrisma } from "@/lib/server/prisma";

export const getPublicNewsArticle = cache(async (slug: string) => {
  return getNewsArticleBySlug(slug);
});

export const getPublicPickupPlayerProfile = cache(async (playerIdOrSteamId: string) => {
  try {
    return await getPickupPlayerProfile(playerIdOrSteamId);
  } catch {
    return null;
  }
});

export const getPublicPickupMatchDetail = cache(async (matchId: string) => {
  try {
    return await getPickupMatchDetail(matchId);
  } catch {
    return null;
  }
});

export async function listSitemapNewsArticles() {
  return getPrisma().newsArticle.findMany({
    orderBy: [{ publishedAt: "desc" }],
    select: {
      publishedAt: true,
      slug: true,
      updatedAt: true,
    },
  });
}

export async function listSitemapPickupPlayers() {
  return getPrisma().pickupPlayer.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      steamId: true,
      updatedAt: true,
    },
  });
}

export async function listSitemapPickupMatches() {
  return getPrisma().pickupMatch.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      updatedAt: true,
    },
  });
}
