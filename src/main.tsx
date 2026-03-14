import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { App } from "@/App";
import { Toaster } from "@/components/ui/sonner";
import "@/index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="qlist-theme">
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="bottom-right" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
