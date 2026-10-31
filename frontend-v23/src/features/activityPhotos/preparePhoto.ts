/**
 * First barrier on the phone: redraw the photo on a canvas as a new JPEG of at
 * most 2048 px. Drawing keeps only pixels, so EXIF (GPS, camera, dates) is
 * dropped before anything leaves the phone, and mobile data use is small.
 * If the browser cannot read the file (e.g. HEIC on some Android phones) the
 * original goes up as is: the server converts it and always removes the
 * metadata again (second barrier). Nothing is written to the phone's storage:
 * the photo lives only in memory until it is sent (offline photos are E6).
 */
export const MAX_EDGE = 2048;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const JPEG_QUALITY = 0.82;
const SERVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export interface PreparedPhoto {
  blob: Blob;
  contentType: string;
  /** Re-encoded on the phone (true) or sent as is for the server to convert. */
  reencoded: boolean;
}

export class PhotoPrepareError extends Error {
  constructor(code: "PHOTO_NOT_IMAGE" | "PHOTO_TOO_LARGE") {
    super(code);
    this.name = "PhotoPrepareError";
  }
}

export function fitInside(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  // iOS/Android sometimes leave HEIC without a type.
  return file.type === "" && /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

type Drawable = { source: CanvasImageSource; width: number; height: number; release: () => void };

/** First choice: createImageBitmap (applies the phone's rotation to the pixels). */
async function decodeBitmap(file: File): Promise<Drawable> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
}

/** Fallback for Safari versions whose createImageBitmap rejects some photos: an <img> element. */
async function decodeImageElement(file: File): Promise<Drawable> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function toJpeg(bitmap: Drawable): Promise<Blob | null> {
  const { width, height } = fitInside(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap.source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  canvas.width = 0; // free the pixels at once (large photos on small phones)
  canvas.height = 0;
  return blob;
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!looksLikeImage(file)) throw new PhotoPrepareError("PHOTO_NOT_IMAGE");
  for (const decode of [decodeBitmap, decodeImageElement]) {
    let drawable: Drawable | null = null;
    try {
      drawable = await decode(file);
      if (!drawable.width || !drawable.height) continue;
      const jpeg = await toJpeg(drawable);
      if (jpeg && jpeg.size > 0) return { blob: jpeg, contentType: "image/jpeg", reencoded: true };
    } catch {
      // This decoder cannot read it: try the next one, and finally let the server convert it.
    } finally {
      drawable?.release();
    }
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new PhotoPrepareError("PHOTO_TOO_LARGE");
  // The server identifies the image by its bytes; these are the types it accepts as a body.
  const type = SERVER_TYPES.includes(file.type) ? file.type
    : /\.hei[cf]$/i.test(file.name) ? "image/heic" : "application/octet-stream";
  return { blob: file, contentType: type, reencoded: false };
}
