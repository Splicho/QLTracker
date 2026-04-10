export function openExternalUrl(url: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function navigateToUrl(url: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(url);
}
