import type { Metadata } from "next";

import type { TelegramChannelProfile } from "@/lib/telegram-channel";
import type { BlogPost } from "@/lib/types";

const fallbackSiteUrl = "https://example.com";
const fallbackSiteName = "Roman Blog";
const fallbackDescription = "Личный блог с публикациями из Telegram, оформленный как современный публичный сайт.";

export function getSiteUrl() {
  return process.env.SITE_URL || fallbackSiteUrl;
}

export function getSiteName() {
  return process.env.SITE_NAME || fallbackSiteName;
}

export function getSiteDescription() {
  return fallbackDescription;
}

export function toAbsoluteUrl(pathname = "/") {
  return new URL(pathname, getSiteUrl()).toString();
}

export function createRootMetadata(profile?: TelegramChannelProfile): Metadata {
  const siteName = profile?.title || getSiteName();
  const description = getSiteDescription();
  const iconUrl = profile?.avatarSmallUrl || profile?.avatarLargeUrl || undefined;

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: siteName,
      template: `%s | ${siteName}`
    },
    description,
    applicationName: siteName,
    keywords: [
      "блог",
      "telegram blog",
      "личный сайт",
      "посты из telegram",
      siteName
    ],
    alternates: {
      canonical: "/"
    },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url: getSiteUrl(),
      siteName,
      title: siteName,
      description
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description
    },
    icons: iconUrl
      ? {
          icon: [{ url: iconUrl }],
          apple: [{ url: iconUrl }]
        }
      : undefined,
    robots: {
      index: true,
      follow: true
    },
    category: "blog"
  };
}

export function createHomeMetadata(profile?: TelegramChannelProfile): Metadata {
  const siteName = profile?.title || getSiteName();
  const description = "Публичный блог с заметками, фото и видео из Telegram-канала. Свежие публикации, отдельные страницы постов и читаемый журнальный формат.";

  return {
    title: siteName,
    description,
    alternates: {
      canonical: "/"
    },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      url: toAbsoluteUrl("/"),
      siteName,
      title: siteName,
      description
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description
    }
  };
}

export function createPostMetadata(post: BlogPost): Metadata {
  const description = post.excerpt || getSiteDescription();
  const canonicalPath = `/posts/${post.slug}`;

  return {
    title: post.title,
    description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      type: "article",
      locale: "ru_RU",
      url: toAbsoluteUrl(canonicalPath),
      siteName: getSiteName(),
      title: post.title,
      description,
      publishedTime: post.publishedAt
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description
    }
  };
}
