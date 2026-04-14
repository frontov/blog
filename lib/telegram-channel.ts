import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { buildTelegramFileUrl, getTelegramFilePath } from "@/lib/telegram-files";

export type TelegramChannelProfile = {
  title: string;
  url: string | null;
  avatarSmallUrl: string | null;
  avatarLargeUrl: string | null;
};

function normalizeTelegramChannel() {
  const channel = process.env.TELEGRAM_CHANNEL?.trim();

  if (!channel) {
    return null;
  }

  if (channel.startsWith("@")) {
    return {
      chatId: channel,
      url: `https://t.me/${channel.slice(1)}`
    };
  }

  if (/^https?:\/\//i.test(channel)) {
    const match = channel.match(/t\.me\/([^/?#]+)/i);

    return {
      chatId: match ? `@${match[1]}` : channel,
      url: channel
    };
  }

  const match = channel.match(/t\.me\/([^/?#]+)/i);
  if (match) {
    return {
      chatId: `@${match[1]}`,
      url: `https://t.me/${match[1]}`
    };
  }

  return {
    chatId: `@${channel.replace(/^@/, "")}`,
    url: `https://t.me/${channel.replace(/^@/, "")}`
  };
}

function readTelegramChatIdFromDatabase() {
  const databaseFilePath = path.join(process.cwd(), "data", "blog.sqlite");

  if (!existsSync(databaseFilePath)) {
    return null;
  }

  try {
    const db = new DatabaseSync(databaseFilePath, { open: true, readOnly: true });
    const row = db.prepare("SELECT telegram_chat_id FROM posts LIMIT 1").get() as
      | { telegram_chat_id?: string | number }
      | undefined;
    db.close();

    if (!row?.telegram_chat_id) {
      return null;
    }

    const rawId = String(row.telegram_chat_id).trim();
    if (!rawId) {
      return null;
    }

    return rawId.startsWith("-100")
      ? rawId
      : `-100${rawId.replace(/^-/, "")}`;
  } catch {
    return null;
  }
}

function resolveTelegramChatTarget() {
  const explicitChatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (explicitChatId) {
    return explicitChatId.startsWith("-100")
      ? explicitChatId
      : `-100${explicitChatId.replace(/^-/, "")}`;
  }

  return readTelegramChatIdFromDatabase();
}

async function fetchTelegramChat() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const normalized = normalizeTelegramChannel();
  const targets = [resolveTelegramChatTarget(), normalized?.chatId].filter(Boolean) as string[];

  let lastError: Error | null = null;

  for (const target of targets) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(target)}`,
        {
          next: { revalidate: 60 * 60 }
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram getChat request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        ok: boolean;
        result?: {
          title?: string;
          photo?: {
            small_file_id?: string;
            big_file_id?: string;
          };
        };
        description?: string;
      };

      if (!payload.ok || !payload.result) {
        throw new Error(payload.description || "Telegram getChat returned ok=false");
      }

      return payload.result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Telegram getChat error");
    }
  }

  throw lastError ?? new Error("Telegram getChat failed");
}

export async function getTelegramChannelProfile() {
  const normalized = normalizeTelegramChannel();
  const fallbackTitle = process.env.SITE_NAME || "Roman Blog";

  if (!normalized) {
    return {
      title: fallbackTitle,
      url: null,
      avatarSmallUrl: null,
      avatarLargeUrl: null
    } satisfies TelegramChannelProfile;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return {
      title: fallbackTitle,
      url: normalized.url,
      avatarSmallUrl: null,
      avatarLargeUrl: null
    } satisfies TelegramChannelProfile;
  }

  try {
    const chat = await fetchTelegramChat();
    const title = fallbackTitle;
    const smallFileId = chat.photo?.small_file_id;
    const bigFileId = chat.photo?.big_file_id;

    return {
      title,
      url: normalized.url,
      avatarSmallUrl: smallFileId
        ? `/api/telegram/channel-avatar?size=small`
        : bigFileId
          ? `/api/telegram/channel-avatar?size=big`
          : null,
      avatarLargeUrl: bigFileId
        ? `/api/telegram/channel-avatar?size=big`
        : smallFileId
          ? `/api/telegram/channel-avatar?size=small`
          : null
    } satisfies TelegramChannelProfile;
  } catch {
    return {
      title: fallbackTitle,
      url: normalized.url,
      avatarSmallUrl: null,
      avatarLargeUrl: null
    } satisfies TelegramChannelProfile;
  }
}

export async function resolveTelegramChannelAvatar(size: "small" | "big" = "small") {
  const normalized = normalizeTelegramChannel();

  if (!normalized || !process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Telegram channel avatar is not configured");
  }

  const chat = await fetchTelegramChat();

  if (!chat.photo) {
    throw new Error("Telegram did not return channel photo");
  }

  const preferredFileId = size === "big"
    ? chat.photo.big_file_id ?? chat.photo.small_file_id
    : chat.photo.small_file_id ?? chat.photo.big_file_id;

  if (!preferredFileId) {
    throw new Error("Telegram channel photo file id is missing");
  }

  const filePath = await getTelegramFilePath(preferredFileId);
  return buildTelegramFileUrl(filePath);
}
