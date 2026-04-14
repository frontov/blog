import { NextResponse } from "next/server";
import { z } from "zod";

import { readPostsPage } from "@/lib/posts";

const querySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = querySchema.parse({
    offset: url.searchParams.get("offset") ?? 0,
    limit: url.searchParams.get("limit") ?? 12
  });

  const page = await readPostsPage(query);
  return NextResponse.json(page);
}
