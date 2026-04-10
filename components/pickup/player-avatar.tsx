import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { stripQuakeColors } from "@/lib/quake";

function getInitials(name: string) {
  return stripQuakeColors(name)
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PlayerAvatar({
  avatarUrl,
  className,
  fallbackClassName,
  personaName,
  size = "default",
}: {
  avatarUrl: string | null | undefined;
  className?: string;
  fallbackClassName?: string;
  personaName: string;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar className={className} size={size}>
      <AvatarImage src={avatarUrl ?? undefined} />
      <AvatarFallback className={fallbackClassName}>
        {getInitials(personaName)}
      </AvatarFallback>
    </Avatar>
  );
}
