"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { PostMedia } from "@/components/PostMedia";
import { RichPostContent } from "@/components/RichPostContent";
import type { BlogPost } from "@/lib/types";

const PAGE_SIZE = 12;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(date));
}

type PostsFeedProps = {
  initialPosts: BlogPost[];
  initialHasMore: boolean;
  siteName: string;
  initials: string;
  channelUrl: string | null;
  avatarUrl: string | null;
};

export function PostsFeed({
  initialPosts,
  initialHasMore,
  siteName,
  initials,
  channelUrl,
  avatarUrl
}: PostsFeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const avatar = useMemo(() => {
    return avatarUrl ? <img src={avatarUrl} alt="" /> : initials;
  }, [avatarUrl, initials]);

  useEffect(() => {
    if (!hasMore || isLoading) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setIsLoading(true);
      },
      {
        rootMargin: "600px 0px"
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    let cancelled = false;

    async function loadMore() {
      try {
        const response = await fetch(`/api/posts?offset=${posts.length}&limit=${PAGE_SIZE}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Не удалось загрузить следующую страницу постов");
        }

        const payload = (await response.json()) as {
          posts: BlogPost[];
          hasMore: boolean;
        };

        if (cancelled) {
          return;
        }

        setPosts((current) => {
          const next = [...current];

          for (const post of payload.posts) {
            if (!next.some((item) => item.id === post.id)) {
              next.push(post);
            }
          }

          return next;
        });
        setHasMore(payload.hasMore);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Ошибка загрузки постов");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMore();

    return () => {
      cancelled = true;
    };
  }, [isLoading, posts.length]);

  return (
    <>
      <div className="posts-feed">
        {posts.map((post) => (
          <article key={post.id} className="post-card">
            <div className="post-card__header">
              <div className="post-card__channel">
                <div className="post-card__avatar" aria-hidden="true">
                  {avatar}
                </div>
                <div className="post-card__channel-meta">
                  <strong>{siteName}</strong>
                  {channelUrl ? (
                    <span>
                      <a href={channelUrl} target="_blank" rel="noreferrer">
                        Канал в Telegram
                      </a>
                    </span>
                  ) : (
                    <span>Канал в Telegram</span>
                  )}
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

      {error ? <p className="posts-feed__status">{error}</p> : null}
      {isLoading ? <p className="posts-feed__status">Загружаем ещё посты…</p> : null}
      {!hasMore && posts.length > 0 ? <p className="posts-feed__status">Это конец ленты.</p> : null}
      <div ref={sentinelRef} className="posts-feed__sentinel" aria-hidden="true" />
    </>
  );
}
