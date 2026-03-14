import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { navigationItems, type PageId } from "@/lib/navigation";
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
  const currentPage =
    navigationItems.find((item) => item.id === page)?.title ?? "Unknown";

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

      <Tabs
        value={theme ?? "system"}
        onValueChange={(value) => setTheme(value)}
        className="flex-none"
      >
        <TabsList className="h-9 gap-1 rounded-full border border-border bg-muted/40 p-1">
          <TabsTrigger value="light" className="size-7 rounded-full px-0">
            <Sun className="size-4" />
            <span className="sr-only">Light theme</span>
          </TabsTrigger>
          <TabsTrigger value="dark" className="size-7 rounded-full px-0">
            <Moon className="size-4" />
            <span className="sr-only">Dark theme</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="size-7 rounded-full px-0">
            <Monitor className="size-4" />
            <span className="sr-only">System theme</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </header>
  );
}
