import type { BlogPostEntity, BlogPostMedia } from "@/lib/types";

type TelegramEntity = {
  offset: number;
  length: number;
  type: string;
  url?: string;
  language?: string;
};

type TelegramPhoto = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};

type TelegramVideo = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
  file_size?: number;
};

export type TelegramChannelPost = {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  entities?: TelegramEntity[];
  caption_entities?: TelegramEntity[];
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
  chat: {
    id: number | string;
    title?: string;
    username?: string;
    type: string;
  };
};

export type TelegramUpdate = {
  update_id: number;
  channel_post?: TelegramChannelPost;
  edited_channel_post?: TelegramChannelPost;
};

export function extractPostContent(post: TelegramChannelPost) {
  return (post.text ?? post.caption ?? "").trim();
}

export function extractPostEntities(post: TelegramChannelPost): BlogPostEntity[] {
  const entities = post.text ? post.entities : post.caption_entities;
  return (entities ?? []).map((entity) => ({
    offset: entity.offset,
    length: entity.length,
    type: entity.type,
    url: entity.url,
    language: entity.language
  }));
}

export function buildTelegramPostUrl(post: TelegramChannelPost) {
  if (post.chat.username) {
    return `https://t.me/${post.chat.username}/${post.message_id}`;
  }

  return undefined;
}

export function extractLargestPhoto(post: TelegramChannelPost) {
  if (!post.photo?.length) {
    return undefined;
  }

  const largest = [...post.photo].sort((a, b) => {
    const aArea = a.width * a.height;
    const bArea = b.width * b.height;
    return bArea - aArea;
  })[0];

  return largest.file_id;
}

export function extractPostMedia(post: TelegramChannelPost): BlogPostMedia[] {
  const media: BlogPostMedia[] = [];

  if (post.photo?.length) {
    const largest = [...post.photo].sort((a, b) => {
      const aArea = a.width * a.height;
      const bArea = b.width * b.height;
      return bArea - aArea;
    })[0];

    media.push({
      id: largest.file_unique_id,
      kind: "photo",
      fileId: largest.file_id,
      width: largest.width,
      height: largest.height
    });
  }

  if (post.video) {
    media.push({
      id: post.video.file_unique_id,
      kind: "video",
      fileId: post.video.file_id,
      width: post.video.width,
      height: post.video.height,
      duration: post.video.duration,
      mimeType: post.video.mime_type
    });
  }

  return media;
}
