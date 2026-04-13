import { renderTelegramRichText } from "@/lib/telegram-format";
import type { BlogPostEntity } from "@/lib/types";

export function RichPostContent({
  content,
  entities
}: {
  content: string;
  entities?: BlogPostEntity[];
}) {
  return <div className="rich-post-content">{renderTelegramRichText(content, entities ?? [])}</div>;
}
