import type { Attachment } from "../db/schema";
import { storage } from "./storage";

/**
 * Raster images are the only thing served inline (so they can be previewed).
 * Everything else, including html and svg that could run script on our origin,
 * is forced to download as an opaque binary.
 */
const INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

function contentDisposition(kind: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** The attachment's bytes as a safe response, or `null` when the file is missing on disk. */
export async function attachmentResponse(attachment: Attachment) {
  const file = storage.open(attachment.storageKey);

  if (!(await file.exists())) {
    return null;
  }

  const inline = INLINE_TYPES.has(attachment.mimeType);

  return new Response(file, {
    headers: {
      "Content-Type": inline ? attachment.mimeType : "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", attachment.originalName),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-cache",
    },
  });
}
