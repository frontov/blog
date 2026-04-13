export async function getTelegramFilePath(fileId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`, {
    next: { revalidate: 60 * 60 }
  });

  if (!response.ok) {
    throw new Error(`Telegram getFile request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    result?: { file_path?: string };
    description?: string;
  };

  if (!payload.ok || !payload.result?.file_path) {
    throw new Error(payload.description || "Telegram did not return file_path");
  }

  return payload.result.file_path;
}

export function buildTelegramFileUrl(filePath: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}
