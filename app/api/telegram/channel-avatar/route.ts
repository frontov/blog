import { NextRequest, NextResponse } from "next/server";

import { resolveTelegramChannelAvatar } from "@/lib/telegram-channel";

export async function GET(request: NextRequest) {
  const sizeParam = request.nextUrl.searchParams.get("size");
  const size = sizeParam === "big" ? "big" : "small";

  try {
    const telegramFileUrl = await resolveTelegramChannelAvatar(size);
    const upstream = await fetch(telegramFileUrl, {
      next: { revalidate: 60 * 60 }
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ ok: false, error: "Failed to fetch Telegram avatar" }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
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
