import type { ReactNode } from "react";

import type { BlogPostEntity } from "@/lib/types";

type Slice = {
  text: string;
  entity?: BlogPostEntity;
};

function escapeUrl(url: string) {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

function renderEntity(entity: BlogPostEntity, text: string, key: string) {
  switch (entity.type) {
    case "bold":
      return <strong key={key}>{text}</strong>;
    case "italic":
      return <em key={key}>{text}</em>;
    case "underline":
      return <span key={key} className="tg-underline">{text}</span>;
    case "strikethrough":
      return <span key={key} className="tg-strikethrough">{text}</span>;
    case "code":
      return <code key={key}>{text}</code>;
    case "pre":
      return <pre key={key} className="tg-pre">{text}</pre>;
    case "blockquote":
      return <span key={key} className="tg-blockquote">{text}</span>;
    case "text_link":
      return (
        <a key={key} href={escapeUrl(entity.url || "#")} target="_blank" rel="noreferrer">
          {text}
        </a>
      );
    case "url":
      return (
        <a key={key} href={escapeUrl(text)} target="_blank" rel="noreferrer">
          {text}
        </a>
      );
    case "mention":
    case "hashtag":
    case "cashtag":
      return <span key={key} className="tg-tag">{text}</span>;
    default:
      return <span key={key}>{text}</span>;
  }
}

function sliceText(content: string, entities: BlogPostEntity[]) {
  const points = new Set<number>([0, content.length]);

  for (const entity of entities) {
    points.add(entity.offset);
    points.add(entity.offset + entity.length);
  }

  const sortedPoints = [...points].sort((a, b) => a - b);
  const slices: Slice[] = [];

  for (let index = 0; index < sortedPoints.length - 1; index += 1) {
    const start = sortedPoints[index];
    const end = sortedPoints[index + 1];
    const text = content.slice(start, end);

    if (!text) {
      continue;
    }

    const entity = entities
      .filter((item) => item.offset <= start && item.offset + item.length >= end)
      .sort((a, b) => a.length - b.length)[0];

    slices.push({ text, entity });
  }

  return slices;
}

function renderInlineContent(content: string, entities: BlogPostEntity[], keyPrefix: string) {
  const slices = sliceText(content, entities);

  return slices.map((slice, index) => {
    const key = `${keyPrefix}-${index}`;
    return slice.entity ? renderEntity(slice.entity, slice.text, key) : <span key={key}>{slice.text}</span>;
  });
}

export function renderTelegramRichText(content: string, entities: BlogPostEntity[] = []) {
  if (!entities.length) {
    return content
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph, index) => (
        <p key={`paragraph-${index}`}>
          {paragraph.split("\n").map((line, lineIndex) => (
            <span key={`line-${lineIndex}`}>
              {line}
              {lineIndex < paragraph.split("\n").length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ));
  }

  const blocks = content.split(/\n{2,}/);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  blocks.forEach((block, blockIndex) => {
    const normalized = block.trim();

    if (!normalized) {
      cursor += block.length + 2;
      return;
    }

    const start = content.indexOf(block, cursor);
    const end = start + block.length;
    const blockEntities = entities
      .filter((entity) => entity.offset < end && entity.offset + entity.length > start)
      .map((entity) => ({
        ...entity,
        offset: Math.max(entity.offset - start, 0),
        length: Math.min(entity.offset + entity.length, end) - Math.max(entity.offset, start)
      }))
      .filter((entity) => entity.length > 0);

    const lines = block.split("\n");
    const children: ReactNode[] = [];
    let lineOffset = 0;

    lines.forEach((line, lineIndex) => {
      const lineEntities = blockEntities
        .filter((entity) => entity.offset < lineOffset + line.length && entity.offset + entity.length > lineOffset)
        .map((entity) => ({
          ...entity,
          offset: Math.max(entity.offset - lineOffset, 0),
          length: Math.min(entity.offset + entity.length, lineOffset + line.length) - Math.max(entity.offset, lineOffset)
        }))
        .filter((entity) => entity.length > 0);

      children.push(
        <span key={`block-${blockIndex}-line-${lineIndex}`}>
          {renderInlineContent(line, lineEntities, `block-${blockIndex}-line-${lineIndex}`)}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </span>
      );

      lineOffset += line.length + 1;
    });

    nodes.push(<p key={`block-${blockIndex}`}>{children}</p>);
    cursor = end + 2;
  });

  return nodes;
}
