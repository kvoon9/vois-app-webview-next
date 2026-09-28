/**
 * Geometry shared by the avatar cropper and its canvas export, so the uploaded
 * square is exactly the one the user framed.
 */

/** Pixel size of the decoded source image. */
export interface CropSource {
  width: number
  height: number
}

/**
 * Where the source sits in the square frame: `scale` is the zoom over the cover
 * scale, `tx` / `ty` the offset from the frame centre in frame pixels.
 */
export interface CropState {
  scale: number
  tx: number
  ty: number
}

/** A square of source pixels, positioned for `drawImage`. */
export interface CropRect {
  x: number
  y: number
  size: number
}

const JPEG_QUALITY = 0.85

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Scale at which the source exactly covers a square frame of `frame` pixels. */
export function coverScale(source: CropSource, frame: number): number {
  return Math.max(frame / source.width, frame / source.height)
}

/** Move the source back inside the frame; an edge must never show a gap. */
export function clampCrop(state: CropState, source: CropSource, frame: number): CropState {
  const drawn = coverScale(source, frame) * state.scale
  const limitX = Math.max(0, (source.width * drawn - frame) / 2)
  const limitY = Math.max(0, (source.height * drawn - frame) / 2)
  return {
    scale: state.scale,
    tx: clamp(state.tx, -limitX, limitX),
    ty: clamp(state.ty, -limitY, limitY),
  }
}

/** The source square the frame shows, in source pixels. */
export function cropSourceRect(state: CropState, source: CropSource, frame: number): CropRect {
  const drawn = coverScale(source, frame) * state.scale
  const size = frame / drawn
  const left = (frame - source.width * drawn) / 2 + state.tx
  const top = (frame - source.height * drawn) / 2 + state.ty
  // The origin is clamped too, so float noise cannot ask for pixels outside the
  // image: Chrome answers that with an unpainted edge.
  return {
    x: clamp(-left / drawn, 0, source.width - size),
    y: clamp(-top / drawn, 0, source.height - size),
    size,
  }
}

/**
 * Encode the framed square as a JPEG of `output` pixels. Redrawing through a
 * canvas also drops the EXIF block, so camera photos go up without their GPS
 * tags.
 */
export async function cropToJpeg(
  image: HTMLImageElement,
  state: CropState,
  frame: number,
  output: number,
): Promise<Blob> {
  const rect = cropSourceRect(
    state,
    { width: image.naturalWidth, height: image.naturalHeight },
    frame,
  )
  const canvas = document.createElement('canvas')
  canvas.width = output
  canvas.height = output
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable')
  // JPEG has no alpha, so transparent pixels would encode as black
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, output, output)
  context.imageSmoothingQuality = 'high'
  // ponytail: one drawImage pass; if large photos alias, downscale in steps
  context.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, output, output)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('JPEG encoding failed'))
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}
