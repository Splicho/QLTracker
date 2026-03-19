import appIcon from "@/assets/images/appicon.png";
import logo from "@/assets/images/logo.png";
import logoDark from "@/assets/images/logo_dark.png";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  Cog,
  Discord,
  GameController,
  Github,
  InfoCircle,
  Steam,
  XSocial,
  YouTube,
} from "@/components/icon";
import { aboutConfig, type AboutSocialId } from "@/config/about";
import { useFavorites } from "@/hooks/use-favorites";
import { useTrackedPlayers } from "@/hooks/use-tracked-players";
import packageJson from "../../../package.json";
import { navigationItems, type PageId } from "@/lib/navigation";
import {
  settingsNavigationItems,
  type SettingsSectionId,
} from "@/lib/settings-navigation";
import {
  fetchRealtimePlayerPresenceLookup,
  isRealtimeEnabled,
} from "@/lib/realtime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuBadge,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { SteamServer } from "@/lib/steam";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const socialIcons: Record<
  AboutSocialId,
  React.ComponentType<{ className?: string }>
> = {
  github: Github,
  x: XSocial,
  discord: Discord,
  steam: Steam,
  youtube: YouTube,
};

export function AppSidebar({
  page,
  onNavigate,
  onExitSettings,
  onSettingsSectionChange,
  settingsSection,
  servers,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  onExitSettings: () => void;
  onSettingsSectionChange: (section: SettingsSectionId) => void;
  settingsSection: SettingsSectionId;
  servers: SteamServer[];
}) {
  const { t } = useTranslation();
  const { state: favoritesState } = useFavorites();
  const { players: trackedPlayers } = useTrackedPlayers();
  const realtimeAvailable = isRealtimeEnabled();
  const populatedSocials = aboutConfig.socials.filter(
    (social) => social.url.trim().length > 0
  );
  const hasRepoLink = aboutConfig.repo.url.trim().length > 0;
  const trackedSteamIds = useMemo(
    () => trackedPlayers.map((player) => player.steamId),
    [trackedPlayers]
  );
  const trackedPresenceQuery = useQuery({
    queryKey: ["realtime", "presence-lookup", trackedSteamIds],
    queryFn: () => fetchRealtimePlayerPresenceLookup(trackedSteamIds),
    enabled: realtimeAvailable && trackedSteamIds.length > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (previousData) => previousData,
  });
  const favoritePlayerCount = useMemo(() => {
    const favoriteAddresses = new Set(
      favoritesState.servers.map((server) => server.addr)
    );

    return servers.reduce((sum, server) => {
      return favoriteAddresses.has(server.addr) ? sum + server.players : sum;
    }, 0);
  }, [favoritesState.servers, servers]);
  const shouldShowFavoritesBadge = favoritesState.servers.length > 0;
  const onlineTrackedPlayerCount = useMemo(
    () =>
      Object.values(trackedPresenceQuery.data ?? {}).filter(
        (presence) => presence != null
      ).length,
    [trackedPresenceQuery.data]
  );
  const shouldShowWatchlistBadge =
    trackedPlayers.length > 0 &&
    realtimeAvailable &&
    !trackedPresenceQuery.isError;
  const isSettingsPage = page === "settings";

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="!p-0"
    >
      <SidebarHeader>
        <div className="relative h-14 px-2">
          <div className="absolute inset-y-0 left-2 flex items-center group-data-[collapsible=icon]:hidden">
            <img
              src={logoDark}
              alt="QLTracker"
              className="h-8 w-auto object-contain dark:hidden"
            />
            <img
              src={logo}
              alt="QLTracker"
              className="hidden h-8 w-auto object-contain dark:block"
            />
          </div>
          <img
            src={appIcon}
            alt="QLTracker app icon"
            className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 object-contain opacity-0 transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:opacity-100"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-[0.18em]">
            {isSettingsPage ? t("settings.title") : t("sidebar.groupLabel")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isSettingsPage
                ? settingsNavigationItems.map((item) => (
                    <SidebarMenuItem
                      key={item.id}
                      className="relative group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                    >
                      <SidebarMenuButton
                        asChild
                        tooltip={t(item.titleKey)}
                        isActive={settingsSection === item.id}
                        size="lg"
                        className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
                      >
                        <button
                          type="button"
                          onClick={() => onSettingsSectionChange(item.id)}
                        >
                          <item.icon />
                          <span className="group-data-[collapsible=icon]:hidden">
                            {t(item.titleKey)}
                          </span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                : navigationItems.map((item) => (
                    <SidebarMenuItem
                      key={item.id}
                      className="relative group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                    >
                      <SidebarMenuButton
                        asChild
                        tooltip={t(item.titleKey)}
                        isActive={page === item.id}
                        size="lg"
                        className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
                      >
                        <button type="button" onClick={() => onNavigate(item.id)}>
                          <item.icon />
                          <span className="group-data-[collapsible=icon]:hidden">
                            {t(item.titleKey)}
                          </span>
                        </button>
                      </SidebarMenuButton>
                      {item.id === "favorites" && shouldShowFavoritesBadge ? (
                        <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuBadge className="pointer-events-auto z-[150] right-2 top-1/2 h-6 min-w-6 -translate-y-1/2 gap-1.5 rounded-md border border-sidebar-border/70 bg-muted px-2 text-xs leading-none peer-data-[size=sm]/menu-button:top-1/2 peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2">
                            <GameController className="size-3" />
                            <span>{favoritePlayerCount}</span>
                          </SidebarMenuBadge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="z-[200]">
                          {t("favorites.playersTooltip")}
                        </TooltipContent>
                      </Tooltip>
                    ) : item.id === "watchlist" && shouldShowWatchlistBadge ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuBadge className="pointer-events-auto z-[150] right-2 top-1/2 h-6 min-w-6 -translate-y-1/2 gap-1.5 rounded-md border border-sidebar-border/70 bg-muted px-2 text-xs leading-none peer-data-[size=sm]/menu-button:top-1/2 peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2">
                              <GameController className="size-3" />
                              <span>{onlineTrackedPlayerCount}</span>
                            </SidebarMenuBadge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="z-[200] capitalize">
                            {t("watchlist.onlineCount", {
                              count: onlineTrackedPlayerCount,
                            })}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </SidebarMenuItem>
                  ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-2 py-2 group-data-[collapsible=icon]:px-0">
        <SidebarMenu>
          {isSettingsPage ? (
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                asChild
                tooltip={t("settings.backToApp")}
                size="lg"
                className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
              >
                <button type="button" onClick={onExitSettings}>
                  <ArrowLeft className="size-5" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {t("settings.backToApp")}
                  </span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                asChild
                tooltip={t("navigation.settings")}
                size="lg"
                className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
              >
                <button type="button" onClick={() => onNavigate("settings")}>
                  <Cog />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {t("navigation.settings")}
                  </span>
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        <div className="border-t border-sidebar-border" />
        <Dialog>
          <SidebarMenu>
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                asChild
                size="lg"
                className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
              >
                <DialogTrigger asChild>
                  <button type="button">
                    <InfoCircle />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {t("sidebar.about")}
                    </span>
                  </button>
                </DialogTrigger>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <DialogContent
            className="sm:max-w-md"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogHeader className="items-center text-center sm:items-center sm:text-center">
              <img
                src={appIcon}
                alt={`${aboutConfig.appName} app icon`}
                className="size-14 rounded-xl object-contain"
              />
              <DialogTitle>{aboutConfig.appName}</DialogTitle>
              <DialogDescription>{aboutConfig.description}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 rounded-lg border border-border p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {t("about.version")}
                </span>
                <span className="font-medium text-foreground">
                  v{packageJson.version}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {t("about.author")}
                </span>
                <span className="font-medium text-foreground">
                  {aboutConfig.author}
                </span>
              </div>
              {populatedSocials.length > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {t("about.socials")}
                  </span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {populatedSocials.map((social) => {
                      const Icon = socialIcons[social.id];

                      return (
                        <button
                          key={social.id}
                          type="button"
                          className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border hover:bg-muted"
                          onClick={() => {
                            void openUrl(social.url);
                          }}
                        >
                          <Icon className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {t("about.stack")}
                </span>
                <span className="font-medium text-foreground">
                  {aboutConfig.stack}
                </span>
              </div>
              {hasRepoLink ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {t("about.repo")}
                  </span>
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-2 font-medium text-foreground hover:text-primary"
                    onClick={() => {
                      void openUrl(aboutConfig.repo.url);
                    }}
                  >
                    <Github className="size-4" />
                    {aboutConfig.repo.label}
                  </button>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </SidebarFooter>
    </Sidebar>
  );
}
