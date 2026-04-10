import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

import { routeError } from "@/lib/server/errors"
import { getPickupSettings } from "@/lib/server/pickup"

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
])

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "")
}

function sanitizeFileStem(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function extensionForContentType(contentType: string) {
  switch (contentType) {
    case "image/avif":
      return "avif"
    case "image/gif":
      return "gif"
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    default:
      return "bin"
  }
}

async function uploadImageToR2(params: { file: File; objectKey: string }) {
  const { file, objectKey } = params

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    routeError(400, "Only AVIF, GIF, JPEG, PNG, and WEBP images are supported.")
  }

  if (file.size > 10 * 1024 * 1024) {
    routeError(400, "Image uploads must be 10 MB or smaller.")
  }

  const config = await getR2Config()
  const body = Buffer.from(await file.arrayBuffer())
  const client = createR2Client(config)

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: body,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  return {
    key: objectKey,
    url: `${config.publicBaseUrl}/${objectKey}`,
  }
}

async function getR2Config() {
  const settings = await getPickupSettings()

  if (
    !settings.r2AccountId ||
    !settings.r2BucketName ||
    !settings.r2PublicBaseUrl ||
    !settings.r2AccessKeyId ||
    !settings.r2SecretAccessKey
  ) {
    routeError(400, "Cloudflare R2 is not configured in pickup admin settings.")
  }

  return {
    accountId: settings.r2AccountId,
    accessKeyId: settings.r2AccessKeyId,
    bucketName: settings.r2BucketName,
    publicBaseUrl: normalizeBaseUrl(settings.r2PublicBaseUrl),
    secretAccessKey: settings.r2SecretAccessKey,
  }
}

function createR2Client(config: Awaited<ReturnType<typeof getR2Config>>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

function extractObjectKeyFromPublicUrl(
  imageUrl: string,
  publicBaseUrl: string
) {
  try {
    const parsedImageUrl = new URL(imageUrl)
    const parsedBaseUrl = new URL(publicBaseUrl)
    const normalizedBasePath = parsedBaseUrl.pathname.replace(/\/+$/, "")

    if (parsedImageUrl.origin !== parsedBaseUrl.origin) {
      return null
    }

    if (
      normalizedBasePath &&
      !(
        parsedImageUrl.pathname === normalizedBasePath ||
        parsedImageUrl.pathname.startsWith(`${normalizedBasePath}/`)
      )
    ) {
      return null
    }

    const objectKey = parsedImageUrl.pathname
      .slice(normalizedBasePath.length)
      .replace(/^\/+/, "")

    return objectKey || null
  } catch {
    return null
  }
}

export async function uploadNewsImageToR2(params: {
  file: File
  kind: "content" | "cover"
  title: string
}) {
  const { file, kind, title } = params
  const extension = extensionForContentType(file.type)
  const stem = sanitizeFileStem(title) || "article-image"
  const objectKey = `news/${kind}/${new Date().toISOString().slice(0, 10)}/${stem}-${Date.now()}.${extension}`

  return uploadImageToR2({
    file,
    objectKey,
  })
}

export async function uploadPickupProfileImageToR2(params: {
  file: File
  kind: "avatar" | "cover"
  playerId: string
  personaName: string
}) {
  const { file, kind, playerId, personaName } = params
  const extension = extensionForContentType(file.type)
  const stem = sanitizeFileStem(personaName) || "pickup-player"
  const objectKey = `pickup/players/${playerId}/${kind}/${stem}-${Date.now()}.${extension}`

  return uploadImageToR2({
    file,
    objectKey,
  })
}

export async function deletePickupImagesFromR2(imageUrls: string[]) {
  if (imageUrls.length === 0) {
    return
  }

  const settings = await getPickupSettings()
  const publicBaseUrl = settings.r2PublicBaseUrl
    ? normalizeBaseUrl(settings.r2PublicBaseUrl)
    : null

  if (!publicBaseUrl) {
    return
  }

  const objectKeys = Array.from(
    new Set(
      imageUrls
        .map((imageUrl) =>
          extractObjectKeyFromPublicUrl(imageUrl, publicBaseUrl)
        )
        .filter((objectKey): objectKey is string => Boolean(objectKey))
    )
  )

  if (objectKeys.length === 0) {
    return
  }

  if (
    !settings.r2AccountId ||
    !settings.r2BucketName ||
    !settings.r2AccessKeyId ||
    !settings.r2SecretAccessKey
  ) {
    routeError(400, "Cloudflare R2 is not configured in pickup admin settings.")
  }

  const accountId = settings.r2AccountId
  const accessKeyId = settings.r2AccessKeyId
  const bucketName = settings.r2BucketName
  const secretAccessKey = settings.r2SecretAccessKey
  const client = createR2Client({
    accountId,
    accessKeyId,
    bucketName,
    publicBaseUrl,
    secretAccessKey,
  })

  await Promise.all(
    objectKeys.map((objectKey) =>
      client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        })
      )
    )
  )
}

export async function deleteNewsImagesFromR2(imageUrls: string[]) {
  return deletePickupImagesFromR2(imageUrls)
}
