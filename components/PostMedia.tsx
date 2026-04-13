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

export function PostMedia({ media }: { media?: BlogPostMedia[] }) {
  if (!media?.length) {
    return null;
  }

  return (
    <div className={`post-media post-media--count-${Math.min(media.length, 3)}`}>
      {media.map((item) => (
        <figure key={item.id} className={`post-media__item post-media__item--${item.kind}`}>
          {item.kind === "photo" ? (
            <img
              src={resolveMediaUrl(item)}
              alt=""
              width={item.width}
              height={item.height}
              loading="lazy"
            />
          ) : (
            <video
              src={resolveMediaUrl(item)}
              controls
              playsInline
              preload="metadata"
              width={item.width}
              height={item.height}
            />
          )}
        </figure>
      ))}
    </div>
  );
}
