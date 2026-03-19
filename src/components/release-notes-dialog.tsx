import { ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PendingReleaseNotes } from "@/lib/release-notes";

type ReleaseNotesDialogProps = {
  open: boolean;
  releaseNotes: PendingReleaseNotes | null;
  onOpenChange: (open: boolean) => void;
};

export function ReleaseNotesDialog({
  open,
  releaseNotes,
  onOpenChange,
}: ReleaseNotesDialogProps) {
  const { t, i18n } = useTranslation();
  const publishedOnLabel = formatReleaseDate(releaseNotes?.date ?? null, i18n.language);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl!" showCloseButton>
        <div className="border-b border-border px-6 py-5">
          <DialogHeader className="gap-3">
            <DialogTitle>
              {t("releaseNotes.title", {
                version: releaseNotes?.version ?? "",
              })}
            </DialogTitle>
            {publishedOnLabel ? (
              <DialogDescription>
                {t("releaseNotes.publishedOn", { date: publishedOnLabel })}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[min(68vh,44rem)] px-6 py-5">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a({ href, className, children, ...props }) {
                const normalizedHref =
                  typeof href === "string" && href.trim().length > 0 ? href : null;

                return (
                  <a
                    {...props}
                    href={normalizedHref ?? "#"}
                    className={cn(
                      "inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4",
                      className
                    )}
                    onClick={(event) => {
                      if (!normalizedHref) {
                        event.preventDefault();
                        return;
                      }

                      event.preventDefault();
                      void openUrl(normalizedHref);
                    }}
                  >
                    <span>{children}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                );
              },
              h1(props) {
                return <h1 className="mt-1 text-2xl font-semibold tracking-tight" {...props} />;
              },
              h2(props) {
                return (
                  <h2
                    className="mt-6 border-b border-border pb-2 text-xl font-semibold tracking-tight first:mt-0"
                    {...props}
                  />
                );
              },
              h3(props) {
                return <h3 className="mt-5 text-base font-semibold tracking-tight" {...props} />;
              },
              p(props) {
                return (
                  <p
                    className="mt-4 text-sm leading-6 text-foreground first:mt-0"
                    {...props}
                  />
                );
              },
              ul(props) {
                return <ul className="mt-4 list-disc space-y-2 pl-6 text-sm" {...props} />;
              },
              ol(props) {
                return <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm" {...props} />;
              },
              li(props) {
                return <li className="leading-6 text-foreground" {...props} />;
              },
              blockquote(props) {
                return (
                  <blockquote
                    className="mt-4 border-l-2 border-border pl-4 text-sm italic text-muted-foreground"
                    {...props}
                  />
                );
              },
              hr(props) {
                return <hr className="my-6 border-border" {...props} />;
              },
              pre(props) {
                return (
                  <pre
                    className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-sm"
                    {...props}
                  />
                );
              },
              code({ className, ...props }) {
                return (
                  <code
                    className={cn(
                      "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]",
                      className
                    )}
                    {...props}
                  />
                );
              },
              table(props) {
                return (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm" {...props} />
                  </div>
                );
              },
              thead(props) {
                return <thead className="border-b border-border text-left" {...props} />;
              },
              tbody(props) {
                return <tbody className="divide-y divide-border" {...props} />;
              },
              th(props) {
                return <th className="px-3 py-2 font-medium text-foreground" {...props} />;
              },
              td(props) {
                return <td className="px-3 py-2 align-top text-muted-foreground" {...props} />;
              },
            }}
          >
            {releaseNotes?.body ?? ""}
          </ReactMarkdown>
        </ScrollArea>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("releaseNotes.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatReleaseDate(value: string | null, language: string) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(language, {
      dateStyle: "long",
    }).format(new Date(timestamp));
  } catch {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "long",
    }).format(new Date(timestamp));
  }
}
