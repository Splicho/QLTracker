import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

type DesktopNotification = {
  title: string;
  body?: string;
};

let permissionState: "unknown" | "granted" | "denied" = "unknown";
let permissionRequest: Promise<boolean> | null = null;

export async function ensureDesktopNotificationPermission() {
  if (permissionState === "granted") {
    return true;
  }

  if (permissionState === "denied") {
    return false;
  }

  if (permissionRequest) {
    return permissionRequest;
  }

  permissionRequest = (async () => {
    try {
      const granted = await isPermissionGranted();
      if (granted) {
        permissionState = "granted";
        return true;
      }

      const permission = await requestPermission();
      const allowed = permission === "granted";
      permissionState = allowed ? "granted" : "denied";
      return allowed;
    } catch {
      permissionState = "denied";
      return false;
    } finally {
      permissionRequest = null;
    }
  })();

  return permissionRequest;
}

export async function primeDesktopNotificationPermission() {
  await ensureDesktopNotificationPermission();
}

export async function sendDesktopNotification({
  title,
  body,
}: DesktopNotification) {
  const allowed = await ensureDesktopNotificationPermission();
  if (!allowed) {
    return false;
  }

  sendNotification({
    title,
    body,
  });

  return true;
}
