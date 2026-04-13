# Telegram Blog

Минимальный проект для личного блога, где:

- сайт показывает список постов и отдельные страницы публикаций;
- Telegram webhook принимает новые посты из канала;
- публикации сохраняются в `data/posts.json` и сразу появляются на сайте.

## Что внутри

- `app/` — страницы сайта и API-роуты Next.js;
- `app/api/telegram/webhook/route.ts` — приём постов из Telegram;
- `lib/posts.ts` — чтение и сохранение постов;
- `app/api/telegram/file/route.ts` — прокси для фото и видео из Telegram;
- `data/posts.json` — текущее файловое хранилище.

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

Данные постов сохраняются в Docker volume `blog_data`, поэтому не пропадут после перезапуска контейнера.

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

## Запуск на сервере с существующим Caddy

Если на сервере уже есть reverse proxy `Caddy`, можно запускать блог без проброса порта наружу:

```bash
docker-compose -f docker-compose.server.yml up -d
```

В этом режиме контейнер подключается к сети `sporza_default`, а пример блока для Caddy лежит в `deploy/Caddyfile.blog`.

## GitHub Actions + GHCR

В репозитории есть workflow `.github/workflows/docker-publish.yml`, который:

- собирает Docker image на каждый push в `main`;
- публикует его в `ghcr.io/frontov/blog:latest`;
- собирает image сразу под `linux/amd64`;
- вшивает production `SITE_URL=https://i.sporly.ru` на этапе build.

Чтобы сервер обновлялся уже без локального `docker load`, можно использовать:

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
docker pull ghcr.io/frontov/blog:latest
docker rm -f telegram-blog || true
docker run -d \
  --name telegram-blog \
  --restart unless-stopped \
  --env-file /opt/blog/.env \
  -v blog_data:/app/data \
  --network sporza_default \
  --network-alias telegram-blog \
  ghcr.io/frontov/blog:latest
```

Либо короткий скрипт:

```bash
sh scripts/server-update.sh
```

Если образ GHCR приватный, серверу понадобится `docker login ghcr.io`.

## Что уже поддерживается

- фото и видео из Telegram-постов;
- форматирование `bold`, `italic`, `underline`, `strikethrough`, `code`, `pre`, ссылки и теги;
- отдельные страницы постов с полноразмерным медиа-блоком;
- SEO-метаданные для главной и отдельных постов;
- публичная главная страница с hero-блоком и featured-постом;
- `sitemap.xml` и `robots.txt` для индексации.

## Что можно улучшить дальше

- загружать изображения Telegram через `getFile` и сохранять локально или в S3;
- заменить JSON-хранилище на SQLite/Postgres;
- добавить админку, теги, SEO и RSS;
- форматировать Telegram entities в HTML вместо простого текста.
