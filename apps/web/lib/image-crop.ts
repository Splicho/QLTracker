export type CropArea = {
  height: number
  width: number
  x: number
  y: number
}

const MAX_COVER_WIDTH = 1600
const MAX_COVER_HEIGHT = 400

function createImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", (error) => reject(error))
    image.setAttribute("crossOrigin", "anonymous")
    image.src = sourceUrl
  })
}

export async function createCroppedImageFile(
  sourceUrl: string,
  crop: CropArea,
  fileName: string
) {
  const image = await createImage(sourceUrl)
  const canvas = document.createElement("canvas")
  const scale = Math.min(
    1,
    MAX_COVER_WIDTH / crop.width,
    MAX_COVER_HEIGHT / crop.height
  )
  const outputWidth = Math.max(1, Math.round(crop.width * scale))
  const outputHeight = Math.max(1, Math.round(crop.height * scale))

  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Canvas context could not be created.")
  }

  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/webp", 0.82)
  })

  if (!blob) {
    throw new Error("Cropped image could not be created.")
  }

  return new File([blob], fileName, {
    lastModified: Date.now(),
    type: "image/webp",
  })
}
