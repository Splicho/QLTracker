import type { CSSProperties, ReactNode } from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

type AppFrameProps = {
  content: ReactNode
  header: ReactNode
  notice: ReactNode
  sidebar: ReactNode
}

export function AppFrame({ content, header, notice, sidebar }: AppFrameProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full flex-col">
        {notice}
        <div className="flex min-h-0 flex-1">
          <div
            className="contents"
            style={
              {
                "--sidebar-width": "13.5rem",
                "--sidebar-width-icon": "3rem",
              } as CSSProperties
            }
          >
            {sidebar}
          </div>
          <SidebarInset className="!z-10 !overflow-hidden !rounded-tl-[1.5rem] !rounded-bl-[1.5rem] !border-l !border-l-border !shadow-lg">
            {header}
            {content}
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  )
}
