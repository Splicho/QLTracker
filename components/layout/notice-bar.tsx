import Link from "next/link"

import { ArrowUpRight, InfoCircle } from "@/components/icon"
import { Button } from "@/components/ui/button"
import { useLocalStorage } from "@/hooks/use-local-storage"
import type { PickupNotice } from "@/lib/pickup"
import { cn } from "@/lib/utils"

const noticeToneClasses: Record<PickupNotice["variant"], string> = {
  info: "bg-blue-600 text-white",
  success: "bg-emerald-600 text-white",
  alert: "bg-amber-500 text-black",
  danger: "bg-red-600 text-white",
}

export function NoticeBar({
  notice,
  className,
}: {
  notice: PickupNotice
  className?: string
}) {
  const [dismissed, setDismissed] = useLocalStorage(
    `notice:${notice.id}:dismissed`,
    "0"
  )

  if (notice.dismissable && dismissed === "1") {
    return null
  }

  return (
    <div
      className={cn(
        "relative z-20 w-full border-b border-black/10",
        noticeToneClasses[notice.variant],
        className
      )}
    >
      <div className="mx-auto flex min-h-12 w-full max-w-[1600px] items-center justify-center px-4 text-center">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <InfoCircle className="size-4 shrink-0 opacity-90" />
          <span className="truncate">{notice.content}</span>
        </div>
        {notice.linkHref && notice.linkLabel ? (
          <Button
            variant="link"
            size="sm"
            asChild
            className={cn(
              "h-auto shrink-0 p-0 text-sm font-semibold",
              notice.variant === "alert"
                ? "text-black hover:text-black/80"
                : "text-white hover:text-white/90"
            )}
          >
            {notice.linkHref.startsWith("/") ? (
              <Link
                href={notice.linkHref}
                className="group inline-flex items-center gap-1"
              >
                {notice.linkLabel}
                <ArrowUpRight className="size-3.5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-px" />
              </Link>
            ) : (
              <a
                href={notice.linkHref}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1"
              >
                {notice.linkLabel}
                <ArrowUpRight className="size-3.5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-px" />
              </a>
            )}
          </Button>
        ) : null}
        {notice.dismissable ? (
          <button
            type="button"
            onClick={() => setDismissed("1")}
            className={cn(
              "ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/10",
              notice.variant === "alert" ? "text-black/80" : "text-white/80"
            )}
            aria-label="Dismiss notice"
          >
            <span className="text-base leading-none">&times;</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
