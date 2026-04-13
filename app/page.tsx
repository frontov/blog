import type { Metadata } from "next";
import Link from "next/link";

import { PostMedia } from "@/components/PostMedia";
import { RichPostContent } from "@/components/RichPostContent";
import { readPosts } from "@/lib/posts";
import { createHomeMetadata, getSiteName } from "@/lib/site";

export const metadata: Metadata = createHomeMetadata();

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(date));
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TG";
}

export default async function HomePage() {
  const posts = await readPosts();
  const siteName = getSiteName();
  const initials = getInitials(siteName);

  return (
    <main className="page-shell">
      <section className="hero hero--channel">
        <div className="channel-header">
          <div className="channel-header__avatar" aria-hidden="true">
            {initials}
          </div>

          <div className="channel-header__body">
            <div className="hero__eyebrow">Telegram channel archive</div>
            <h1>{siteName}</h1>
            <p>
              Посты из канала в спокойном формате ленты: текст, фото, видео и
              отдельные страницы публикаций.
            </p>
            <div className="hero__meta">
              <span>{posts.length} постов</span>
              <span>Публичный архив канала</span>
              <span>Автопубликация из Telegram</span>
            </div>
          </div>
        </div>
      </section>

      <section id="latest-posts" className="posts-section">
        <div className="section-heading">
          <h2>Лента</h2>
          <span>Последние публикации</span>
        </div>

        {posts.length === 0 ? (
          <div className="empty-state">
            <p>Пока постов нет.</p>
            <p>
              После подключения Telegram webhook новые записи появятся здесь
              автоматически.
            </p>
          </div>
        ) : (
          <div className="posts-feed">
            {posts.map((post) => (
              <article key={post.id} className="post-card">
                <div className="post-card__header">
                  <div className="post-card__channel">
                    <div className="post-card__avatar" aria-hidden="true">
                      {initials}
                    </div>
                    <div className="post-card__channel-meta">
                      <strong>{siteName}</strong>
                      <span>Канал в Telegram</span>
                    </div>
                  </div>

                  <div className="post-card__meta">
                    <span>{formatDate(post.publishedAt)}</span>
                    <span>Пост</span>
                  </div>
                </div>

                <PostMedia media={post.media} />

                <h3>{post.title}</h3>
                <RichPostContent content={post.excerpt} />

                <div className="post-card__footer">
                  <Link href={`/posts/${post.slug}`}>Открыть пост</Link>
                  {post.sourceUrl ? (
                    <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                      Открыть в Telegram
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
