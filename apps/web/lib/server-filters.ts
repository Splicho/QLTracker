export const RATING_FILTER_MIN = 0
export const RATING_FILTER_MAX = 3000

export function createDefaultRatingRange(): [number, number] {
  return [RATING_FILTER_MIN, RATING_FILTER_MAX]
}

export type RatingSystem = "qelo" | "trueskill"

export type ServerFiltersValue = {
  search: string
  region: string
  visibility: "all" | "public" | "private"
  maps: string[]
  gameMode: string
  ratingSystem: RatingSystem
  ratingRange: [number, number]
  tags: string[]
  showEmpty: boolean
  showFull: boolean
  showFavorites: boolean
}

export function createDefaultServerFilters(): ServerFiltersValue {
  return {
    search: "",
    region: "all",
    visibility: "all",
    maps: [],
    gameMode: "all",
    ratingSystem: "qelo",
    ratingRange: createDefaultRatingRange(),
    tags: [],
    showEmpty: false,
    showFull: false,
    showFavorites: false,
  }
}
