import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config } from "../config";

const uploadsRoot = resolve(config.uploadsDir);
mkdirSync(uploadsRoot, { recursive: true });

/** Only keys we generated ourselves reach the disk, so a stored key can never escape the directory. */
const STORAGE_KEY_PATTERN = /^[a-f0-9]{32}$/;

function pathFor(storageKey: string) {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw new Error("Invalid storage key");
  }

  return join(uploadsRoot, storageKey);
}

export const storage = {
  /** Writes the upload under a fresh random name and returns that name. */
  async save(file: Blob) {
    const storageKey = crypto.randomUUID().replaceAll("-", "");
    await Bun.write(pathFor(storageKey), file);
    return storageKey;
  },

  open(storageKey: string) {
    return Bun.file(pathFor(storageKey));
  },

  /** Best effort: a file that is already gone is not an error. */
  async remove(storageKey: string) {
    try {
      await unlink(pathFor(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[storage] failed to remove", storageKey, error);
      }
    }
  },
};
