import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { App } from "@/App";
import { AppLanguageSync } from "@/components/app-language-sync";
import { BootstrapPage } from "@/components/bootstrap-page";
import { Toaster } from "@/components/ui/sonner";
import "@/i18n";
import "@/index.css";

const queryClient = new QueryClient();
const currentWindowLabel = (() => {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
})();
const isBootstrapWindow = currentWindowLabel === "bootstrap";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="qlist-theme"
    >
      <QueryClientProvider client={queryClient}>
        <AppLanguageSync />
        {isBootstrapWindow ? <BootstrapPage /> : <App />}
        <Toaster position="bottom-right" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
