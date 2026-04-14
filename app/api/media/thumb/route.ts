import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { ensureCachedTelegramFile } from "@/lib/telegram-files";

const thumbnailCacheDir = path.join(process.cwd(), "data", "thumb-cache");
const uploadsRootDir = path.join(process.cwd(), "public", "uploads");

export async function GET(request: NextRequest) {
  const rawSrc = request.nextUrl.searchParams.get("src");
  const width = clampWidth(request.nextUrl.searchParams.get("w"));

  if (!rawSrc) {
    return NextResponse.json({ ok: false, error: "src is required" }, { status: 400 });
  }

  try {
    const source = await resolveSourcePath(rawSrc, request);
    await fs.mkdir(thumbnailCacheDir, { recursive: true });

    const cacheKey = createHash("sha1").update(`${source.cacheKey}:${width}`).digest("hex");
    const thumbnailPath = path.join(thumbnailCacheDir, `${cacheKey}.jpg`);

    try {
      const cachedBuffer = await fs.readFile(thumbnailPath);
      return imageResponse(cachedBuffer);
    } catch {
      // Continue and generate the thumbnail below.
    }

    const buffer = await sharp(source.absolutePath)
      .rotate()
      .resize({
        width,
        height: width,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({
        quality: 82,
        mozjpeg: true
      })
      .toBuffer();

    const tempPath = `${thumbnailPath}.tmp`;
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, thumbnailPath);

    return imageResponse(buffer);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to build thumbnail" },
      { status: 500 }
    );
  }
}

function clampWidth(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 960;
  }

  return Math.max(320, Math.min(Math.round(parsed), 1600));
}

async function resolveSourcePath(rawSrc: string, request: NextRequest) {
  if (rawSrc.startsWith("/uploads/")) {
    const absolutePath = path.resolve(process.cwd(), "public", rawSrc.slice(1));
    const normalizedUploadsRoot = `${uploadsRootDir}${path.sep}`;

    if (absolutePath !== uploadsRootDir && !absolutePath.startsWith(normalizedUploadsRoot)) {
      throw new Error("Unsupported uploads source");
    }

    await fs.access(absolutePath);

    return {
      absolutePath,
      cacheKey: rawSrc
    };
  }

  if (rawSrc.startsWith("/api/telegram/file")) {
    const url = new URL(rawSrc, request.nextUrl.origin);
    const fileId = url.searchParams.get("fileId");

    if (!fileId) {
      throw new Error("Telegram fileId is missing");
    }

    const cached = await ensureCachedTelegramFile(fileId);

    return {
      absolutePath: cached.absolutePath,
      cacheKey: `telegram:${fileId}`
    };
  }

  throw new Error("Unsupported thumbnail source");
}

function imageResponse(buffer: Buffer) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
