import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostMedia } from "@/components/PostMedia";
import { RichPostContent } from "@/components/RichPostContent";
import { readPostBySlug } from "@/lib/posts";
import { createPostMetadata } from "@/lib/site";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(date));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await readPostBySlug(slug);

  if (!post) {
    return {
      title: "Пост не найден"
    };
  }

  return createPostMetadata(post);
}

export default async function PostPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await readPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="post-page">
      <div className="post-page__back">
        <Link href="/">Назад к ленте</Link>
      </div>

      <article className="post-view">
        <PostMedia media={post.media} />

        <div className="post-view__meta">
          <span>{formatDate(post.publishedAt)}</span>
          <span>#{post.telegramMessageId}</span>
        </div>

        <h1>{post.title}</h1>

        <div className="post-view__content">
          <RichPostContent content={post.content} entities={post.entities} />
        </div>

        {post.sourceUrl ? (
          <a className="post-view__source" href={post.sourceUrl} target="_blank" rel="noreferrer">
            Читать оригинал в Telegram
          </a>
        ) : null}
      </article>
    </main>
  );
}
