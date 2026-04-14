import type { Metadata } from "next";

import { ChannelHero } from "@/components/ChannelHero";
import { PostsFeed } from "@/components/PostsFeed";
import { readPostsPage } from "@/lib/posts";
import { createHomeMetadata, getSiteName } from "@/lib/site";

export const metadata: Metadata = createHomeMetadata();
export const dynamic = "force-dynamic";

const INITIAL_PAGE_SIZE = 12;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TG";
}

export default async function HomePage() {
  const initialPage = await readPostsPage({ offset: 0, limit: INITIAL_PAGE_SIZE });
  const siteName = getSiteName();
  const initials = getInitials(siteName);
  const channel = process.env.TELEGRAM_CHANNEL?.trim();
  const channelUrl = channel
    ? channel.startsWith("@")
      ? `https://t.me/${channel.slice(1)}`
      : /^https?:\/\//i.test(channel)
        ? channel
        : `https://t.me/${channel.replace(/^@/, "")}`
    : null;
  const avatarUrl = null;

  return (
    <main className="page-shell">
      <ChannelHero
        initialTitle={siteName}
        initialInitials={initials}
        initialChannelUrl={channelUrl}
        initialAvatarUrl={avatarUrl}
      />

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
            initialSiteName={siteName}
            initials={initials}
            initialChannelUrl={channelUrl}
            initialAvatarUrl={avatarUrl}
          />
        )}
      </section>
    </main>
  );
}
