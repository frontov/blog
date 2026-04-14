import { NextResponse } from "next/server";

import { getTelegramChannelProfile } from "@/lib/telegram-channel";

export async function GET() {
  const profile = await getTelegramChannelProfile();
  return NextResponse.json(profile);
}
