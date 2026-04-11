import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDownLeft, ArrowUpRight, Check, X } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Medal } from "@/components/icon"
import { PlayerAvatar } from "@/components/pickup/player-avatar"
import { PlayerName } from "@/components/pickup/player-name"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getMapEntry } from "@/lib/maps"
import { getPickupCountryFlagSrc } from "@/lib/pickup-country"
import { QuakeText, stripQuakeColors } from "@/lib/quake"
import {
  fetchPickupMatchDetail,
  isPickupApiConfigured,
  type PickupMatchPlayerStats,
  type PickupMatchWeaponStat,
  type PickupMatchDetail,
  type PickupMatchKillEvent,
} from "@/lib/pickup"
import { getRealtimeSocket, isRealtimeEnabled } from "@/lib/realtime"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const weaponMeta: Record<string, { icon: string; label: string }> = {
  BFG: { icon: "/icons/quakelive/iconw_bfg.png", label: "BFG" },
  CHAINGUN: { icon: "/icons/quakelive/chaingun128.png", label: "CG" },
  GAUNTLET: { icon: "/icons/quakelive/iconw_gauntlet.png", label: "GNT" },
  GRENADE: { icon: "/icons/quakelive/iconw_grenade.png", label: "GL" },
  HMG: { icon: "/icons/quakelive/weap_hmg.png", label: "HMG" },
  LIGHTNING: { icon: "/icons/quakelive/iconw_lightning.png", label: "LG" },
  MACHINEGUN: { icon: "/icons/quakelive/iconw_machinegun.png", label: "MG" },
  NAILGUN: { icon: "/icons/quakelive/nailgun128.png", label: "NG" },
  PLASMA: { icon: "/icons/quakelive/iconw_plasma.png", label: "PG" },
  RAILGUN: { icon: "/icons/quakelive/iconw_railgun.png", label: "RG" },
  ROCKET: { icon: "/icons/quakelive/iconw_rocket.png", label: "RL" },
  SHOTGUN: { icon: "/icons/quakelive/iconw_shotgun.png", label: "SG" },
}

const weaponOrder = [
  "ROCKET",
  "LIGHTNING",
  "RAILGUN",
  "SHOTGUN",
  "PLASMA",
  "MACHINEGUN",
  "HMG",
  "GRENADE",
  "NAILGUN",
  "BFG",
  "GAUNTLET",
  "CHAINGUN",
]

const weaponChartColors: Record<string, string> = {
  ROCKET: "#ff0000",
  LIGHTNING: "#faf9ac",
  RAILGUN: "#06cc02",
  SHOTGUN: "#fd7c00",
  PLASMA: "#c500ff",
  MACHINEGUN: "#ffff00",
  HMG: "#a78bfa",
  GRENADE: "#029012",
  NAILGUN: "#ec4899",
  BFG: "#14b8a6",
  GAUNTLET: "#f43f5e",
  CHAINGUN: "#64748b",
}

type WeaponChartSort = "best" | "team"

const chartTeamTextColor = {
  left: "#60a5fa",
  right: "#f87171",
} as const

function LoadingState() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="h-48 border-b border-border bg-muted/30" />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </section>
  )
}

function TeamColumn({
  players,
  title,
  toneClassName,
}: {
  players: Array<{
    displayAfter: number | null
    displayBefore: number
    kills: number | null
    player: {
      avatarUrl: string | null
      countryCode?: string | null
      id: string
      personaName: string
    }
    result: "loss" | "win" | null
  }>
  title: string
  toneClassName: string
}) {
  return (
    <div className="space-y-2">
      <p className={`text-xs font-medium ${toneClassName}`}>{title}</p>
      <div className="space-y-2">
        {players.map((entry) => (
          <div
            className="relative flex items-center gap-3 rounded-md border border-border bg-sidebar px-3 py-2"
            key={entry.player.id}
          >
            <div className="flex min-w-0 items-center gap-3">
              <PlayerAvatar
                avatarUrl={entry.player.avatarUrl}
                personaName={entry.player.personaName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 truncate text-sm font-medium text-foreground">
                    <PlayerName
                      country
                      countryCode={entry.player.countryCode}
                      fallbackClassName="inline-block max-w-full truncate align-bottom"
                      personaName={entry.player.personaName}
                    />
                  </div>
                  <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-muted px-2 text-xs font-semibold text-foreground">
                    <Medal className="size-3.5 text-amber-400" />
                    {entry.displayAfter ?? entry.displayBefore}
                  </span>
                </div>
              </div>
            </div>
            <div
              className={`pointer-events-none absolute inset-y-0 left-1/2 flex w-56 -translate-x-1/2 items-center justify-center bg-gradient-to-r from-transparent ${
                entry.result === "win"
                  ? "via-emerald-500/16 to-transparent"
                  : entry.result === "loss"
                    ? "via-destructive/16 to-transparent"
                    : "via-muted/55 to-transparent"
              }`}
            >
              <span
                className="text-sm font-semibold tracking-[0.16em] text-foreground uppercase italic"
                style={{
                  textShadow:
                    "0 1px 2px rgba(0, 0, 0, 0.95), 0 0 12px rgba(0, 0, 0, 0.72)",
                }}
              >
                {entry.result === "win"
                  ? "Won"
                  : entry.result === "loss"
                    ? "Lost"
                    : "-"}
              </span>
            </div>
            <span
              className={`ml-auto inline-flex min-w-[4.75rem] shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium ${
                getRatingDelta(entry.displayAfter, entry.displayBefore) > 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : getRatingDelta(entry.displayAfter, entry.displayBefore) < 0
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-sidebar-border/70 bg-muted text-muted-foreground"
              }`}
            >
              {getRatingDelta(entry.displayAfter, entry.displayBefore) > 0 ? (
                <ArrowUpRight className="size-3.5 shrink-0" />
              ) : getRatingDelta(entry.displayAfter, entry.displayBefore) <
                0 ? (
                <ArrowDownLeft className="size-3.5 shrink-0" />
              ) : null}
              <span className="whitespace-nowrap">
                {formatRatingDelta(entry.displayAfter, entry.displayBefore)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatRatingDelta(after: number | null, before: number) {
  const delta = getRatingDelta(after, before)
  if (delta > 0) {
    return `+${delta}`
  }

  return `${delta}`
}

function getRatingDelta(after: number | null, before: number) {
  if (after == null) {
    return 0
  }

  return after - before
}

function formatNumber(value: number | null) {
  return value == null ? "-" : value.toLocaleString()
}

function formatAccuracy(stat: PickupMatchWeaponStat) {
  if (typeof stat.accuracy === "number") {
    return `${Math.round(stat.accuracy)}%`
  }

  if (stat.hits != null && stat.shots != null && stat.shots > 0) {
    return `${Math.round((stat.hits / stat.shots) * 100)}%`
  }

  return "-"
}

function getRelevantWeaponStats(player: PickupMatchPlayerStats) {
  const byWeapon = new Map(
    player.weaponStats.map((stat) => [stat.weapon.toUpperCase(), stat])
  )

  return weaponOrder
    .map((weapon) => byWeapon.get(weapon))
    .filter((stat): stat is PickupMatchWeaponStat => {
      if (!stat) {
        return false
      }

      return Boolean(
        stat.damage || stat.kills || stat.hits || stat.shots || stat.accuracy
      )
    })
}

function getWeaponTotals(player: PickupMatchPlayerStats) {
  const weapons = getRelevantWeaponStats(player)
  const hits = weapons.reduce((total, stat) => total + (stat.hits ?? 0), 0)
  const shots = weapons.reduce((total, stat) => total + (stat.shots ?? 0), 0)
  const damage = weapons.reduce((total, stat) => total + (stat.damage ?? 0), 0)

  return {
    accuracy: shots > 0 ? Math.round((hits / shots) * 100) : null,
    damage,
    weapons,
  }
}

function WeaponStatCell({ stat }: { stat: PickupMatchWeaponStat }) {
  const weapon = stat.weapon.toUpperCase()
  const meta = weaponMeta[weapon] ?? {
    icon: "/icons/quakelive/modified.png",
    label: weapon.slice(0, 3),
  }

  return (
    <div className="flex min-w-[7.5rem] items-center gap-2 rounded-md border border-border/70 bg-muted/25 px-2.5 py-2">
      <img
        alt=""
        className="size-6 shrink-0 object-contain opacity-90"
        src={meta.icon}
      />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-foreground">
          {meta.label}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {formatAccuracy(stat)} · {formatNumber(stat.damage)} dmg
        </div>
      </div>
    </div>
  )
}

function PlayerStatsCard({ player }: { player: PickupMatchPlayerStats }) {
  const { accuracy, damage, weapons } = getWeaponTotals(player)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <PlayerAvatar
          avatarUrl={player.player.avatarUrl}
          personaName={player.player.personaName}
          size="sm"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            <PlayerName
              country
              countryCode={player.player.countryCode}
              fallbackClassName="inline-block max-w-full truncate align-bottom"
              personaName={player.player.personaName}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {player.result === "win"
              ? "Winner"
              : player.result === "loss"
                ? "Defeated"
                : "Player stats"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border text-sm sm:grid-cols-4">
        <div className="bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Kills</div>
          <div className="font-semibold text-foreground">
            {formatNumber(player.kills)}
          </div>
        </div>
        <div className="bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Deaths</div>
          <div className="font-semibold text-foreground">
            {formatNumber(player.deaths)}
          </div>
        </div>
        <div className="bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Accuracy</div>
          <div className="font-semibold text-foreground">
            {accuracy == null ? "-" : `${accuracy}%`}
          </div>
        </div>
        <div className="bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Damage</div>
          <div className="font-semibold text-foreground">
            {formatNumber(damage)}
          </div>
        </div>
      </div>

      <div className="p-4">
        {weapons.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {weapons.map((weapon) => (
              <WeaponStatCell key={weapon.weapon} stat={weapon} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            No weapon stats captured for this player.
          </div>
        )}
      </div>
    </div>
  )
}

function getPlayerWeaponDamage(player: PickupMatchPlayerStats, weapon: string) {
  return (
    player.weaponStats.find((entry) => entry.weapon.toUpperCase() === weapon)
      ?.damage ?? 0
  )
}

function getPlayerWeaponAccuracy(
  player: PickupMatchPlayerStats,
  weapon: string
) {
  const stat = player.weaponStats.find(
    (entry) => entry.weapon.toUpperCase() === weapon
  )

  if (!stat) {
    return 0
  }

  if (typeof stat.accuracy === "number") {
    return Math.round(stat.accuracy)
  }

  if (stat.hits != null && stat.shots != null && stat.shots > 0) {
    return Math.round((stat.hits / stat.shots) * 100)
  }

  return 0
}

function buildWeaponDamageChart(
  detail: PickupMatchDetail,
  sortBy: WeaponChartSort
): {
  config: ChartConfig
  data: Array<Record<string, number | string>>
  players: Array<{
    countryCode?: string | null
    id: string
    key: string
    label: string
    personaName: string
    team: "left" | "right"
  }>
} {
  const combinedPlayers = [
    ...detail.teams.left.map((player) => ({ player, team: "left" as const })),
    ...detail.teams.right.map((player) => ({ player, team: "right" as const })),
  ]

  const config = weaponOrder.reduce<ChartConfig>((nextConfig, weapon) => {
    const meta = weaponMeta[weapon] ?? {
      icon: "/icons/quakelive/modified.png",
      label: weapon.slice(0, 3),
    }
    nextConfig[weapon] = {
      color: weaponChartColors[weapon] ?? "#94a3b8",
      label: meta.label,
    }
    return nextConfig
  }, {})

  const chartEntries = combinedPlayers.map(({ player, team }, index) => {
    const fallbackName = stripQuakeColors(player.player.personaName).trim()
    const chartPlayer = {
      countryCode: player.player.countryCode,
      id: player.player.id,
      key: `player${index}`,
      label: fallbackName || `Player ${index + 1}`,
      personaName: player.player.personaName,
      team,
    }
    const row: Record<string, number | string> = {
      playerId: chartPlayer.id,
      playerKey: chartPlayer.key,
      team: chartPlayer.team,
    }
    let totalDamage = 0

    weaponOrder.forEach((weapon) => {
      const damage = getPlayerWeaponDamage(player, weapon)
      const accuracy = getPlayerWeaponAccuracy(player, weapon)
      row[`${weapon}Damage`] = damage
      row[`${weapon}Accuracy`] = accuracy
      row[weapon] = damage
      totalDamage += damage
    })

    return {
      player: chartPlayer,
      row,
      totalDamage,
    }
  })
  const sortedEntries = chartEntries
    .filter((entry) => entry.totalDamage > 0)
    .sort((left, right) => {
      if (sortBy === "team" && left.player.team !== right.player.team) {
        return left.player.team === "left" ? -1 : 1
      }

      return right.totalDamage - left.totalDamage
    })

  return {
    config,
    data: sortedEntries.map((entry) => entry.row),
    players: sortedEntries.map((entry) => entry.player),
  }
}

function WeaponDamageTooltip({
  active,
  config,
  label,
  payload,
  players,
}: {
  active?: boolean
  config: ChartConfig
  label?: string
  payload?: Array<{
    color?: string
    dataKey?: string | number
    name?: string | number
    payload?: Record<string, number | string | undefined>
    value?: number | string
  }>
  players: Array<{
    countryCode?: string | null
    id: string
    key: string
    label: string
    personaName: string
  }>
}) {
  if (!active || !payload?.length) {
    return null
  }

  const player = players.find(
    (entry) => entry.key === payload[0]?.payload?.playerKey
  )
  const items = payload.filter((item) => Number(item.value ?? 0) > 0)

  return (
    <div className="min-w-40 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        {player ? (
          <PlayerName
            country
            countryClassName="h-3.5 w-3.5"
            countryCode={player.countryCode}
            fallbackClassName="inline-block max-w-[11rem] truncate align-bottom"
            personaName={player.personaName}
          />
        ) : (
          <span>{label}</span>
        )}
      </div>
      <div className="grid gap-1.5">
        {items.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "")
          const itemConfig = config[key]
          const meta = weaponMeta[key] ?? {
            icon: "/icons/quakelive/modified.png",
            label: key.slice(0, 3),
          }
          const damage = Number(item.payload?.[`${key}Damage`] ?? 0)
          const accuracy = Number(item.payload?.[`${key}Accuracy`] ?? 0)

          return (
            <div
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
              key={key}
            >
              <img
                alt=""
                className="size-4 object-contain opacity-90"
                src={meta.icon}
              />
              <span className="text-muted-foreground">
                {itemConfig?.label ?? meta.label}
              </span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {formatNumber(damage)} dmg · {accuracy}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlayerAxisTick({
  payload,
  players,
  x,
  y,
}: {
  payload?: { value?: string }
  players: Array<{
    countryCode?: string | null
    key: string
    label: string
    team: "left" | "right"
  }>
  x?: number
  y?: number
}) {
  const player = players.find((entry) => entry.key === payload?.value)
  const flagSrc = getPickupCountryFlagSrc(player?.countryCode)
  const fill = player ? chartTeamTextColor[player.team] : "#94a3b8"

  if (typeof x !== "number" || typeof y !== "number") {
    return null
  }

  return (
    <g transform={`translate(${x},${y})`}>
      {flagSrc ? (
        <image
          height="26"
          href={flagSrc}
          opacity="0.95"
          width="26"
          x="-132"
          y="-13"
        />
      ) : null}
      <text
        className="text-sm font-semibold"
        style={{ fill }}
        textAnchor="start"
        x={flagSrc ? -96 : -132}
        y={5}
      >
        {player?.label ?? payload?.value ?? ""}
      </text>
    </g>
  )
}

function WeaponDamageChart({ detail }: { detail: PickupMatchDetail }) {
  const [sortBy, setSortBy] = useState<WeaponChartSort>("best")
  const chart = buildWeaponDamageChart(detail, sortBy)
  const availableWeapons = weaponOrder.filter((weapon) =>
    chart.data.some((entry) => Number(entry[weapon] ?? 0) > 0)
  )
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>(weaponOrder)
  const visibleWeapons = availableWeapons.filter((weapon) =>
    selectedWeapons.includes(weapon)
  )

  if (chart.data.length === 0 || availableWeapons.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Weapon Damage
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Per-player weapon damage.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Sort by
              </span>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as WeaponChartSort)}
              >
                <SelectTrigger className="h-10 w-[132px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best">Best</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="mb-5 flex flex-wrap gap-3">
          {availableWeapons.map((weapon) => {
            const meta = weaponMeta[weapon] ?? {
              icon: "/icons/quakelive/modified.png",
              label: weapon.slice(0, 3),
            }
            const active = selectedWeapons.includes(weapon)

            return (
              <button
                aria-pressed={active}
                className={`inline-flex max-w-full items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors ${
                  active
                    ? "border-border bg-muted/30 text-foreground"
                    : "border-border/60 bg-background text-muted-foreground opacity-55"
                }`}
                key={weapon}
                onClick={() =>
                  setSelectedWeapons((current) =>
                    current.includes(weapon)
                      ? current.filter((entry) => entry !== weapon)
                      : [...current, weapon]
                  )
                }
                type="button"
              >
                <img
                  alt=""
                  className={`size-6 shrink-0 object-contain ${
                    active ? "opacity-100" : "opacity-50"
                  }`}
                  src={meta.icon}
                />
                <span className="font-semibold">{meta.label}</span>
              </button>
            )
          })}
        </div>
        <ChartContainer
          className="w-full"
          config={chart.config}
          style={{ height: `${Math.max(340, chart.data.length * 58)}px` }}
        >
          {visibleWeapons.length > 0 ? (
            <BarChart
              accessibilityLayer
              barCategoryGap="20%"
              data={chart.data}
              layout="vertical"
              margin={{ bottom: 12, left: 12, right: 22, top: 12 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                axisLine={false}
                tickFormatter={(value) => formatNumber(Number(value))}
                tick={{ fontSize: 13 }}
                tickLine={false}
                type="number"
              />
              <YAxis
                axisLine={false}
                dataKey="playerKey"
                tick={<PlayerAxisTick players={chart.players} />}
                tickLine={false}
                tickMargin={10}
                type="category"
                width={150}
              />
              <ChartTooltip
                content={
                  <WeaponDamageTooltip
                    config={chart.config}
                    players={chart.players}
                  />
                }
                cursor={false}
              />
              {visibleWeapons.map((weapon) => (
                <Bar
                  animationDuration={0}
                  dataKey={weapon}
                  fill={`var(--color-${weapon})`}
                  isAnimationActive={false}
                  key={weapon}
                  maxBarSize={38}
                  radius={0}
                  stackId="damage"
                />
              ))}
            </BarChart>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/10 text-sm text-muted-foreground">
              Select at least one weapon to render the chart.
            </div>
          )}
        </ChartContainer>
      </div>
    </div>
  )
}

function getWeaponIconByName(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = normalizeWeaponKey(value)
  return weaponMeta[normalized]?.icon ?? null
}

function normalizeWeaponKey(value: string) {
  const normalized = value.toUpperCase()
  if (normalized.includes("ROCKET")) {
    return "ROCKET"
  }
  if (normalized.includes("LIGHTNING")) {
    return "LIGHTNING"
  }
  if (normalized.includes("RAIL")) {
    return "RAILGUN"
  }
  if (normalized.includes("SHOTGUN")) {
    return "SHOTGUN"
  }
  if (normalized.includes("PLASMA")) {
    return "PLASMA"
  }
  if (normalized.includes("GRENADE")) {
    return "GRENADE"
  }
  if (normalized.includes("MACHINEGUN")) {
    return "MACHINEGUN"
  }
  if (normalized.includes("HMG")) {
    return "HMG"
  }
  if (normalized.includes("NAIL")) {
    return "NAILGUN"
  }
  if (normalized.includes("BFG")) {
    return "BFG"
  }
  if (normalized.includes("GAUNTLET")) {
    return "GAUNTLET"
  }

  return normalized
}

function formatKillTime(value: string | null, startedAt: string | null) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  const start = startedAt ? new Date(startedAt) : null
  if (!start || Number.isNaN(start.getTime())) {
    return "-"
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((date.getTime() - start.getTime()) / 1000)
  )
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`
}

function formatKillWeapon(event: PickupMatchKillEvent) {
  return event.weapon ?? event.mod ?? "-"
}

function formatKillWeaponLabel(value: string) {
  const weapon = normalizeWeaponKey(value)

  switch (weapon) {
    case "BFG":
      return "BFG"
    case "CHAINGUN":
      return "CHAIN GUN"
    case "GAUNTLET":
      return "GAUNTLET"
    case "GRENADE":
      return "GRENADE LAUNCHER"
    case "HMG":
      return "HEAVY MACHINE GUN"
    case "LIGHTNING":
      return "LIGHTNING GUN"
    case "MACHINEGUN":
      return "MACHINE GUN"
    case "NAILGUN":
      return "NAIL GUN"
    case "PLASMA":
      return "PLASMA GUN"
    case "RAILGUN":
      return "RAIL GUN"
    case "ROCKET":
      return "ROCKET LAUNCHER"
    case "SHOTGUN":
      return "SHOT GUN"
    default:
      return weapon.replace(/_/g, " ")
  }
}

function KillfeedActor({
  muted,
  name,
}: {
  muted?: boolean
  name: string | null
}) {
  return (
    <span className="block max-w-[14rem] truncate">
      {name ? (
        <PlayerName
          className={muted ? "text-muted-foreground" : "text-foreground"}
          fallbackClassName="truncate"
          personaName={name}
        />
      ) : (
        <span className="text-muted-foreground">-</span>
      )}
    </span>
  )
}

function KillfeedSection({
  kills,
  startedAt,
}: {
  kills: PickupMatchKillEvent[]
  startedAt: string | null
}) {
  if (kills.length === 0) {
    return null
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Killfeed</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Frag timeline captured from the match events.
        </p>
      </div>
      <Table containerClassName="max-h-96 overflow-auto">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead className="w-20">Time</TableHead>
            <TableHead>Killer</TableHead>
            <TableHead>Weapon</TableHead>
            <TableHead>Victim</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {kills.map((event) => {
            const weapon = formatKillWeapon(event)
            const weaponIcon = getWeaponIconByName(weapon)

            return (
              <TableRow
                className={
                  event.suicide || event.teamKill ? "bg-muted/20" : undefined
                }
                key={event.eventIndex}
              >
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatKillTime(event.occurredAt, startedAt)}
                </TableCell>
                <TableCell>
                  <KillfeedActor
                    muted={event.suicide}
                    name={event.suicide ? event.victimName : event.killerName}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {weaponIcon ? (
                      <img
                        alt=""
                        className="size-5 object-contain opacity-85"
                        src={weaponIcon}
                      />
                    ) : null}
                    <span className="text-xs tracking-wide uppercase">
                      {event.suicide
                        ? "Suicide"
                        : event.teamKill
                          ? `${formatKillWeaponLabel(weapon)} · TK`
                          : formatKillWeaponLabel(weapon)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <KillfeedActor
                    muted={event.suicide}
                    name={event.victimName}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function MatchStatsSection({ detail }: { detail: PickupMatchDetail }) {
  const players = [...detail.teams.left, ...detail.teams.right]

  if (players.length === 0) {
    return null
  }

  return (
    <div className="px-6 pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Match Stats</h2>
        {detail.statsSummary?.matchDurationSeconds ? (
          <span className="text-xs text-muted-foreground">
            {Math.floor(detail.statsSummary.matchDurationSeconds / 60)}m{" "}
            {detail.statsSummary.matchDurationSeconds % 60}s played
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {players.map((player) => (
          <PlayerStatsCard key={player.player.id} player={player} />
        ))}
      </div>
      <div className="mt-4">
        <WeaponDamageChart detail={detail} />
      </div>
      <KillfeedSection
        kills={detail.kills}
        startedAt={detail.statsSummary?.startedAt ?? detail.match.liveStartedAt}
      />
    </div>
  )
}

function formatChatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
}

function MatchChatSection({ chat }: { chat: PickupMatchDetail["chat"] }) {
  if (chat.length === 0) {
    return null
  }

  return (
    <div className="px-6 pb-6">
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Match Chat</h2>
        </div>
        <Table containerClassName="max-h-80 overflow-auto">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead className="w-24">Time</TableHead>
              <TableHead className="w-56">Player</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chat.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatChatTimestamp(entry.sentAt) ?? "-"}
                </TableCell>
                <TableCell>
                  <PlayerName
                    className="max-w-[13rem]"
                    fallbackClassName="truncate"
                    personaName={entry.personaName}
                  />
                </TableCell>
                <TableCell className="break-words whitespace-normal">
                  <QuakeText
                    fallbackClassName="whitespace-pre-wrap break-words"
                    text={entry.message}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function parseScore(value: string) {
  const match = value.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!match) {
    return null
  }

  const left = Number.parseInt(match[1] ?? "", 10)
  const right = Number.parseInt(match[2] ?? "", 10)
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return null
  }

  return { left, right }
}

function parseDisplayedScore(
  detail: PickupMatchDetail,
  value: string
): { left: number; right: number } | null {
  const parsed = parseScore(value)
  if (!parsed) {
    return null
  }

  if (detail.match.finalScore) {
    return parsed
  }

  return {
    left: parsed.right,
    right: parsed.left,
  }
}

function getMatchStatus(
  status: PickupMatchDetail["match"]["status"],
  finalScore: string | null
) {
  if (status === "completed" && finalScore && parseScore(finalScore) == null) {
    return {
      className: "border-border bg-transparent text-muted-foreground",
      iconClassName: "text-destructive",
      icon: X,
      label: "Abandoned",
    }
  }

  return status === "completed"
    ? {
        className: "border-border bg-transparent text-muted-foreground",
        iconClassName: "text-emerald-400",
        icon: Check,
        label: "Completed",
      }
    : {
        className: "border-border bg-transparent text-muted-foreground",
        iconClassName: "text-muted-foreground",
        icon: null,
        label: "Live",
      }
}

export function PickupMatchPage({
  initialData,
  matchId,
  onMatchTitleChange,
}: {
  initialData?: PickupMatchDetail
  matchId: string | null
  onMatchTitleChange?: (title: string | null) => void
}) {
  const queryClient = useQueryClient()
  const matchQuery = useQuery({
    queryKey: ["pickup", "match", matchId],
    queryFn: () => fetchPickupMatchDetail(matchId!),
    enabled: isPickupApiConfigured() && Boolean(matchId),
    initialData,
    staleTime: 15_000,
    refetchInterval: 15_000,
  })

  useEffect(() => {
    if (!matchId || !isRealtimeEnabled()) {
      return
    }

    const socket = getRealtimeSocket()
    if (!socket) {
      return
    }

    const refetchMatch = (payload?: { matchId?: string }) => {
      if (payload?.matchId && payload.matchId !== matchId) {
        return
      }

      void queryClient.invalidateQueries({
        queryKey: ["pickup", "match", matchId],
      })
    }

    socket.on("connect", refetchMatch)
    socket.on("pickup:match-detail:update", refetchMatch)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off("connect", refetchMatch)
      socket.off("pickup:match-detail:update", refetchMatch)
    }
  }, [matchId, queryClient])

  useEffect(() => {
    const title = matchQuery.data?.match.queue.name ?? null
    onMatchTitleChange?.(title)

    return () => {
      onMatchTitleChange?.(null)
    }
  }, [matchQuery.data?.match.queue.name, onMatchTitleChange])

  if (matchQuery.isPending) {
    return <LoadingState />
  }

  if (!isPickupApiConfigured()) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">
            Match page unavailable
          </p>
          <p className="text-sm text-muted-foreground">
            Set <code className="font-mono">VITE_PICKUP_API_URL</code> to load
            match details.
          </p>
        </div>
      </div>
    )
  }

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">
            Match could not be loaded
          </p>
          <p className="text-sm text-muted-foreground">
            {matchQuery.error instanceof Error
              ? matchQuery.error.message
              : "Unexpected pickup match error."}
          </p>
        </div>
      </div>
    )
  }

  const detail = matchQuery.data
  const map = getMapEntry(
    detail.match.finalMapKey ?? detail.statsSummary?.mapKey ?? "default"
  )
  const score =
    detail.match.finalScore ??
    (detail.statsSummary
      ? `${detail.statsSummary.blueRounds ?? 0} - ${detail.statsSummary.redRounds ?? 0}`
      : "In progress")
  const parsedScore = parseDisplayedScore(detail, score)
  const status = getMatchStatus(detail.match.status, detail.match.finalScore)

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative border-b border-border">
        <div className="absolute inset-0">
          {map ? (
            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
                style={{
                  backgroundImage: `url(${map.image})`,
                  maskImage:
                    "linear-gradient(to bottom, black 0%, black 58%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, black 0%, black 58%, transparent 100%)",
                  maskSize: "100% 100%",
                  WebkitMaskSize: "100% 100%",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                }}
              />
            </div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/55 to-background" />
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-background to-transparent" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6">
          <div className="grid grid-cols-[minmax(4rem,1fr)_auto_minmax(4rem,1fr)] items-center gap-4">
            <div className="text-left">
              {parsedScore ? (
                <div className="text-5xl font-semibold tracking-tight text-blue-400 drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)] sm:text-6xl">
                  {parsedScore.left}
                </div>
              ) : null}
            </div>
            <div className="text-center text-[11px] tracking-[0.14em] text-muted-foreground/80 uppercase">
              {map?.name ?? "Unknown Map"}
            </div>
            <div className="text-right">
              {parsedScore ? (
                <div className="text-5xl font-semibold tracking-tight text-red-400 drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)] sm:text-6xl">
                  {parsedScore.right}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="relative flex min-h-48 flex-col justify-end gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {detail.match.queue.name}
              </h1>
            </div>
            <Badge
              className={`h-auto rounded-md px-2.5 py-1 text-sm leading-none ${status.className}`}
              variant="outline"
            >
              {status.icon ? (
                <status.icon
                  className={`size-3.5 shrink-0 ${status.iconClassName}`}
                />
              ) : null}
              {status.label}
            </Badge>
          </div>
          {!parsedScore ? (
            <div className="text-sm font-semibold text-foreground">{score}</div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <TeamColumn
          players={detail.teams.left}
          title="Blue Team"
          toneClassName="text-blue-400"
        />
        <TeamColumn
          players={detail.teams.right}
          title="Red Team"
          toneClassName="text-red-400"
        />
      </div>

      <MatchStatsSection detail={detail} />

      <MatchChatSection chat={detail.chat} />
    </section>
  )
}
