# Telegram Blog

Минимальный проект для личного блога, где:

- сайт показывает список постов и отдельные страницы публикаций;
- Telegram webhook принимает новые посты из канала;
- публикации сохраняются в SQLite-базе `data/blog.sqlite` и сразу появляются на сайте.

## Что внутри

- `app/` — страницы сайта и API-роуты Next.js;
- `app/api/telegram/webhook/route.ts` — приём постов из Telegram;
- `lib/posts.ts` — чтение и сохранение постов;
- `app/api/telegram/file/route.ts` — прокси для фото и видео из Telegram;
- `data/blog.sqlite` — основная база постов.

## Запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` на основе примера:

```bash
cp .env.example .env
```

3. Запустить проект:

```bash
npm run dev
```

## Запуск в Docker

1. Заполни `.env`:

```bash
cp .env.example .env
```

2. Собери и запусти контейнер:

```bash
docker compose up -d --build
```

3. Сайт будет доступен на `http://localhost:3000`.

Данные постов сохраняются в Docker volume `blog_data`, поэтому база `data/blog.sqlite` не пропадёт после перезапуска контейнера.

Если хочешь остановить контейнер:

```bash
docker compose down
```

## Как подключить Telegram

1. Создай бота через `@BotFather`.
2. Добавь бота администратором в свой канал.
3. Укажи `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` и `SITE_URL` в `.env`.
4. Зарегистрируй webhook:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$SITE_URL/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

После этого новые посты из канала будут отправляться в API и появляться на сайте.

Для production-режима в Docker особенно важно:

- указать реальный `SITE_URL` с `https://`;
- открыть на сервере порт, через который сайт будет доступен снаружи;
- зарегистрировать webhook уже на публичный адрес сайта.

## Импорт старых постов из Telegram Desktop export

Текущий webhook забирает только новые публикации. Для загрузки старой истории канала есть отдельный импортёр из экспорта Telegram Desktop.

Как выгрузить архив:

1. Открой Telegram Desktop.
2. Перейди в нужный канал.
3. Выбери `Export chat history`.
4. Включи `Photos`, `Videos` и формат `Machine-readable JSON`.
5. Дождись завершения экспорта.

Что нужно заполнить в `.env`:

```env
TELEGRAM_EXPORT_PATH=/absolute/path/to/telegram-export/result.json
TELEGRAM_CHANNEL=@your_channel
```

`TELEGRAM_CHANNEL` нужен только чтобы сайт мог собрать ссылки вида `https://t.me/<channel>/<message_id>`.

Запуск:

```bash
npm run import:telegram-history
```

Импортёр:

- читает `result.json` из Telegram Desktop export;
- копирует фото и видео в `public/uploads/telegram`;
- сохраняет посты в `data/blog.sqlite`;
- не мешает дальнейшей автопубликации новых постов через webhook.

## Запуск на сервере с существующим Caddy

Если на сервере уже есть reverse proxy `Caddy`, можно запускать блог без проброса порта наружу:

```bash
docker-compose -f docker-compose.server.yml up -d
```

В этом режиме контейнер подключается к сети `sporza_default`, а пример блока для Caddy лежит в `deploy/Caddyfile.blog`.

## Простой деплой на сервер

Для этого проекта используется более простой operational path без registry и без автодеплоя через GitHub Actions:

```bash
cd /opt/blog
git pull --ff-only
docker-compose -f docker-compose.server.yml up -d --build
docker exec sporza-caddy caddy reload --config /etc/caddy/Caddyfile
```

То же самое делает короткий серверный скрипт:

```bash
sh scripts/server-update.sh
```

Смысл такой:

1. код обновляется обычным `git pull`
2. Docker на сервере сам пересобирает контейнер
3. `Caddy` перезагружается и начинает отдавать новую версию

Это проще поддерживать для личного блога, чем отдельный registry и SSH-деплой из GitHub Actions.

## Что уже поддерживается

- фото и видео из Telegram-постов;
- форматирование `bold`, `italic`, `underline`, `strikethrough`, `code`, `pre`, ссылки и теги;
- отдельные страницы постов с полноразмерным медиа-блоком;
- SEO-метаданные для главной и отдельных постов;
- публичная главная страница с hero-блоком и featured-постом;
- `sitemap.xml` и `robots.txt` для индексации.

## Что можно улучшить дальше

- загружать изображения Telegram через `getFile` и сохранять локально или в S3;
- заменить SQLite на Postgres, если захочется вынести блог за пределы одного сервера;
- добавить админку, теги, SEO и RSS;
- форматировать Telegram entities в HTML вместо простого текста.
