import { invoke } from "@tauri-apps/api/core";

function normalizeErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export async function appendErrorLog(source: string, error: unknown) {
  const normalizedSource = source.trim();
  const message = normalizeErrorMessage(error).trim();

  if (!normalizedSource || !message) {
    return;
  }

  try {
    await invoke("append_error_log", {
      source: normalizedSource,
      message,
    });
  } catch {
    // Ignore logger failures to avoid cascading UI errors.
  }
}

export function registerGlobalErrorLogging() {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleError = (event: ErrorEvent) => {
    void appendErrorLog(
      "window.error",
      event.error ?? event.message ?? "Unknown window error"
    );
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    void appendErrorLog(
      "window.unhandledrejection",
      event.reason ?? "Unknown promise rejection"
    );
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
