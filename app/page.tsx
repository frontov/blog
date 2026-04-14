import type { Metadata } from "next";

import { PostsFeed } from "@/components/PostsFeed";
import { readPostsPage } from "@/lib/posts";
import { createHomeMetadata } from "@/lib/site";
import { getTelegramChannelProfile } from "@/lib/telegram-channel";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getTelegramChannelProfile();
  return createHomeMetadata(profile);
}

const INITIAL_PAGE_SIZE = 12;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TG";
}

export default async function HomePage() {
  const initialPage = await readPostsPage({ offset: 0, limit: INITIAL_PAGE_SIZE });
  const profile = await getTelegramChannelProfile();
  const siteName = profile.title;
  const initials = getInitials(siteName);
  const channelUrl = profile.url;
  const avatarUrl = profile.avatarLargeUrl || profile.avatarSmallUrl;

  return (
    <main className="page-shell">
      <section className="hero hero--channel">
        <div className="channel-header">
          <div className="channel-header__avatar" aria-hidden="true">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
          </div>

          <div className="channel-header__body">
            <h1>{siteName}</h1>
            {channelUrl ? (
              <p className="channel-header__link">
                <a href={channelUrl} target="_blank" rel="noreferrer">
                  Канал в Telegram
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section id="latest-posts" className="posts-section">
        {initialPage.posts.length === 0 ? (
          <div className="empty-state">
            <p>Пока постов нет.</p>
            <p>
              После подключения Telegram webhook новые записи появятся здесь
              автоматически.
            </p>
          </div>
        ) : (
          <PostsFeed
            initialPosts={initialPage.posts}
            initialHasMore={initialPage.hasMore}
            siteName={siteName}
            initials={initials}
            channelUrl={channelUrl}
            avatarUrl={avatarUrl}
          />
        )}
      </section>
    </main>
  );
}
