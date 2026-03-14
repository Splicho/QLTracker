export function formatDurationHoursMinutes(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return "-";
  }

  const totalSeconds = Math.floor(value);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${totalMinutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}
