"use client";

import { useEffect, useState } from "react";

type ChannelHeroProps = {
  initialTitle: string;
  initialInitials: string;
  initialChannelUrl: string | null;
  initialAvatarUrl: string | null;
};

type ChannelProfilePayload = {
  title: string;
  url: string | null;
  avatarSmallUrl: string | null;
  avatarLargeUrl: string | null;
};

export function ChannelHero({
  initialTitle,
  initialInitials,
  initialChannelUrl,
  initialAvatarUrl
}: ChannelHeroProps) {
  const [profile, setProfile] = useState<ChannelProfilePayload>({
    title: initialTitle,
    url: initialChannelUrl,
    avatarSmallUrl: initialAvatarUrl,
    avatarLargeUrl: initialAvatarUrl
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/telegram/channel-profile", {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ChannelProfilePayload;

        if (!cancelled) {
          setProfile({
            title: payload.title || initialTitle,
            url: payload.url ?? initialChannelUrl,
            avatarSmallUrl: payload.avatarSmallUrl,
            avatarLargeUrl: payload.avatarLargeUrl
          });
        }
      } catch {
        // Keep initial fallback if runtime profile loading fails.
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [initialChannelUrl, initialTitle]);

  const avatarUrl = profile.avatarLargeUrl || profile.avatarSmallUrl;

  return (
    <section className="hero hero--channel">
      <div className="channel-header">
        <div className="channel-header__avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : initialInitials}
        </div>

        <div className="channel-header__body">
          <h1>{profile.title}</h1>
          {profile.url ? (
            <p className="channel-header__link">
              <a href={profile.url} target="_blank" rel="noreferrer">
                Канал в Telegram
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
