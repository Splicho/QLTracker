import { ImageResponse } from "next/og"

import { getPublicNewsArticle } from "@/lib/server/public-seo"

export const alt = "QLTracker news post"
export const contentType = "image/png"
export const runtime = "nodejs"
export const size = {
  width: 1200,
  height: 630,
}

function formatCategory(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value)
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = await getPublicNewsArticle(slug)

  const title = truncate(article?.title ?? "QLTracker News", 110)
  const excerpt = truncate(
    article?.excerpt ??
      "Read the latest QLTracker pickup, infrastructure, and community updates.",
    180
  )
  const category = article ? formatCategory(article.category) : "News"
  const publishedLabel = article ? formatDate(article.publishedAt) : "QLTracker"

  return new ImageResponse(
    <div
      style={{
        background:
          "radial-gradient(circle at top left, rgba(225, 52, 45, 0.22), transparent 38%), linear-gradient(180deg, #111111 0%, #050505 100%)",
        color: "#fafafa",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "54px 60px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            gap: 18,
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #df3b31 0%, #8d0e0e 100%)",
              borderRadius: 18,
              display: "flex",
              height: 46,
              width: 46,
            }}
          />
          <span>QLTracker</span>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            color: "#d8d8d8",
            display: "flex",
            fontSize: 22,
            fontWeight: 600,
            padding: "12px 18px",
          }}
        >
          {publishedLabel}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 22,
          maxWidth: "88%",
        }}
      >
        <div
          style={{
            background: "rgba(225, 52, 45, 0.14)",
            border: "1px solid rgba(225, 52, 45, 0.32)",
            borderRadius: 999,
            color: "#ff998f",
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "10px 16px",
            textTransform: "uppercase",
            width: "fit-content",
          }}
        >
          {category}
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.06,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "rgba(250,250,250,0.76)",
            fontSize: 28,
            lineHeight: 1.35,
          }}
        >
          {excerpt}
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          color: "rgba(250,250,250,0.56)",
          display: "flex",
          fontSize: 24,
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ display: "flex" }}>qltracker.com/news</div>
        <div style={{ display: "flex" }}>Quake Live tracking and pickup</div>
      </div>
    </div>,
    size
  )
}
