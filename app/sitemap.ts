import type { MetadataRoute } from "next";

import { readPosts } from "@/lib/posts";
import { toAbsoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await readPosts();

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: toAbsoluteUrl(`/posts/${post.slug}`),
    lastModified: post.publishedAt,
    changeFrequency: "weekly",
    priority: 0.7
  }));

  return [
    {
      url: toAbsoluteUrl("/"),
      lastModified: posts[0]?.publishedAt || new Date().toISOString(),
      changeFrequency: "daily",
      priority: 1
    },
    ...postEntries
  ];
}
