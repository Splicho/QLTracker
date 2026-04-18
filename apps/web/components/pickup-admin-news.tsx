"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import {
  ActionButton,
  Field,
  FieldDateTimePicker,
  FieldInput,
  FieldSelect,
} from "@/components/pickup-admin-fields"
import {
  NewsRichEditor,
  type PlateNewsEditorHandle as NewsRichEditorHandle,
} from "@/components/news-editor/plate-news-editor"
import {
  Button,
  Modal,
  Spinner,
  toast,
  useOverlayState,
} from "@/components/pickup-admin-ui"
import { requestJson } from "@/lib/client/request-json"
import type { NewsArticleDto } from "@/lib/server/news"

type PendingAction =
  | "createArticle"
  | "uploadContentImage"
  | "uploadCoverImage"
  | null

const categoryOptions = [
  { label: "Launcher", value: "launcher" },
  { label: "Matchmaking", value: "pickup" },
  { label: "Infrastructure", value: "infrastructure" },
  { label: "Community", value: "community" },
] as const

type NewsCategory = (typeof categoryOptions)[number]["value"]

function formatPublishedAt(value: string) {
  return new Date(value).toLocaleString()
}

function createDefaultForm() {
  return {
    category: "launcher" as NewsCategory,
    content: "",
    coverImageUrl: "",
    publishedAt: new Date().toISOString().slice(0, 16),
    title: "",
  }
}

export function PickupAdminNews({
  initialArticles,
}: {
  initialArticles: NewsArticleDto[]
}) {
  const [articles, setArticles] = useState(initialArticles)
  const [form, setForm] = useState(createDefaultForm())
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const contentEditorRef = useRef<NewsRichEditorHandle | null>(null)
  const createArticleModal = useOverlayState()

  useEffect(() => {
    if (!createArticleModal.isOpen) {
      return
    }

    setForm(createDefaultForm())
    requestAnimationFrame(() => {
      contentEditorRef.current?.focus()
    })
  }, [createArticleModal.isOpen])

  const createArticle = async () => {
    if (!form.content.trim()) {
      toast.danger("Add article content first.")
      return
    }

    setPendingAction("createArticle")
    try {
      const payload = await requestJson<{ article: NewsArticleDto }>(
        "/api/pickup/admin/news",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            coverImageUrl: form.coverImageUrl.trim() || null,
            publishedAt: new Date(form.publishedAt).toISOString(),
          }),
        }
      )

      setArticles((current) =>
        [payload.article, ...current].sort((left, right) =>
          right.publishedAt.localeCompare(left.publishedAt)
        )
      )
      setForm(createDefaultForm())
      createArticleModal.close()
      toast.success("Article created.")
    } catch (error) {
      toast.danger("Article creation failed.", {
        description: error instanceof Error ? error.message : "Request failed.",
      })
    } finally {
      setPendingAction(null)
    }
  }

  const uploadImage = async (file: File, kind: "content" | "cover") => {
    if (form.title.trim().length === 0) {
      toast.danger("Add the article title first.")
      return null
    }

    setPendingAction(
      kind === "cover" ? "uploadCoverImage" : "uploadContentImage"
    )

    try {
      const payload = new FormData()
      payload.set("file", file)
      payload.set("kind", kind)
      payload.set("title", form.title.trim())

      const response = await fetch("/api/pickup/admin/news/upload", {
        method: "POST",
        body: payload,
      })

      const body = (await response.json()) as { message?: string; url?: string }
      if (!response.ok || !body.url) {
        throw new Error(body.message ?? "Upload failed.")
      }

      if (kind === "cover") {
        setForm((current) => ({
          ...current,
          coverImageUrl: body.url ?? "",
        }))
        toast.success("Cover image uploaded.")
      } else {
        toast.success("Content image uploaded.")
      }

      return body.url ?? null
    } catch (error) {
      toast.danger("Image upload failed.", {
        description: error instanceof Error ? error.message : "Request failed.",
      })
      return null
    } finally {
      setPendingAction(null)
      if (coverInputRef.current) {
        coverInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-medium tracking-tight">News</h1>
          <p className="text-sm text-white/60">
            Create launcher articles and manage what appears in the news feed.
          </p>
        </div>
        <Button
          className="h-11"
          variant="secondary"
          onPress={createArticleModal.open}
        >
          Create Article
        </Button>
        <Modal state={createArticleModal}>
          <Modal.Backdrop>
            <Modal.Container placement="center" size="full">
              <Modal.Dialog>
                <Modal.Header className="border-b border-white/10 px-6 py-4">
                  <div>
                    <Modal.Heading className="text-xl font-medium">
                      Create Article
                    </Modal.Heading>
                    <p className="mt-1 text-sm text-white/60">
                      Slug and excerpt are generated automatically from the
                      title and content. Upload cover and inline images directly
                      to Cloudflare R2.
                    </p>
                  </div>
                  <Modal.CloseTrigger />
                </Modal.Header>
                <Modal.Body className="px-6 py-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field className="lg:col-span-2" label="Title">
                      <FieldInput
                        disabled={pendingAction !== null}
                        placeholder="QLTracker 1.6.0 beta is ready"
                        value={form.title}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, title: value }))
                        }
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
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            publishedAt: value,
                          }))
                        }
                      />
                    </Field>

                    <Field
                      className="lg:col-span-2"
                      description="The cover image uploads to R2 and is used in article lists."
                      label="Cover image"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={coverInputRef}
                          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                          className="hidden"
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (!file) {
                              return
                            }

                            void uploadImage(file, "cover")
                          }}
                        />
                        <Button
                          className="inline-flex cursor-pointer items-center gap-2"
                          isDisabled={pendingAction !== null}
                          isPending={pendingAction === "uploadCoverImage"}
                          variant="secondary"
                          onPress={() => coverInputRef.current?.click()}
                        >
                          {({ isPending }) =>
                            isPending ? (
                              <>
                                <Spinner
                                  className="shrink-0"
                                  color="current"
                                  size="sm"
                                />
                                <span>Uploading cover…</span>
                              </>
                            ) : (
                              "Upload cover image"
                            )
                          }
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
                          className="mt-4 max-h-[min(12rem,32vh)] w-full rounded-2xl object-cover"
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
                        ref={contentEditorRef}
                        disabled={pendingAction !== null}
                        isUploadingImage={
                          pendingAction === "uploadContentImage"
                        }
                        markdown={form.content}
                        onMarkdownChange={(content) =>
                          setForm((current) => ({
                            ...current,
                            content,
                          }))
                        }
                        onRequestImageUpload={(file) =>
                          uploadImage(file, "content")
                        }
                      />
                    </Field>
                  </div>
                </Modal.Body>
                <Modal.Footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
                  <Button
                    className="cursor-pointer"
                    variant="secondary"
                    onPress={createArticleModal.close}
                  >
                    Cancel
                  </Button>
                  <ActionButton
                    isDisabled={
                      pendingAction !== null ||
                      form.title.trim().length === 0 ||
                      form.content.trim().length === 0
                    }
                    isPending={pendingAction === "createArticle"}
                    onPress={() => void createArticle()}
                    variant="primary"
                  >
                    Create Article
                  </ActionButton>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </header>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d]">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-medium">Published Articles</h2>
          <p className="mt-1 text-sm text-white/60">
            Latest articles appear first. The launcher can consume these via the
            public news API.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#111111] text-xs tracking-[0.18em] text-white/40 uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Article</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Published</th>
                <th className="px-6 py-3 font-medium">Slug</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.length ? (
                articles.map((article) => (
                  <tr key={article.id} className="border-t border-white/10">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-white">
                          {article.title}
                        </span>
                        <span className="max-w-xl text-sm text-white/55">
                          {article.excerpt}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70 capitalize">
                      {article.category}
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {formatPublishedAt(article.publishedAt)}
                    </td>
                    <td className="px-6 py-4 text-white/45">{article.slug}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        className="inline-flex items-center rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                        href={`/admin/news/${article.id}`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-5 text-white/55" colSpan={5}>
                    No articles yet. Create the first one from the button above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
