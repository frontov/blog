"use client";

import { useEffect, useState, type CSSProperties } from "react";

import type { BlogPostMedia } from "@/lib/types";

function buildMediaUrl(fileId: string) {
  return `/api/telegram/file?fileId=${encodeURIComponent(fileId)}`;
}

function resolveMediaUrl(item: BlogPostMedia) {
  if (item.url) {
    return item.url;
  }

  if (item.fileId) {
    return buildMediaUrl(item.fileId);
  }

  return "";
}

function buildThumbUrl(src: string) {
  return `/api/media/thumb?src=${encodeURIComponent(src)}`;
}

function resolvePosterUrl(item: BlogPostMedia) {
  if (item.posterUrl) {
    return item.posterUrl;
  }

  if (item.kind !== "video" || !item.url?.startsWith("/")) {
    return undefined;
  }

  return item.url.replace(/\.[^./?#]+$/, ".jpg");
}

function resolvePreviewUrl(item: BlogPostMedia) {
  if (item.kind === "photo") {
    const source = resolveMediaUrl(item);
    return source ? buildThumbUrl(source) : source;
  }

  const poster = resolvePosterUrl(item);
  return poster ? buildThumbUrl(poster) : undefined;
}

function isPortrait(item: BlogPostMedia) {
  if (!item.width || !item.height) {
    return false;
  }

  return item.height > item.width;
}

function getGalleryLayout(media: BlogPostMedia[]) {
  if (media.length === 1) {
    return "single";
  }

  if (media.length === 2) {
    return "pair";
  }

  if (media.length === 3) {
    return isPortrait(media[0]) ? "triple-portrait" : "triple-landscape";
  }

  if (media.length === 4) {
    return "quad";
  }

  return "mosaic";
}

function getItemClassName(layout: string, index: number) {
  if (layout === "triple-portrait") {
    if (index === 0) {
      return "post-media__item--hero-tall";
    }

    return "post-media__item--tile";
  }

  if (layout === "triple-landscape") {
    if (index === 0) {
      return "post-media__item--hero-wide";
    }

    return "post-media__item--tile";
  }

  if (layout === "single") {
    return "post-media__item--single";
  }

  return "post-media__item--tile";
}

function getItemStyle(item: BlogPostMedia, layout: string): CSSProperties | undefined {
  if (layout !== "single") {
    return undefined;
  }

  if (!item.width || !item.height) {
    return { aspectRatio: "16 / 10" };
  }

  const ratio = item.width / item.height;
  const clampedRatio = Math.max(0.8, Math.min(ratio, 1.77));

  return {
    aspectRatio: `${clampedRatio}`
  };
}

type ViewerItem = {
  kind: BlogPostMedia["kind"];
  src: string;
  poster?: string;
};

function MediaViewer({
  items,
  activeIndex,
  onSelect,
  onClose
}: {
  items: ViewerItem[];
  activeIndex: number | null;
  onSelect: (nextIndex: number) => void;
  onClose: () => void;
}) {
  const item = activeIndex === null ? null : items[activeIndex] ?? null;
  const currentIndex = activeIndex ?? 0;

  useEffect(() => {
    if (!item) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSelect((currentIndex + 1) % items.length);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelect((currentIndex - 1 + items.length) % items.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [currentIndex, item, items.length, onClose, onSelect]);

  if (!item) {
    return null;
  }

  const hasMultipleItems = items.length > 1;

  return (
    <div className="media-viewer" role="dialog" aria-modal="true" onClick={onClose}>
      <button
        type="button"
        className="media-viewer__close"
        onClick={onClose}
        aria-label="Закрыть просмотр"
      >
        ×
      </button>

      {hasMultipleItems ? (
        <button
          type="button"
          className="media-viewer__nav media-viewer__nav--prev"
          onClick={(event) => {
            event.stopPropagation();
            onSelect((currentIndex - 1 + items.length) % items.length);
          }}
          aria-label="Предыдущее медиа"
        >
          ‹
        </button>
      ) : null}

      {hasMultipleItems ? (
        <button
          type="button"
          className="media-viewer__nav media-viewer__nav--next"
          onClick={(event) => {
            event.stopPropagation();
            onSelect((currentIndex + 1) % items.length);
          }}
          aria-label="Следующее медиа"
        >
          ›
        </button>
      ) : null}

      <div className="media-viewer__content" onClick={(event) => event.stopPropagation()}>
        {item.kind === "photo" ? (
          <img className="media-viewer__image" src={item.src} alt="" />
        ) : (
          <video
            className="media-viewer__video"
            src={item.src}
            poster={item.poster}
            controls
            autoPlay
            playsInline
            preload="metadata"
          />
        )}
      </div>
    </div>
  );
}

export function PostMedia({ media }: { media?: BlogPostMedia[] }) {
  if (!media?.length) {
    return null;
  }

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const layout = getGalleryLayout(media);
  const viewerItems = media.map((item) => ({
    kind: item.kind,
    src: resolveMediaUrl(item),
    poster: resolvePosterUrl(item)
  }));
  const previewItems = media.map((item) => resolvePreviewUrl(item));

  return (
    <>
      <div className={`post-media post-media--${layout}`}>
        {media.map((item, index) => {
          return (
            <figure
              key={item.id}
              className={`post-media__item post-media__item--${item.kind} ${getItemClassName(layout, index)}`}
              style={getItemStyle(item, layout)}
            >
              <button
                type="button"
                className="post-media__trigger"
                onClick={() => setActiveIndex(index)}
                aria-label={item.kind === "photo" ? "Увеличить изображение" : "Открыть видео"}
              >
                {item.kind === "photo" ? (
                  <img
                    src={previewItems[index] || viewerItems[index].src}
                    alt=""
                    width={item.width}
                    height={item.height}
                    loading="lazy"
                  />
                ) : (
                  <span className="post-media__video-thumb">
                    {viewerItems[index].poster ? (
                      <img
                        src={previewItems[index] || viewerItems[index].poster}
                        alt=""
                        width={item.width}
                        height={item.height}
                        loading="lazy"
                      />
                    ) : (
                      <span className="post-media__video-fallback" aria-hidden="true" />
                    )}
                    <span className="post-media__play-badge" aria-hidden="true">
                      ▶
                    </span>
                  </span>
                )}
              </button>
            </figure>
          );
        })}
      </div>

      <MediaViewer
        items={viewerItems}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        onClose={() => setActiveIndex(null)}
      />
    </>
  );
}
