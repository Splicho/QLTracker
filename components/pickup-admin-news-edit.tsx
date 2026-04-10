"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  ActionButton,
  Field,
  FieldDateTimePicker,
  FieldInput,
  FieldSelect,
} from "@/components/pickup-admin-fields";
import { NewsRichEditor } from "@/components/news-rich-editor";
import {
  Button,
  Spinner,
  toast,
} from "@/components/pickup-admin-ui";
import { requestJson } from "@/lib/client/request-json";
import type { NewsArticleDto } from "@/lib/server/news";

type PendingAction =
  | "delete"
  | "save"
  | "uploadContentImage"
  | "uploadCoverImage"
  | null;

const categoryOptions = [
  { label: "Launcher", value: "launcher" },
  { label: "Pickup", value: "pickup" },
  { label: "Infrastructure", value: "infrastructure" },
  { label: "Community", value: "community" },
] as const;

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function createInitialForm(article: NewsArticleDto) {
  return {
    category: article.category,
    content: article.content,
    coverImageUrl: article.coverImageUrl ?? "",
    publishedAt: toDateTimeLocal(article.publishedAt),
    title: article.title,
  };
}

export function PickupAdminNewsEdit({
  article,
}: {
  article: NewsArticleDto;
}) {
  const router = useRouter();
  const [form, setForm] = useState(createInitialForm(article));
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const uploadImage = async (file: File, kind: "content" | "cover") => {
    if (form.title.trim().length === 0) {
      toast.danger("Add the article title first.");
      return null;
    }

    setPendingAction(kind === "cover" ? "uploadCoverImage" : "uploadContentImage");

    try {
      const payload = new FormData();
      payload.set("file", file);
      payload.set("kind", kind);
      payload.set("title", form.title.trim());

      const response = await fetch("/api/pickup/admin/news/upload", {
        method: "POST",
        body: payload,
      });

      const body = (await response.json()) as { message?: string; url?: string };
      if (!response.ok || !body.url) {
        throw new Error(body.message ?? "Upload failed.");
      }

      if (kind === "cover") {
        setForm((current) => ({
          ...current,
          coverImageUrl: body.url ?? "",
        }));
        toast.success("Cover image uploaded.");
      } else {
        toast.success("Content image uploaded.");
      }

      return body.url ?? null;
    } catch (error) {
      toast.danger("Image upload failed.", {
        description: error instanceof Error ? error.message : "Request failed.",
      });
      return null;
    } finally {
      setPendingAction(null);
      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }
    }
  };

  const saveArticle = async () => {
    setPendingAction("save");

    try {
      const payload = await requestJson<{ article: NewsArticleDto }>(
        `/api/pickup/admin/news/${article.id}`,
        {
          body: JSON.stringify({
            ...form,
            coverImageUrl: form.coverImageUrl.trim() || null,
            publishedAt: new Date(form.publishedAt).toISOString(),
          }),
          method: "PATCH",
        },
      );

      setForm(createInitialForm(payload.article));
      toast.success("Article updated.");
    } catch (error) {
      toast.danger("Article update failed.", {
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const deleteArticle = async () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Delete this article and remove its uploaded images from Cloudflare R2?",
      );

      if (!confirmed) {
        return;
      }
    }

    setPendingAction("delete");

    try {
      await requestJson<{ deletedArticleId: string }>(
        `/api/pickup/admin/news/${article.id}`,
        {
          method: "DELETE",
        },
      );

      toast.success("Article deleted.");
      router.push("/admin/news");
      router.refresh();
    } catch (error) {
      toast.danger("Article deletion failed.", {
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 text-white">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-white/35">News</p>
          <h1 className="text-3xl font-medium tracking-tight">Edit Article</h1>
          <p className="text-sm text-white/60">
            Update title, publish date, cover image, and article content.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
          href="/admin/news"
        >
          Back to News
        </Link>
      </header>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d]">
        <div className="grid gap-5 px-6 py-6 lg:grid-cols-2">
          <Field className="lg:col-span-2" label="Title">
            <FieldInput
              disabled={pendingAction !== null}
              value={form.title}
              onChange={(value) => setForm((current) => ({ ...current, title: value }))}
            />
          </Field>

          <Field label="Category">
            <FieldSelect
              disabled={pendingAction !== null}
              options={categoryOptions.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              value={form.category}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  category: value,
                }))
              }
            />
          </Field>

          <Field label="Publish date">
            <FieldDateTimePicker
              disabled={pendingAction !== null}
              value={form.publishedAt}
              onChange={(value) => setForm((current) => ({ ...current, publishedAt: value }))}
            />
          </Field>

          <Field
            className="lg:col-span-2"
            description="Upload a new cover image or keep the existing one."
            label="Cover image"
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={coverInputRef}
                accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                className="hidden"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }

                  void uploadImage(file, "cover");
                }}
              />
              <Button
                className="cursor-pointer"
                isDisabled={pendingAction !== null}
                variant="secondary"
                onPress={() => coverInputRef.current?.click()}
              >
                {pendingAction === "uploadCoverImage" ? (
                  <>
                    <Spinner color="current" size="sm" />
                    Uploading cover...
                  </>
                ) : (
                  "Upload cover image"
                )}
              </Button>
              {form.coverImageUrl ? (
                <a
                  className="text-sm text-accent transition hover:text-accent/80"
                  href={form.coverImageUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  View uploaded image
                </a>
              ) : null}
            </div>
            {form.coverImageUrl ? (
              <img
                alt="Article cover preview"
                className="mt-4 h-56 w-full rounded-2xl object-cover"
                src={form.coverImageUrl}
              />
            ) : null}
          </Field>

          <Field
            className="lg:col-span-2"
            description="Write article content directly in the editor."
            label="Content"
          >
            <NewsRichEditor
              disabled={pendingAction !== null}
              isUploadingImage={pendingAction === "uploadContentImage"}
              markdown={form.content}
              minHeightClassName="min-h-[24rem]"
              onMarkdownChange={(content) =>
                setForm((current) => ({
                  ...current,
                  content,
                }))
              }
              onRequestImageUpload={(file) => uploadImage(file, "content")}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
          <Button
            className="cursor-pointer"
            isDisabled={pendingAction !== null}
            variant="danger"
            onPress={() => void deleteArticle()}
          >
            {pendingAction === "delete" ? (
              <>
                <Spinner color="current" size="sm" />
                Deleting...
              </>
            ) : (
              "Delete Article"
            )}
          </Button>

          <div className="flex justify-end gap-3">
            <Link
              className="inline-flex h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              href="/admin/news"
            >
              Cancel
            </Link>
            <ActionButton
              isDisabled={
                pendingAction !== null ||
                form.title.trim().length === 0 ||
                form.content.trim().length === 0
              }
              isPending={pendingAction === "save"}
              onPress={() => void saveArticle()}
              variant="primary"
            >
              Save Changes
            </ActionButton>
          </div>
        </div>
      </section>
    </div>
  );
}
