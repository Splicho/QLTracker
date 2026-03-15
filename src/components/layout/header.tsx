import type { MouseEvent } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { navigationItems, type PageId } from "@/lib/navigation";
import { changeThemeWithTransition } from "@/lib/theme-transition";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Header({ page }: { page: PageId }) {
  const { setTheme, theme } = useTheme();
  const { t } = useTranslation();
  const currentPage =
    (page === "notifications"
      ? t("navigation.notifications")
      : page === "settings"
        ? t("navigation.settings")
        : navigationItems.find((item) => item.id === page)
          ? t(
              navigationItems.find((item) => item.id === page)!.titleKey
            )
          : null) ?? t("header.unknown");

  const handleThemeChange = (
    nextTheme: "light" | "dark" | "system",
    event: MouseEvent<HTMLButtonElement>
  ) => {
    changeThemeWithTransition(
      nextTheme,
      setTheme,
      event.currentTarget,
      event.detail > 0
        ? {
            x: event.clientX,
            y: event.clientY,
          }
        : null
    );
  };

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{currentPage}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <Tabs value={theme ?? "system"} className="flex-none">
        <TabsList className="h-9 gap-1 rounded-full border border-border bg-muted/40 p-1">
          <TabsTrigger
            value="light"
            className="size-7 rounded-full px-0"
            onClick={(event) => handleThemeChange("light", event)}
          >
            <Sun className="size-4" />
            <span className="sr-only">{t("header.theme.light")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="dark"
            className="size-7 rounded-full px-0"
            onClick={(event) => handleThemeChange("dark", event)}
          >
            <Moon className="size-4" />
            <span className="sr-only">{t("header.theme.dark")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="system"
            className="size-7 rounded-full px-0"
            onClick={(event) => handleThemeChange("system", event)}
          >
            <Monitor className="size-4" />
            <span className="sr-only">{t("header.theme.system")}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </header>
  );
}
