export type BlogPostEntity = {
  offset: number;
  length: number;
  type: string;
  url?: string;
  language?: string;
};

export type BlogPostMedia = {
  id: string;
  kind: "photo" | "video";
  fileId?: string;
  url?: string;
  width?: number;
  height?: number;
  duration?: number;
  mimeType?: string;
};

export type BlogPost = {
  id: string;
  telegramMessageId: number;
  telegramChatId: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  entities?: BlogPostEntity[];
  media?: BlogPostMedia[];
  coverImage?: string;
  publishedAt: string;
  sourceUrl?: string;
};
