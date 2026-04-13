import { NextResponse } from "next/server";

import { readPosts } from "@/lib/posts";

export async function GET() {
  const posts = await readPosts();
  return NextResponse.json({ posts });
}
