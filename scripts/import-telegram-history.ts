import { promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

import { upsertTelegramPost } from "../lib/posts";
import type { BlogPostMedia } from "../lib/types";

type MessageLike = {
  id?: number;
  date?: Date | number;
  message?: string;
  groupedId?: bigint | string | number;
  chatId?: bigint | string | number;
  peerId?: unknown;
  photo?: { sizes?: Array<{ w?: number; h?: number }> };
  video?: { duration?: number; w?: number; h?: number; mimeType?: string };
  media?: unknown;
};

type DraftPost = {
  telegramMessageId: number;
  telegramChatId: string;
  content: string;
  publishedAt: string;
  sourceUrl?: string;
  media: BlogPostMedia[];
};

const uploadsRoot = path.join(process.cwd(), "public", "uploads", "telegram");

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }

  return value;
}

function getChannelUsername(channel: string) {
  const normalized = channel.trim();

  if (normalized.startsWith("@")) {
    return normalized.slice(1);
  }

  const match = normalized.match(/t\.me\/([^/?#]+)/i);
  if (match) {
    return match[1];
  }

  return normalized;
}

function buildSourceUrl(channel: string, messageId: number) {
  const username = getChannelUsername(channel);
  return username ? `https://t.me/${username}/${messageId}` : undefined;
}

function mediaExtension(kind: BlogPostMedia["kind"], mimeType?: string) {
  if (kind === "photo") {
    return "jpg";
  }

  if (!mimeType) {
    return "mp4";
  }

  const known = mimeType.split("/")[1];
  return known || "mp4";
}

async function ensureUploadsDir(channelSlug: string) {
  const targetDir = path.join(uploadsRoot, channelSlug);
  await fs.mkdir(targetDir, { recursive: true });
  return targetDir;
}

async function prompt(question: string) {
  const rl = createInterface({ input, output });

  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function widthHeightFromPhoto(message: MessageLike) {
  const sizes = message.photo?.sizes ?? [];
  const largest = [...sizes].sort((a, b) => {
    const aArea = (a.w ?? 0) * (a.h ?? 0);
    const bArea = (b.w ?? 0) * (b.h ?? 0);
    return bArea - aArea;
  })[0];

  return {
    width: largest?.w,
    height: largest?.h
  };
}

async function downloadMediaForMessage(
  client: TelegramClient,
  message: MessageLike,
  channelSlug: string,
  sequence: number
) {
  const isPhoto = Boolean(message.photo);
  const isVideo = Boolean(message.video);

  if (!isPhoto && !isVideo) {
    return null;
  }

  const kind: BlogPostMedia["kind"] = isVideo ? "video" : "photo";
  const video = message.video;
  const extension = mediaExtension(kind, video?.mimeType);
  const targetDir = await ensureUploadsDir(channelSlug);
  const baseName = `${message.id}-${sequence}.${extension}`;
  const absoluteFilePath = path.join(targetDir, baseName);

  await client.downloadMedia(message as never, {
    outputFile: absoluteFilePath
  });

  const photoDimensions = widthHeightFromPhoto(message);

  return {
    id: `${message.id}-${sequence}`,
    kind,
    url: `/uploads/telegram/${channelSlug}/${baseName}`,
    width: isVideo ? video?.w : photoDimensions.width,
    height: isVideo ? video?.h : photoDimensions.height,
    duration: video?.duration,
    mimeType: video?.mimeType
  } satisfies BlogPostMedia;
}

async function createClient() {
  const apiId = Number(getRequiredEnv("TELEGRAM_API_ID"));
  const apiHash = getRequiredEnv("TELEGRAM_API_HASH");
  const session = process.env.TELEGRAM_SESSION || "";

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });

  await client.start({
    phoneNumber: async () => prompt("Telegram phone number: "),
    password: async () => prompt("Telegram 2FA password (if enabled): "),
    phoneCode: async () => prompt("Telegram login code: "),
    onError: (error) => {
      throw error;
    }
  });

  const nextSession = client.session.save();
  if (!process.env.TELEGRAM_SESSION) {
    output.write(`\nSave this TELEGRAM_SESSION to your .env for future imports:\n${nextSession}\n\n`);
  }

  return client;
}

async function collectDraftPosts(client: TelegramClient, channel: string) {
  const entity = await client.getEntity(channel);
  const channelSlug = getChannelUsername(channel);
  const groupedPosts = new Map<string, DraftPost>();
  const singlePosts: DraftPost[] = [];

  for await (const rawMessage of client.iterMessages(entity, { reverse: true })) {
    const message = rawMessage as unknown as MessageLike;

    if (!message.id || !message.date) {
      continue;
    }

    const publishedAt = message.date instanceof Date
      ? message.date.toISOString()
      : new Date(message.date * 1000).toISOString();

    const content = message.message?.trim() ?? "";
    const media = await downloadMediaForMessage(client, message, channelSlug, 1);

    if (!content && !media) {
      continue;
    }

    const draft: DraftPost = {
      telegramMessageId: message.id,
      telegramChatId: String(message.chatId ?? channelSlug),
      content,
      publishedAt,
      sourceUrl: buildSourceUrl(channel, message.id),
      media: media ? [media] : []
    };

    if (message.groupedId) {
      const key = String(message.groupedId);
      const existing = groupedPosts.get(key);

      if (existing) {
        existing.telegramMessageId = Math.min(existing.telegramMessageId, draft.telegramMessageId);
        existing.sourceUrl = buildSourceUrl(channel, existing.telegramMessageId);
        existing.publishedAt = existing.publishedAt < draft.publishedAt ? existing.publishedAt : draft.publishedAt;

        if (!existing.content && draft.content) {
          existing.content = draft.content;
        }

        if (draft.media.length) {
          const nextSequence = existing.media.length + 1;
          const downloaded = await downloadMediaForMessage(client, message, channelSlug, nextSequence);
          if (downloaded) {
            existing.media.push(downloaded);
          }
        }
      } else {
        groupedPosts.set(key, draft);
      }

      continue;
    }

    singlePosts.push(draft);
  }

  return [...singlePosts, ...groupedPosts.values()].sort((a, b) => {
    return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
  });
}

async function main() {
  const channel = getRequiredEnv("TELEGRAM_CHANNEL");
  const client = await createClient();

  try {
    const drafts = await collectDraftPosts(client, channel);

    let imported = 0;
    for (const draft of drafts) {
      await upsertTelegramPost({
        telegramMessageId: draft.telegramMessageId,
        telegramChatId: draft.telegramChatId,
        content: draft.content,
        media: draft.media,
        publishedAt: draft.publishedAt,
        sourceUrl: draft.sourceUrl
      });

      imported += 1;
    }

    output.write(`Imported ${imported} posts from ${channel}\n`);
  } finally {
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
