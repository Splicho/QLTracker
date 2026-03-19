import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type DownloadEvent, check } from "@tauri-apps/plugin-updater";
import splashIcon from "@/assets/images/splash-logo.png";
import { Progress } from "@/components/ui/progress";
import {
  PENDING_RELEASE_NOTES_STORAGE_KEY,
  RELEASE_NOTES_RECOVERY_VERSION_STORAGE_KEY,
  resolvePendingReleaseNotes,
  serializePendingReleaseNotes,
} from "@/lib/release-notes";
import {
  APP_SETTINGS_STORAGE_KEY,
  parseStoredAppSettings,
} from "@/lib/settings";

type BootstrapPhase =
  | "checking"
  | "development"
  | "up-to-date"
  | "opening"
  | "downloading"
  | "restarting"
  | "check-error"
  | "install-error";

interface BootstrapState {
  phase: BootstrapPhase;
  status: string;
  detail: string;
  error: string | null;
  currentVersion: string;
  latestVersion: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  progress: number | null;
}

const INITIAL_STATE: BootstrapState = {
  phase: "checking",
  status: "Checking launcher updates",
  detail: "Looking for a newer build before opening QLTracker.",
  error: null,
  currentVersion: import.meta.env.PACKAGE_VERSION ?? "0.1.0",
  latestVersion: null,
  downloadedBytes: 0,
  totalBytes: null,
  progress: null,
};

export function BootstrapPage() {
  const [state, setState] = useState(INITIAL_STATE);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.remove("bootstrap-preload");
    document.documentElement.classList.add("bootstrap-window");
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");

    return () => {
      document.documentElement.classList.remove("bootstrap-preload");
      document.documentElement.classList.remove("bootstrap-window");
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    };
  }, []);

  const updateState = useCallback(
    (next: Partial<BootstrapState> | BootstrapState) => {
      if (!mountedRef.current) {
        return;
      }

      setState((current) => ({
        ...current,
        ...next,
      }));
    },
    []
  );

  const openLauncher = useCallback(async () => {
    const storedSettings = parseStoredAppSettings(
      localStorage.getItem(APP_SETTINGS_STORAGE_KEY) ?? ""
    );
    const showWindow =
      !storedSettings.trayEnabled || !storedSettings.startMinimizedToTray;

    updateState({
      phase: "opening",
      status: "Opening QLTracker",
      detail: "Bootstrapping complete.",
      error: null,
    });

    try {
      await Promise.race([
        invoke("launcher_finish_bootstrap", {
          showWindow,
        }),
        new Promise((_, reject) => {
          window.setTimeout(() => {
            reject(new Error("Main window handoff timed out."));
          }, 5000);
        }),
      ]);
    } catch (error) {
      updateState({
        phase: "check-error",
        status: "Could not open QLTracker",
        detail: "The main application window could not be created.",
        error: formatError(error),
      });
      return;
    }

    await delay(75);
    await getCurrentWindow()
      .destroy()
      .catch(() => undefined);
  }, [updateState]);

  const runBootstrap = useCallback(async () => {
    updateState(INITIAL_STATE);

    const packaged = await invoke<boolean>("app_is_packaged").catch(
      () => false
    );
    if (!packaged) {
      updateState({
        phase: "development",
        status: "Updater skipped in development",
        detail: "Development builds open QLTracker directly.",
        error: null,
        latestVersion: null,
        downloadedBytes: 0,
        totalBytes: null,
        progress: null,
      });
      await delay(350);
      await openLauncher();
      return;
    }

    let checkFailed = false;
    const update = await check().catch((error) => {
      checkFailed = true;
      updateState({
        phase: "check-error",
        status: "Could not check launcher updates",
        detail: "GitHub release metadata could not be fetched.",
        error: formatError(error),
        latestVersion: null,
        downloadedBytes: 0,
        totalBytes: null,
        progress: null,
      });
      return null;
    });

    if (checkFailed) {
      return;
    }

    if (!update) {
      updateState({
        phase: "up-to-date",
        status: "QLTracker is up to date",
        detail: "No newer launcher build is available.",
        error: null,
        latestVersion: null,
        downloadedBytes: 0,
        totalBytes: null,
        progress: 100,
      });
      await delay(450);
      await openLauncher();
      return;
    }

    updateState({
      phase: "downloading",
      status: `Downloading QLTracker ${update.version}`,
      detail: "QLTracker will restart automatically after the update finishes.",
      error: null,
      currentVersion: update.currentVersion,
      latestVersion: update.version,
      downloadedBytes: 0,
      totalBytes: null,
      progress: 0,
    });

    let downloadedBytes = 0;
    let totalBytes: number | null = null;

    try {
      await update.downloadAndInstall((event) => {
        applyDownloadEvent(event, {
          onStart(contentLength) {
            totalBytes = contentLength ?? null;
            updateState({
              totalBytes,
              progress: contentLength ? 0 : null,
            });
          },
          onProgress(chunkLength) {
            downloadedBytes += chunkLength;
            updateState({
              downloadedBytes,
              totalBytes,
              progress: totalBytes
                ? Math.max(
                    1,
                    Math.min(
                      99,
                      Math.round((downloadedBytes / totalBytes) * 100)
                    )
                  )
                : null,
            });
          },
          onFinish() {
            updateState({
              downloadedBytes: totalBytes ?? downloadedBytes,
              totalBytes,
              progress: 100,
            });
          },
        });
      });

      updateState({
        phase: "restarting",
        status: "Restarting QLTracker",
        detail: "Installing the new build and reopening the app.",
        error: null,
        progress: 100,
      });

      localStorage.setItem(
        RELEASE_NOTES_RECOVERY_VERSION_STORAGE_KEY,
        update.version
      );

      const pendingReleaseNotes = await resolvePendingReleaseNotes({
        version: update.version,
        body: update.body,
        date: update.date,
        rawJson: update.rawJson,
      });
      if (pendingReleaseNotes) {
        localStorage.setItem(
          PENDING_RELEASE_NOTES_STORAGE_KEY,
          serializePendingReleaseNotes(pendingReleaseNotes)
        );
      }

      await invoke("launcher_restart_app");
    } catch (error) {
      updateState({
        phase: "install-error",
        status: "QLTracker update failed",
        detail: "The update could not be downloaded or installed.",
        error: formatError(error),
        downloadedBytes,
        totalBytes,
      });
    } finally {
      await update.close().catch(() => undefined);
    }
  }, [openLauncher, updateState]);

  useEffect(() => {
    mountedRef.current = true;
    if (!startedRef.current) {
      startedRef.current = true;
      void runBootstrap();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [runBootstrap]);

  const showProgress = state.phase === "downloading";
  const hasError =
    state.phase === "check-error" || state.phase === "install-error";
  const splashLabel =
    state.phase === "checking"
      ? "Checking for updates..."
      : state.phase === "development" ||
          state.phase === "opening" ||
          state.phase === "up-to-date" ||
          state.phase === "restarting"
        ? "Starting..."
        : null;

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-transparent px-4 py-4 text-foreground">
      <div className="flex h-full max-h-[22.5rem] w-full max-w-[19.5rem] flex-col items-center justify-center overflow-hidden rounded-[22px] bg-background px-12 py-12 shadow-[0_12px_36px_rgba(0,0,0,0.28)]">
        <motion.div
          className="flex items-center justify-center"
          animate={
            hasError
              ? { scale: 1, opacity: 1 }
              : { scale: [1, 1.06, 1], opacity: [0.96, 1, 0.96] }
          }
          transition={{
            duration: 2.4,
            ease: "easeInOut",
            repeat: hasError ? 0 : Infinity,
          }}
        >
          <img
            src={splashIcon}
            alt="QLTracker"
            className="h-24 w-auto object-contain"
          />
        </motion.div>

        {splashLabel ? (
          <p className="mt-6 text-center text-sm tracking-[0.08em] text-muted-foreground">
            {splashLabel}
          </p>
        ) : null}

        {showProgress ? (
          <div className="mt-10 w-full">
            <Progress
              className="h-1.5 bg-white/8"
              value={state.progress ?? undefined}
            />
          </div>
        ) : null}

        {hasError ? (
          <div className="mt-8 max-w-[15rem] text-center">
            <p className="text-sm font-medium text-foreground/90">
              {state.status}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {state.error ?? state.detail}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function applyDownloadEvent(
  event: DownloadEvent,
  handlers: {
    onStart: (contentLength?: number) => void;
    onProgress: (chunkLength: number) => void;
    onFinish: () => void;
  }
) {
  if (event.event === "Started") {
    handlers.onStart(event.data.contentLength);
    return;
  }

  if (event.event === "Progress") {
    handlers.onProgress(event.data.chunkLength);
    return;
  }

  handlers.onFinish();
}

function formatError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Unexpected updater error";
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
