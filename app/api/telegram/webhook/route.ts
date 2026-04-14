import { NextRequest, NextResponse } from "next/server";

import { upsertTelegramPost } from "@/lib/posts";
import {
  buildTelegramPostUrl,
  extractLargestPhoto,
  extractPostEntities,
  extractPostMedia,
  extractPostContent,
  type TelegramUpdate
} from "@/lib/telegram";

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    return true;
  }

  const actualSecret = request.headers.get("x-telegram-bot-api-secret-token");
  return actualSecret === expectedSecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as TelegramUpdate;
  const post = body.channel_post ?? body.edited_channel_post;

  if (!post) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const content = extractPostContent(post);
  const media = extractPostMedia(post);

  if (!content && media.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Post does not contain text, caption, photo or video"
    });
  }

  const savedPost = await upsertTelegramPost({
    telegramMessageId: post.message_id,
    telegramChatId: String(post.chat.id),
    telegramMediaGroupId: post.media_group_id,
    content,
    entities: extractPostEntities(post),
    media,
    publishedAt: new Date(post.date * 1000).toISOString(),
    coverImage: extractLargestPhoto(post),
    sourceUrl: buildTelegramPostUrl(post)
  });

  return NextResponse.json({ ok: true, post: savedPost });
}
