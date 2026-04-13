import { NextRequest, NextResponse } from "next/server";

import { buildTelegramFileUrl, getTelegramFilePath } from "@/lib/telegram-files";

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ ok: false, error: "fileId is required" }, { status: 400 });
  }

  try {
    const filePath = await getTelegramFilePath(fileId);
    const telegramFileUrl = buildTelegramFileUrl(filePath);
    const upstream = await fetch(telegramFileUrl, {
      next: { revalidate: 60 * 60 }
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ ok: false, error: "Failed to fetch Telegram file" }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
