import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const telegramFileCacheDir = path.join(process.cwd(), "data", "telegram-file-cache");

type TelegramFileCacheEntry = {
  absolutePath: string;
  contentType: string;
};

export async function getTelegramFilePath(fileId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`, {
    next: { revalidate: 60 * 60 }
  });

  if (!response.ok) {
    throw new Error(`Telegram getFile request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    result?: { file_path?: string };
    description?: string;
  };

  if (!payload.ok || !payload.result?.file_path) {
    throw new Error(payload.description || "Telegram did not return file_path");
  }

  return payload.result.file_path;
}

export function buildTelegramFileUrl(filePath: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}

export async function ensureCachedTelegramFile(fileId: string): Promise<TelegramFileCacheEntry> {
  await fs.mkdir(telegramFileCacheDir, { recursive: true });

  const cacheKey = createHash("sha1").update(fileId).digest("hex");
  const metaPath = path.join(telegramFileCacheDir, `${cacheKey}.json`);

  const cached = await readCachedMetadata(metaPath);
  if (cached) {
    return cached;
  }

  const filePath = await getTelegramFilePath(fileId);
  const telegramFileUrl = buildTelegramFileUrl(filePath);
  const upstream = await fetch(telegramFileUrl, {
    next: { revalidate: 60 * 60 }
  });

  if (!upstream.ok) {
    throw new Error(`Telegram file request failed with status ${upstream.status}`);
  }

  const arrayBuffer = await upstream.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = upstream.headers.get("content-type") || inferContentType(filePath);
  const extension = inferExtension(filePath, contentType);
  const fileName = `${cacheKey}${extension}`;
  const absolutePath = path.join(telegramFileCacheDir, fileName);
  const tempPath = `${absolutePath}.tmp`;

  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, absolutePath);
  await fs.writeFile(metaPath, JSON.stringify({ fileName, contentType }));

  return {
    absolutePath,
    contentType
  };
}

async function readCachedMetadata(metaPath: string): Promise<TelegramFileCacheEntry | null> {
  try {
    const raw = await fs.readFile(metaPath, "utf8");
    const parsed = JSON.parse(raw) as { fileName?: string; contentType?: string };

    if (!parsed.fileName) {
      return null;
    }

    const absolutePath = path.join(telegramFileCacheDir, parsed.fileName);
    await fs.access(absolutePath);

    return {
      absolutePath,
      contentType: parsed.contentType || inferContentType(parsed.fileName)
    };
  } catch {
    return null;
  }
}

function inferExtension(filePath: string, contentType: string) {
  const existingExtension = path.extname(filePath);
  if (existingExtension) {
    return existingExtension.toLowerCase();
  }

  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "video/mp4":
      return ".mp4";
    case "video/quicktime":
      return ".mov";
    default:
      return "";
  }
}

function inferContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}
