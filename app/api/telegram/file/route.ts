import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

import { ensureCachedTelegramFile } from "@/lib/telegram-files";

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ ok: false, error: "fileId is required" }, { status: 400 });
  }

  try {
    const cachedFile = await ensureCachedTelegramFile(fileId);
    const buffer = await readFile(cachedFile.absolutePath);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": cachedFile.contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
