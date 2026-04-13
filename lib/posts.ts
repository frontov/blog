import { promises as fs } from "node:fs";
import path from "node:path";
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
  width: z.number().optional(),
  height: z.number().optional(),
  duration: z.number().optional(),
  mimeType: z.string().optional()
});

const postSchema = z.object({
  id: z.string(),
  telegramMessageId: z.number(),
  telegramChatId: z.string(),
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
const dataFilePath = path.join(process.cwd(), "data", "posts.json");

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

async function ensureDataFile() {
  await fs.mkdir(path.dirname(dataFilePath), { recursive: true });

  try {
    await fs.access(dataFilePath);
  } catch {
    await fs.writeFile(dataFilePath, "[]\n", "utf8");
  }
}

export async function readPosts() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFilePath, "utf8");
  const parsed = JSON.parse(raw);
  const posts = postsSchema.parse(parsed);

  return posts.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

export async function readPostBySlug(slug: string) {
  const posts = await readPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}

export async function upsertTelegramPost(input: {
  telegramMessageId: number;
  telegramChatId: string;
  content: string;
  entities?: BlogPost["entities"];
  media?: BlogPost["media"];
  publishedAt: string;
  coverImage?: string;
  sourceUrl?: string;
}) {
  const posts = await readPosts();
  const title = extractTitle(input.content, input.media?.length ?? 0);
  const excerpt = extractExcerpt(input.content) || "Пост из Telegram с фото или видео.";
  const baseSlug = slugify(title) || `post-${input.telegramMessageId}`;
  const slug = `${baseSlug}-${input.telegramMessageId}`;

  const post: BlogPost = {
    id: `${input.telegramChatId}:${input.telegramMessageId}`,
    telegramMessageId: input.telegramMessageId,
    telegramChatId: input.telegramChatId,
    slug,
    title,
    excerpt,
    content: input.content.trim(),
    entities: input.entities,
    media: input.media,
    coverImage: input.coverImage,
    publishedAt: input.publishedAt,
    sourceUrl: input.sourceUrl
  };

  const nextPosts = posts.filter((item) => item.id !== post.id);
  nextPosts.push(post);
  nextPosts.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  await fs.writeFile(dataFilePath, `${JSON.stringify(nextPosts, null, 2)}\n`, "utf8");

  return post;
}
