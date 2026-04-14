import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import type { BlogPost } from "@/lib/types";

const postEntitySchema = z.object({
  offset: z.number(),
  length: z.number(),
  type: z.string(),
  url: z.string().optional(),
  language: z.string().optional()
});

const postMediaSchema = z.object({
  id: z.string(),
  kind: z.union([z.literal("photo"), z.literal("video")]),
  fileId: z.string().optional(),
  url: z.string().optional(),
  posterUrl: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  mimeType: z.string().optional()
});

const postSchema = z.object({
  id: z.string(),
  telegramMessageId: z.number(),
  telegramChatId: z.string(),
  telegramMediaGroupId: z.string().optional(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  content: z.string(),
  entities: z.array(postEntitySchema).optional(),
  media: z.array(postMediaSchema).optional(),
  coverImage: z.string().optional(),
  publishedAt: z.string(),
  sourceUrl: z.string().optional()
});

const postsSchema = z.array(postSchema);
const entitiesSchema = z.array(postEntitySchema);
const mediaSchema = z.array(postMediaSchema);

const dataDirPath = path.join(process.cwd(), "data");
const dataFilePath = path.join(dataDirPath, "posts.json");
const databaseFilePath = path.join(dataDirPath, "blog.sqlite");

let database: DatabaseSync | null = null;

function slugify(text: string) {
  const transliterationMap: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ы: "y", э: "e", ю: "yu", я: "ya", ь: "", ъ: ""
  };

  return text
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => transliterationMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractTitle(text: string, mediaCount = 0) {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean);
  if (firstLine) {
    return firstLine.slice(0, 80);
  }

  if (mediaCount > 0) {
    return mediaCount > 1 ? "Медиаподборка" : "Медиапост";
  }

  return "Новый пост";
}

function extractExcerpt(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function parseJsonArray<T>(value: string | null, schema: z.ZodType<T[]>) {
  if (!value) {
    return undefined;
  }

  const parsed = JSON.parse(value);
  const result = schema.parse(parsed);
  return result.length ? result : undefined;
}

function normalizeLegacyUploadUrl(value: string | undefined) {
  if (!value) {
    return value;
  }

  return value.replace("/uploads/telegram/carbopunk/", "/uploads/telegram/carbonpunk/");
}

function parseMediaArray(value: string | null) {
  const media = parseJsonArray(value, mediaSchema);

  if (!media) {
    return undefined;
  }

  return media.map((item) => ({
    ...item,
    url: normalizeLegacyUploadUrl(item.url),
    posterUrl: normalizeLegacyUploadUrl(item.posterUrl)
  }));
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizePost(row: Record<string, unknown>) {
  return postSchema.parse({
    id: row.id,
    telegramMessageId: row.telegram_message_id,
    telegramChatId: row.telegram_chat_id,
    telegramMediaGroupId: optionalString(row.telegram_media_group_id),
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    entities: parseJsonArray(
      typeof row.entities_json === "string" ? row.entities_json : null,
      entitiesSchema
    ),
    media: parseMediaArray(typeof row.media_json === "string" ? row.media_json : null),
    coverImage: normalizeLegacyUploadUrl(optionalString(row.cover_image)),
    publishedAt: row.published_at,
    sourceUrl: optionalString(row.source_url)
  });
}

function openDatabase() {
  if (database) {
    return database;
  }

  mkdirSync(dataDirPath, { recursive: true });

  const db = new DatabaseSync(databaseFilePath);
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      telegram_message_id INTEGER NOT NULL,
      telegram_chat_id TEXT NOT NULL,
      telegram_media_group_id TEXT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      entities_json TEXT,
      media_json TEXT,
      cover_image TEXT,
      published_at TEXT NOT NULL,
      source_url TEXT
    );
  `);

  ensurePostsColumn(db, "telegram_media_group_id", "TEXT");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts (published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts (slug);
    CREATE INDEX IF NOT EXISTS idx_posts_media_group
      ON posts (telegram_chat_id, telegram_media_group_id);
  `);
  migrateLegacyJsonIfNeeded(db);
  database = db;
  return db;
}

function ensurePostsColumn(db: DatabaseSync, columnName: string, definition: string) {
  const columns = db.prepare("PRAGMA table_info(posts)").all() as Array<{ name?: string }>;
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.exec(`ALTER TABLE posts ADD COLUMN ${columnName} ${definition}`);
  }
}

function migrateLegacyJsonIfNeeded(db: DatabaseSync) {
  const migrationRow = db
    .prepare("SELECT value FROM metadata WHERE key = 'posts_json_migrated'")
    .get() as { value?: string } | undefined;

  if (migrationRow?.value === "1") {
    return;
  }

  if (existsSync(dataFilePath)) {
    const raw = readFileSync(dataFilePath, "utf8");
    const parsed = raw.trim() ? JSON.parse(raw) : [];
    const posts = postsSchema.parse(parsed);

    const insertStatement = db.prepare(`
      INSERT INTO posts (
        id,
        telegram_message_id,
        telegram_chat_id,
        telegram_media_group_id,
        slug,
        title,
        excerpt,
        content,
        entities_json,
        media_json,
        cover_image,
        published_at,
        source_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        telegram_message_id = excluded.telegram_message_id,
        telegram_chat_id = excluded.telegram_chat_id,
        telegram_media_group_id = excluded.telegram_media_group_id,
        slug = excluded.slug,
        title = excluded.title,
        excerpt = excluded.excerpt,
        content = excluded.content,
        entities_json = excluded.entities_json,
        media_json = excluded.media_json,
        cover_image = excluded.cover_image,
        published_at = excluded.published_at,
        source_url = excluded.source_url
    `);

    db.exec("BEGIN");

    try {
      for (const post of posts) {
        insertStatement.run(
          post.id,
          post.telegramMessageId,
          post.telegramChatId,
          post.telegramMediaGroupId ?? null,
          post.slug,
          post.title,
          post.excerpt,
          post.content,
          post.entities?.length ? JSON.stringify(post.entities) : null,
          post.media?.length ? JSON.stringify(post.media) : null,
          post.coverImage ?? null,
          post.publishedAt,
          post.sourceUrl ?? null
        );
      }

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  db.prepare(`
    INSERT INTO metadata (key, value)
    VALUES ('posts_json_migrated', '1')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run();
}

export async function readPosts() {
  const db = openDatabase();
  const rows = db.prepare(`
    SELECT
      id,
      telegram_message_id,
      telegram_chat_id,
      telegram_media_group_id,
      slug,
      title,
      excerpt,
      content,
      entities_json,
      media_json,
      cover_image,
      published_at,
      source_url
    FROM posts
    ORDER BY published_at DESC
  `).all() as Record<string, unknown>[];

  return rows.map((row) => normalizePost(row));
}

export async function readPostsPage({
  offset = 0,
  limit = 12
}: {
  offset?: number;
  limit?: number;
}) {
  const db = openDatabase();
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, Math.min(limit, 50));

  const rows = db.prepare(`
    SELECT
      id,
      telegram_message_id,
      telegram_chat_id,
      telegram_media_group_id,
      slug,
      title,
      excerpt,
      content,
      entities_json,
      media_json,
      cover_image,
      published_at,
      source_url
    FROM posts
    ORDER BY published_at DESC
    LIMIT ?
    OFFSET ?
  `).all(safeLimit, safeOffset) as Record<string, unknown>[];

  const totalRow = db.prepare("SELECT COUNT(*) AS count FROM posts").get() as { count?: number } | undefined;
  const total = totalRow?.count ?? 0;

  return {
    posts: rows.map((row) => normalizePost(row)),
    total,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + rows.length < total
  };
}

export async function readPostBySlug(slug: string) {
  const db = openDatabase();
  const row = db.prepare(`
    SELECT
      id,
      telegram_message_id,
      telegram_chat_id,
      telegram_media_group_id,
      slug,
      title,
      excerpt,
      content,
      entities_json,
      media_json,
      cover_image,
      published_at,
      source_url
    FROM posts
    WHERE slug = ?
    LIMIT 1
  `).get(slug) as Record<string, unknown> | undefined;

  return row ? normalizePost(row) : null;
}

export async function upsertTelegramPost(input: {
  telegramMessageId: number;
  telegramChatId: string;
  telegramMediaGroupId?: string;
  content: string;
  entities?: BlogPost["entities"];
  media?: BlogPost["media"];
  publishedAt: string;
  coverImage?: string;
  sourceUrl?: string;
}) {
  const db = openDatabase();
  const existing = input.telegramMediaGroupId
    ? (db.prepare(`
        SELECT
          id,
          telegram_message_id,
          telegram_chat_id,
          telegram_media_group_id,
          slug,
          title,
          excerpt,
          content,
          entities_json,
          media_json,
          cover_image,
          published_at,
          source_url
        FROM posts
        WHERE telegram_chat_id = ?
          AND telegram_media_group_id = ?
        LIMIT 1
      `).get(input.telegramChatId, input.telegramMediaGroupId) as Record<string, unknown> | undefined)
    : undefined;

  const existingPost = existing ? normalizePost(existing) : null;
  const mergedContent = input.content.trim() || existingPost?.content || "";
  const mergedEntities = input.entities?.length
    ? input.entities
    : existingPost?.entities;
  const mergedMedia = mergeMedia(existingPost?.media, input.media);
  const mergedCoverImage = input.coverImage ?? existingPost?.coverImage;
  const mergedSourceUrl = input.sourceUrl ?? existingPost?.sourceUrl;
  const publishedAt = earliestIsoDate(existingPost?.publishedAt, input.publishedAt);

  const title = extractTitle(mergedContent, mergedMedia?.length ?? 0);
  const excerpt = extractExcerpt(mergedContent) || "Пост из Telegram с фото или видео.";
  const fallbackMessageId = existingPost?.telegramMessageId ?? input.telegramMessageId;
  const telegramMessageId = input.telegramMediaGroupId
    ? Math.min(fallbackMessageId, input.telegramMessageId)
    : input.telegramMessageId;
  const baseSlug = slugify(title) || `post-${telegramMessageId}`;
  const generatedSlug = `${baseSlug}-${telegramMessageId}`;
  const shouldRefreshSlug = Boolean(
    existingPost &&
    !existingPost.content.trim() &&
    mergedContent.trim()
  );
  const slug = existingPost?.slug && !shouldRefreshSlug ? existingPost.slug : generatedSlug;

  const post: BlogPost = {
    id: existingPost?.id ?? buildPostId(input.telegramChatId, telegramMessageId, input.telegramMediaGroupId),
    telegramMessageId,
    telegramChatId: input.telegramChatId,
    telegramMediaGroupId: input.telegramMediaGroupId,
    slug,
    title,
    excerpt,
    content: mergedContent,
    entities: mergedEntities,
    media: mergedMedia,
    coverImage: mergedCoverImage,
    publishedAt,
    sourceUrl: mergedSourceUrl
  };

  db.prepare(`
    INSERT INTO posts (
      id,
      telegram_message_id,
      telegram_chat_id,
      telegram_media_group_id,
      slug,
      title,
      excerpt,
      content,
      entities_json,
      media_json,
      cover_image,
      published_at,
      source_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      telegram_message_id = excluded.telegram_message_id,
      telegram_chat_id = excluded.telegram_chat_id,
      telegram_media_group_id = excluded.telegram_media_group_id,
      slug = excluded.slug,
      title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      entities_json = excluded.entities_json,
      media_json = excluded.media_json,
      cover_image = excluded.cover_image,
      published_at = excluded.published_at,
      source_url = excluded.source_url
  `).run(
    post.id,
    post.telegramMessageId,
    post.telegramChatId,
    post.telegramMediaGroupId ?? null,
    post.slug,
    post.title,
    post.excerpt,
    post.content,
    post.entities?.length ? JSON.stringify(post.entities) : null,
    post.media?.length ? JSON.stringify(post.media) : null,
    post.coverImage ?? null,
    post.publishedAt,
    post.sourceUrl ?? null
  );

  return post;
}

function buildPostId(telegramChatId: string, telegramMessageId: number, telegramMediaGroupId?: string) {
  if (telegramMediaGroupId) {
    return `${telegramChatId}:group:${telegramMediaGroupId}`;
  }

  return `${telegramChatId}:${telegramMessageId}`;
}

function mergeMedia(existing?: BlogPost["media"], incoming?: BlogPost["media"]) {
  const merged = [...(existing ?? [])];

  for (const item of incoming ?? []) {
    const duplicate = merged.find((current) => {
      if (current.id === item.id) {
        return true;
      }

      if (current.fileId && item.fileId) {
        return current.fileId === item.fileId;
      }

      if (current.url && item.url) {
        return current.url === item.url;
      }

      return false;
    });

    if (!duplicate) {
      merged.push(item);
    }
  }

  return merged.length ? merged : undefined;
}

function earliestIsoDate(...values: Array<string | undefined>) {
  const normalized = values.filter(Boolean) as string[];

  if (!normalized.length) {
    return new Date().toISOString();
  }

  return normalized.sort((left, right) => {
    return new Date(left).getTime() - new Date(right).getTime();
  })[0];
}
