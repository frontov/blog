import type { BlogPostMedia } from "@/lib/types";

function buildMediaUrl(fileId: string) {
  return `/api/telegram/file?fileId=${encodeURIComponent(fileId)}`;
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
              src={buildMediaUrl(item.fileId)}
              alt=""
              width={item.width}
              height={item.height}
              loading="lazy"
            />
          ) : (
            <video
              src={buildMediaUrl(item.fileId)}
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
