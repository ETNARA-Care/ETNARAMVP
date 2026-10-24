/**
 * First barrier on the phone: redraw the photo on a canvas as a new JPEG of at
 * most 2048 px. Drawing keeps only pixels, so EXIF (GPS, camera, dates) is
 * dropped before anything leaves the phone, and mobile data use is small.
 * If the browser cannot read the file (e.g. HEIC on some Android phones) the
 * original goes up as is: the server converts it and always removes the
 * metadata again (second barrier). Nothing is written to the phone's storage.
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

async function toJpeg(bitmap: ImageBitmap): Promise<Blob | null> {
  const { width, height } = fitInside(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  canvas.width = 0; // free the pixels at once (large photos on small phones)
  canvas.height = 0;
  return blob;
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!looksLikeImage(file)) throw new PhotoPrepareError("PHOTO_NOT_IMAGE");
  let bitmap: ImageBitmap | null = null;
  try {
    // "from-image": the phone's rotation is applied to the pixels.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const jpeg = await toJpeg(bitmap);
    if (jpeg && jpeg.size > 0) return { blob: jpeg, contentType: "image/jpeg", reencoded: true };
  } catch {
    // The browser cannot decode it: the server will.
  } finally {
    bitmap?.close();
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new PhotoPrepareError("PHOTO_TOO_LARGE");
  // The server identifies the image by its bytes; these are the types it accepts as a body.
  const type = SERVER_TYPES.includes(file.type) ? file.type
    : /\.hei[cf]$/i.test(file.name) ? "image/heic" : "application/octet-stream";
  return { blob: file, contentType: type, reencoded: false };
}
