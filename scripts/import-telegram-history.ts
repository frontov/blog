import { promises as fs } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { upsertTelegramPost } from "../lib/posts";
import type { BlogPostEntity, BlogPostMedia } from "../lib/types";

const execFileAsync = promisify(execFile);

type ExportTextEntity =
  | string
  | {
      type?: string;
      text?: string;
      href?: string;
    };

type ExportMessage = {
  id?: number;
  type?: string;
  media_group_id?: string;
  grouped_id?: number | string;
  grouped_id_str?: string;
  date?: string;
  date_unixtime?: string;
  text?: string | ExportTextEntity[];
  text_entities?: Array<{
    type?: string;
    text?: string;
    href?: string;
  }>;
  photo?: string;
  thumbnail?: string;
  file?: string;
  mime_type?: string;
  media_type?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
};

type ExportChat = {
  id?: number | string;
  name?: string;
  type?: string;
  messages?: ExportMessage[];
};

type ExportPayload = ExportChat | { chats?: { list?: ExportChat[] } };

type DraftPost = {
  telegramMessageId: number;
  telegramChatId: string;
  telegramMediaGroupId?: string;
  content: string;
  entities?: BlogPostEntity[];
  media: BlogPostMedia[];
  publishedAt: string;
  sourceUrl?: string;
};

const uploadsRoot = path.join(process.cwd(), "public", "uploads", "telegram");

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }

  return value;
}

function getOptionalChannel() {
  return process.env.TELEGRAM_CHANNEL?.trim();
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

function buildSourceUrl(channel: string | undefined, messageId: number) {
  if (!channel) {
    return undefined;
  }

  const username = getChannelUsername(channel);
  return username ? `https://t.me/${username}/${messageId}` : undefined;
}

async function resolveExportJsonPath() {
  const configuredPath = getRequiredEnv("TELEGRAM_EXPORT_PATH");
  const absolutePath = path.resolve(process.cwd(), configuredPath);

  const stats = await fs.stat(absolutePath);
  if (stats.isDirectory()) {
    return path.join(absolutePath, "result.json");
  }

  return absolutePath;
}

async function readExportPayload() {
  const exportJsonPath = await resolveExportJsonPath();
  const raw = await fs.readFile(exportJsonPath, "utf8");

  return {
    exportJsonPath,
    payload: JSON.parse(raw) as ExportPayload
  };
}

function extractChat(payload: ExportPayload) {
  if ("messages" in payload) {
    return payload;
  }

  const list = "chats" in payload ? payload.chats?.list ?? [] : [];
  const channel = list.find((chat) => chat.type === "personal_channel" || chat.type === "public_supergroup");

  if (!channel) {
    throw new Error("Could not find channel messages in export JSON");
  }

  return channel;
}

function flattenText(text: string | ExportTextEntity[] | undefined) {
  if (!text) {
    return "";
  }

  if (typeof text === "string") {
    return text;
  }

  return text
    .map((part) => (typeof part === "string" ? part : part.text ?? ""))
    .join("");
}

function mapEntityType(type?: string) {
  switch (type) {
    case "bold":
      return "bold";
    case "italic":
      return "italic";
    case "underline":
      return "underline";
    case "strikethrough":
      return "strikethrough";
    case "code":
      return "code";
    case "pre":
      return "pre";
    case "link":
      return "text_link";
    default:
      return undefined;
  }
}

function getMediaGroupId(message: ExportMessage) {
  if (typeof message.media_group_id === "string") {
    return message.media_group_id;
  }

  if (typeof message.grouped_id_str === "string") {
    return message.grouped_id_str;
  }

  if (typeof message.grouped_id === "string" || typeof message.grouped_id === "number") {
    return String(message.grouped_id);
  }

  return undefined;
}

function hasMedia(message: ExportMessage) {
  return Boolean(mediaKind(message));
}

function getMessageTimestampKey(message: ExportMessage) {
  if (message.date) {
    return message.date;
  }

  if (message.date_unixtime) {
    return message.date_unixtime;
  }

  return "";
}

function getMessageTimestampSeconds(message: ExportMessage) {
  if (message.date_unixtime) {
    const parsed = Number(message.date_unixtime);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (message.date) {
    const parsed = Math.floor(new Date(message.date).getTime() / 1000);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function buildSyntheticGroupIds(messages: ExportMessage[]) {
  const syntheticGroupIds = new Map<number, string>();
  let index = 0;

  while (index < messages.length) {
    const current = messages[index];
    if (!current?.id || current.type !== "message" || !hasMedia(current) || getMediaGroupId(current)) {
      index += 1;
      continue;
    }

    const timestampSeconds = getMessageTimestampSeconds(current);
    if (timestampSeconds === null) {
      index += 1;
      continue;
    }

    const cluster: ExportMessage[] = [current];
    let cursor = index + 1;

    while (cursor < messages.length) {
      const next = messages[cursor];
      const nextTimestampSeconds = next ? getMessageTimestampSeconds(next) : null;

      if (
        !next?.id ||
        next.type !== "message" ||
        !hasMedia(next) ||
        getMediaGroupId(next) ||
        nextTimestampSeconds === null ||
        Math.abs(nextTimestampSeconds - timestampSeconds) > 1
      ) {
        break;
      }

      cluster.push(next);
      cursor += 1;
    }

    if (cluster.length > 1) {
      const groupId = `export-${timestampSeconds}-${cluster[0].id}`;

      for (const item of cluster) {
        if (item.id) {
          syntheticGroupIds.set(item.id, groupId);
        }
      }
    }

    index = cursor;
  }

  return syntheticGroupIds;
}

function extractEntities(message: ExportMessage): BlogPostEntity[] | undefined {
  const text = flattenText(message.text);
  const parts = message.text_entities;

  if (!parts?.length || !text) {
    return undefined;
  }

  let offset = 0;
  const entities: BlogPostEntity[] = [];

  for (const part of parts) {
    const rawText = part.text ?? "";
    const type = mapEntityType(part.type);

    if (type && rawText) {
      entities.push({
        offset,
        length: rawText.length,
        type,
        url: part.href
      });
    }

    offset += rawText.length;
  }

  return entities.length ? entities : undefined;
}

async function ensureUploadsDir(channelSlug: string) {
  const targetDir = path.join(uploadsRoot, channelSlug);
  await fs.mkdir(targetDir, { recursive: true });
  return targetDir;
}

function mediaKind(message: ExportMessage): BlogPostMedia["kind"] | null {
  if (message.photo) {
    return "photo";
  }

  if (message.file && (message.mime_type?.startsWith("video/") || message.media_type?.includes("video"))) {
    return "video";
  }

  return null;
}

async function copyMedia(
  exportDir: string,
  channelSlug: string,
  message: ExportMessage
) {
  const kind = mediaKind(message);
  if (!kind || !message.id) {
    return null;
  }

  const relativeSource = kind === "photo" ? message.photo : message.file;
  if (!relativeSource) {
    return null;
  }

  const sourcePath = path.resolve(exportDir, relativeSource);

  try {
    await fs.access(sourcePath);
  } catch {
    return null;
  }

  const targetDir = await ensureUploadsDir(channelSlug);
  const extension = path.extname(sourcePath) || (kind === "photo" ? ".jpg" : ".mp4");
  const targetBaseName = `${message.id}${extension}`;
  const targetPath = path.join(targetDir, targetBaseName);

  await fs.copyFile(sourcePath, targetPath);
  const posterUrl = kind === "video"
    ? await ensureVideoPoster(targetPath, channelSlug, String(message.id))
    : undefined;

  return {
    id: String(message.id),
    kind,
    url: `/uploads/telegram/${channelSlug}/${targetBaseName}`,
    posterUrl,
    width: message.width,
    height: message.height,
    duration: message.duration_seconds,
    mimeType: message.mime_type
  } satisfies BlogPostMedia;
}

async function ensureVideoPoster(targetPath: string, channelSlug: string, messageId: string) {
  const posterPath = targetPath.replace(/\.[^.]+$/, ".jpg");

  try {
    await access(posterPath);
    return `/uploads/telegram/${channelSlug}/${messageId}.jpg`;
  } catch {
    // fall through and try to generate a poster
  }

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      "00:00:00.100",
      "-i",
      targetPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      posterPath
    ]);

    return `/uploads/telegram/${channelSlug}/${messageId}.jpg`;
  } catch {
    return undefined;
  }
}

async function collectDraftPosts() {
  const { exportJsonPath, payload } = await readExportPayload();
  const chat = extractChat(payload);
  const exportDir = path.dirname(exportJsonPath);
  const channel = getOptionalChannel();
  const channelSlug = channel ? getChannelUsername(channel) : `export-${String(chat.id ?? "channel")}`;
  const telegramChatId = String(chat.id ?? channelSlug);
  const messages = chat.messages ?? [];
  const syntheticGroupIds = buildSyntheticGroupIds(messages);

  const drafts: DraftPost[] = [];

  for (const message of messages) {
    if (message.type !== "message" || !message.id) {
      continue;
    }

    const content = flattenText(message.text).trim();
    const media = await copyMedia(exportDir, channelSlug, message);

    if (!content && !media) {
      continue;
    }

    const publishedAt = message.date
      ? new Date(message.date).toISOString()
      : new Date(Number(message.date_unixtime ?? "0") * 1000).toISOString();

    drafts.push({
      telegramMessageId: message.id,
      telegramChatId,
      telegramMediaGroupId: getMediaGroupId(message) ?? syntheticGroupIds.get(message.id),
      content,
      entities: extractEntities(message),
      media: media ? [media] : [],
      publishedAt,
      sourceUrl: buildSourceUrl(channel, message.id)
    });
  }

  return drafts;
}

async function main() {
  const drafts = await collectDraftPosts();

  let imported = 0;
  for (const draft of drafts) {
    await upsertTelegramPost({
      telegramMessageId: draft.telegramMessageId,
      telegramChatId: draft.telegramChatId,
      telegramMediaGroupId: draft.telegramMediaGroupId,
      content: draft.content,
      entities: draft.entities,
      media: draft.media,
      publishedAt: draft.publishedAt,
      sourceUrl: draft.sourceUrl
    });

    imported += 1;
  }

  console.log(`Imported ${imported} posts from Telegram Desktop export`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
