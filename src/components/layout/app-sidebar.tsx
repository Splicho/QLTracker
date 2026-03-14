import appIcon from "@/assets/images/appicon.png";
import logo from "@/assets/images/logo.png";
import logoDark from "@/assets/images/logo_dark.png";
import packageJson from "../../../package.json";
import { navigationItems, type PageId } from "@/lib/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({
  page,
  onNavigate,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
}) {
  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="!border-r !border-sidebar-border !p-0"
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
            QLTracker
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem
                  key={item.id}
                  className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                >
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={page === item.id}
                    size="lg"
                    className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
                  >
                    <button type="button" onClick={() => onNavigate(item.id)}>
                      <item.icon />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        <div className="w-full px-2 py-1 text-center text-xs text-muted-foreground">
          QLTracker v{packageJson.version}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
