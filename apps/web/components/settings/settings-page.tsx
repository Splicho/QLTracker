"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LoaderCircle, Monitor, Moon, Sun, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CoverImage } from "@/components/icon"
import { CropImageDialog } from "@/components/profile/crop-image"
import { ManageCoverModal } from "@/components/profile/manage-cover-modal"
import { UploadCoverModal } from "@/components/profile/upload-cover-modal"
import { PlayerAvatar } from "@/components/pickup/player-avatar"
import { PickupCountryFlag } from "@/components/pickup/pickup-country-flag"
import { PlayerName } from "@/components/pickup/player-name"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useImageUploadFlow } from "@/hooks/use-image-upload-flow"
import { useFavorites } from "@/hooks/use-favorites"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { usePickupAuth } from "@/hooks/use-pickup-auth"
import { useTrackedPlayers } from "@/hooks/use-tracked-players"
import { parseQLTrackerDataExport } from "@/lib/data-export"
import { FAVORITES_STORAGE_KEY, serializeFavoritesState } from "@/lib/favorites"
import { getLanguageFlagSrc } from "@/lib/language-flags"
import { getPickupCountryOptions } from "@/lib/pickup-country"
import {
  updatePickupProfileMedia,
  uploadPickupProfileImage,
} from "@/lib/pickup"
import {
  APP_LANGUAGE_STORAGE_KEY,
  DEFAULT_APP_LANGUAGE,
  isSupportedAppLanguage,
  SUPPORTED_APP_LANGUAGES,
} from "@/lib/settings"
import {
  settingsNavigationItems,
  type SettingsSectionId,
} from "@/lib/settings-navigation"
import {
  serializeTrackedPlayers,
  TRACKED_PLAYERS_STORAGE_KEY,
} from "@/lib/tracked-players"

const pickupCoverCropFileName = "pickup-cover.webp"
const pickupAvatarCropFileName = "pickup-avatar.webp"

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return fallback
}

function SettingsBlock({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description: string
  title: string
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function GeneralSettingsPanel() {
  const { i18n, t } = useTranslation()
  const { setTheme, theme } = useTheme()
  const activeTheme = theme ?? "system"
  const [storedLanguage, setStoredLanguage] = useLocalStorage(
    APP_LANGUAGE_STORAGE_KEY,
    DEFAULT_APP_LANGUAGE
  )
  const languageOptions = useMemo(
    () =>
      SUPPORTED_APP_LANGUAGES.map((value) => ({
        value,
        label: t(`language.${value}`),
        flagSrc: getLanguageFlagSrc(value),
      })),
    [t]
  )
  const selectedLanguage = isSupportedAppLanguage(storedLanguage)
    ? storedLanguage
    : DEFAULT_APP_LANGUAGE
  const selectedLanguageOption =
    languageOptions.find((option) => option.value === selectedLanguage) ?? null

  useEffect(() => {
    if (!isSupportedAppLanguage(storedLanguage)) {
      setStoredLanguage(DEFAULT_APP_LANGUAGE)
      return
    }

    if (i18n.resolvedLanguage === storedLanguage) {
      return
    }

    void i18n.changeLanguage(storedLanguage)
  }, [i18n, setStoredLanguage, storedLanguage])

  return (
    <div className="space-y-4">
      <SettingsBlock
        description={t("settings.themeDescription")}
        title={t("settings.themeTitle")}
      >
        <Tabs className="flex-none" value={activeTheme}>
          <TabsList className="h-9 gap-1 rounded-full border border-border bg-muted/40 p-1">
            <TabsTrigger
              className="size-7 rounded-full px-0"
              onClick={() => setTheme("light")}
              value="light"
            >
              <Sun className="size-4" />
              <span className="sr-only">{t("header.theme.light")}</span>
            </TabsTrigger>
            <TabsTrigger
              className="size-7 rounded-full px-0"
              onClick={() => setTheme("dark")}
              value="dark"
            >
              <Moon className="size-4" />
              <span className="sr-only">{t("header.theme.dark")}</span>
            </TabsTrigger>
            <TabsTrigger
              className="size-7 rounded-full px-0"
              onClick={() => setTheme("system")}
              value="system"
            >
              <Monitor className="size-4" />
              <span className="sr-only">{t("header.theme.system")}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </SettingsBlock>

      <SettingsBlock
        description={t("settings.languageDescription")}
        title={t("settings.languageTitle")}
      >
        <Select
          onValueChange={(value) => {
            if (!isSupportedAppLanguage(value)) {
              return
            }

            setStoredLanguage(value)
            void i18n.changeLanguage(value)
          }}
          value={selectedLanguage}
        >
          <SelectTrigger className="w-full">
            <SelectValue
              asChild
              placeholder={t("settings.languagePlaceholder")}
            >
              <span className="flex min-w-0 items-center gap-2">
                {selectedLanguageOption?.flagSrc ? (
                  <img
                    alt=""
                    className="size-4 rounded-[2px] object-cover"
                    src={selectedLanguageOption.flagSrc}
                  />
                ) : null}
                <span className="truncate">
                  {selectedLanguageOption?.label ??
                    t("settings.languagePlaceholder")}
                </span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {languageOptions.map((language) => (
              <SelectItem
                key={language.value}
                textValue={language.label}
                value={language.value}
              >
                <span className="flex items-center gap-2">
                  <img
                    alt=""
                    className="size-4 rounded-[2px] object-cover"
                    src={language.flagSrc}
                  />
                  <span>{language.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsBlock>
    </div>
  )
}

function PickupProfileSettingsPanel({
  loading,
  pickupPlayer,
  pickupSessionToken,
}: {
  loading: boolean
  pickupPlayer: ReturnType<typeof usePickupAuth>["player"]
  pickupSessionToken: string
}) {
  const queryClient = useQueryClient()
  const countryOptions = useMemo(() => getPickupCountryOptions(), [])
  const [selectedCountryCode, setSelectedCountryCode] = useState(
    pickupPlayer?.countryCode?.toUpperCase() ?? "NONE"
  )
  const meQueryKey = ["pickup", "me", pickupSessionToken] as const

  const invalidateProfileData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: meQueryKey,
      }),
      pickupPlayer
        ? queryClient.invalidateQueries({
            queryKey: ["pickup", "player-profile", pickupPlayer.id],
          })
        : Promise.resolve(),
      queryClient.invalidateQueries({
        queryKey: ["pickup", "leaderboards"],
      }),
    ])
  }

  const saveCountryMutation = useMutation({
    mutationFn: async (countryCode: string | null) =>
      updatePickupProfileMedia(pickupSessionToken, {
        countryCode,
      }),
    onSuccess: async () => {
      await invalidateProfileData()
      toast.success("Pickup country updated.")
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error, "Pickup country could not be updated.")
      )
    },
  })
  const coverUpload = useImageUploadFlow({
    errorMessage: "Cover upload failed.",
    onUpload: async (file) => {
      const uploaded = await uploadPickupProfileImage(
        pickupSessionToken,
        "cover",
        file
      )
      await updatePickupProfileMedia(pickupSessionToken, {
        customCoverUrl: uploaded.url,
      })
      await invalidateProfileData()
    },
    successMessage: "Profile cover updated.",
  })
  const deleteCoverMutation = useMutation({
    mutationFn: async () => {
      await updatePickupProfileMedia(pickupSessionToken, {
        customCoverUrl: null,
      })
      await invalidateProfileData()
    },
    onSuccess: () => {
      toast.success("Profile cover removed.")
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Profile cover could not be removed."))
    },
  })
  const avatarUpload = useImageUploadFlow({
    errorMessage: "Avatar upload failed.",
    onUpload: async (file) => {
      const uploaded = await uploadPickupProfileImage(
        pickupSessionToken,
        "avatar",
        file
      )
      await updatePickupProfileMedia(pickupSessionToken, {
        customAvatarUrl: uploaded.url,
      })
      await invalidateProfileData()
    },
    successMessage: "Profile avatar updated.",
  })

  if (loading) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-lg border border-border/70 bg-muted/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading pickup profile settings...
        </div>
      </div>
    )
  }

  if (!pickupPlayer || !pickupSessionToken.trim()) {
    return (
      <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
        Connect your pickup account first to manage your public country flag.
      </div>
    )
  }

  const normalizedCountryCode =
    selectedCountryCode === "NONE" ? null : selectedCountryCode
  const isDirty =
    (pickupPlayer.countryCode?.toUpperCase() ?? "NONE") !== selectedCountryCode

  return (
    <div className="space-y-4">
      <SettingsBlock
        description="Upload a custom avatar for pickup pages. If you skip this, your Steam avatar is used."
        title="Avatar"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/70 bg-background/40 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <PlayerAvatar
              avatarUrl={pickupPlayer.avatarUrl}
              className="size-20 rounded-md border-4 border-background shadow-lg"
              fallbackClassName="rounded-[calc(var(--radius-md)-2px)] text-lg font-semibold"
              personaName={pickupPlayer.personaName}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                Current avatar
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Recommended: square image, at least 512 by 512 pixels.
              </p>
            </div>
          </div>
          <Button
            onClick={avatarUpload.openUploadModal}
            type="button"
            variant="outline"
          >
            Change avatar
          </Button>
        </div>
      </SettingsBlock>

      <SettingsBlock
        description="Upload a custom wide cover image for your pickup profile header."
        title="Cover"
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
            <div
              className="aspect-[16/4] w-full bg-muted"
              style={
                pickupPlayer.coverImageUrl
                  ? {
                      backgroundImage: `url(${pickupPlayer.coverImageUrl})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }
                  : undefined
              }
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Recommended: wide landscape image, at least 1600 pixels wide.
            </p>
            <Button
              onClick={
                pickupPlayer.coverImageUrl
                  ? coverUpload.openManageModal
                  : coverUpload.openUploadModal
              }
              type="button"
              variant="outline"
            >
              <CoverImage className="size-4" />
              {pickupPlayer.coverImageUrl ? "Change cover" : "Set cover"}
            </Button>
          </div>
        </div>
      </SettingsBlock>

      <SettingsBlock
        description="Choose the flag displayed next to your player name across pickup leaderboards, profiles, and match views."
        title="Country"
      >
        <div className="space-y-4">
          <Select
            value={selectedCountryCode}
            onValueChange={setSelectedCountryCode}
          >
            <SelectTrigger className="w-full">
              <SelectValue asChild>
                <span className="flex min-w-0 items-center gap-2">
                  <PickupCountryFlag countryCode={normalizedCountryCode} />
                  <span className="truncate">
                    {normalizedCountryCode
                      ? (countryOptions.find(
                          (option) => option.code === normalizedCountryCode
                        )?.label ?? normalizedCountryCode)
                      : "No country"}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="NONE">No country</SelectItem>
              {countryOptions.map((country) => (
                <SelectItem
                  key={country.code}
                  textValue={country.label}
                  value={country.code}
                >
                  <span className="flex items-center gap-2">
                    <PickupCountryFlag countryCode={country.code} />
                    <span>{country.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">Preview</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <PlayerName
                  className="max-w-full"
                  country
                  countryCode={normalizedCountryCode}
                  fallbackClassName="truncate"
                  personaName={pickupPlayer.personaName}
                />
              </div>
            </div>
            <Button
              disabled={!isDirty || saveCountryMutation.isPending}
              onClick={() => saveCountryMutation.mutate(normalizedCountryCode)}
              type="button"
            >
              {saveCountryMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </SettingsBlock>

      <ManageCoverModal
        coverUrl={pickupPlayer.coverImageUrl ?? ""}
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
          coverUpload.isManageModalOpen && Boolean(pickupPlayer.coverImageUrl)
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
    </div>
  )
}

function ImportDataSettingsPanel() {
  const { state: favoritesState } = useFavorites()
  const { players: trackedPlayers } = useTrackedPlayers()
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleImportFile = async (file: File | null) => {
    if (!file) {
      return
    }

    setIsImporting(true)

    try {
      const rawValue = await file.text()
      const data = parseQLTrackerDataExport(rawValue)

      if (!data) {
        throw new Error("Invalid QLTracker export file.")
      }

      window.localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        serializeFavoritesState(data.favorites)
      )
      window.dispatchEvent(
        new CustomEvent("QLTracker-local-storage-sync", {
          detail: {
            key: FAVORITES_STORAGE_KEY,
            value: serializeFavoritesState(data.favorites),
          },
        })
      )

      window.localStorage.setItem(
        TRACKED_PLAYERS_STORAGE_KEY,
        serializeTrackedPlayers(data.trackedPlayers)
      )
      window.dispatchEvent(
        new CustomEvent("QLTracker-local-storage-sync", {
          detail: {
            key: TRACKED_PLAYERS_STORAGE_KEY,
            value: serializeTrackedPlayers(data.trackedPlayers),
          },
        })
      )

      toast.success("QLTracker data imported.")
    } catch (error) {
      toast.error(getErrorMessage(error, "Import failed."))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <SettingsBlock
        description="Import favorites and watchlist data exported from the old QLTracker desktop app. This replaces the current data stored in this browser."
        title="QLTracker Import"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
            Current browser data: {favoritesState.servers.length} favorite
            server
            {favoritesState.servers.length === 1 ? "" : "s"} and{" "}
            {trackedPlayers.length} tracked player
            {trackedPlayers.length === 1 ? "" : "s"}.
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 px-4 py-3">
            <div className="text-sm text-muted-foreground">
              Select the JSON export created from QLTracker settings.
            </div>
            <input
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                void handleImportFile(file)
                event.currentTarget.value = ""
              }}
              ref={fileInputRef}
              type="file"
            />
            <Button
              className="gap-2"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <Upload className="size-4" />
              {isImporting ? "Importing..." : "Import data"}
            </Button>
          </div>
        </div>
      </SettingsBlock>
    </div>
  )
}

export function SettingsPage({ section }: { section: SettingsSectionId }) {
  const pickupAuth = usePickupAuth()
  const profileTabLoading =
    section === "pickup-profile" &&
    !pickupAuth.player &&
    pickupAuth.sessionToken.trim().length > 0 &&
    pickupAuth.userLoading
  const availableSections = useMemo(
    () =>
      settingsNavigationItems.filter(
        (item) =>
          item.id !== "pickup-profile" || pickupAuth.player || profileTabLoading
      ),
    [pickupAuth.player, profileTabLoading]
  )
  const activeSection =
    availableSections.find((item) => item.id === section) ??
    availableSections[0]

  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                <activeSection.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-medium text-foreground">
                  {activeSection.title}
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {activeSection.description}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {activeSection.id === "general" ? (
              <GeneralSettingsPanel />
            ) : activeSection.id === "import-data" ? (
              <ImportDataSettingsPanel />
            ) : (
              <PickupProfileSettingsPanel
                key={`${pickupAuth.player?.id ?? "guest"}-${pickupAuth.player?.countryCode ?? "NONE"}`}
                loading={profileTabLoading}
                pickupPlayer={pickupAuth.player}
                pickupSessionToken={pickupAuth.sessionToken}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
