import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type PickupRankBadgeValue = {
  badgeUrl: string | null
  title: string
}

export function PickupRankBadge({
  className,
  imageClassName,
  rank,
  showTitle = false,
  tooltip,
}: {
  className?: string
  imageClassName?: string
  rank?: PickupRankBadgeValue | null
  showTitle?: boolean
  tooltip?: string
}) {
  if (!rank?.badgeUrl) {
    return null
  }

  const label = tooltip ?? rank.title

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label={label}
            className={cn(
              "inline-flex max-w-full shrink-0 items-center gap-1.5",
              className
            )}
          >
            <img
              alt=""
              className={cn(
                "size-5 shrink-0 rounded-sm object-contain",
                imageClassName
              )}
              src={rank.badgeUrl}
            />
            {showTitle ? <span className="truncate">{rank.title}</span> : null}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
