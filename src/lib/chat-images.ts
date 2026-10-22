import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { CHAT_IMAGE_LIMIT } from "@/lib/chat";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const safeSegment = /^[a-zA-Z0-9-]+$/;

function storageRoot() {
  return path.resolve(
    /*turbopackIgnore: true*/
    process.env.CHAT_UPLOAD_DIR ??
      path.join(process.cwd(), "data", "chat-uploads"),
  );
}

function imagePath(key: string) {
  const root = storageRoot();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("مسیر تصویر معتبر نیست.");
  }
  return resolved;
}

export async function saveChatImage(
  file: File,
  buildingId: string,
  messageId: string,
) {
  if (!safeSegment.test(buildingId) || !safeSegment.test(messageId)) {
    throw new Error("شناسه تصویر معتبر نیست.");
  }
  if (!allowedTypes.has(file.type)) {
    throw new Error("تصویر باید با فرمت JPG، PNG یا WebP باشد.");
  }
  if (file.size <= 0 || file.size > CHAT_IMAGE_LIMIT) {
    throw new Error("حجم تصویر باید کمتر از ۸ مگابایت باشد.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    const pipeline = sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    });
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("INVALID_IMAGE");
    }
    output = await pipeline
      .rotate()
      .resize({
        width: 1_600,
        height: 1_600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("فایل انتخاب‌شده تصویر معتبری نیست.");
  }

  const key = `${buildingId}/${messageId}.webp`;
  const destination = imagePath(key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, output);
  return {
    key,
    mimeType: "image/webp",
    name: path.basename(file.name || "image").slice(0, 120),
  };
}

export async function readChatImage(key: string) {
  return readFile(/*turbopackIgnore: true*/ imagePath(key));
}

export async function removeChatImage(key: string | null) {
  if (!key) return;
  try {
    await unlink(imagePath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
