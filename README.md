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
TELEGRAM_EXPORT_PATH=/app/old/result.json
TELEGRAM_CHANNEL=@your_channel
TELEGRAM_CHANNEL_SLUG=your_channel
```

`TELEGRAM_CHANNEL` нужен только чтобы сайт мог собрать ссылки вида `https://t.me/<channel>/<message_id>`.
`TELEGRAM_CHANNEL_SLUG` нужен для локального пути медиа. Если хочешь, чтобы файлы складывались в `/opt/blog/public/uploads/telegram/carbonpunk`, укажи `TELEGRAM_CHANNEL_SLUG=carbonpunk`.

Запуск:

```bash
npm run import:telegram-history
```

На сервере с `docker-compose.server.yml` удобно положить экспорт в `/opt/blog/old/result.json`.
Эта папка монтируется в контейнер как `/app/old`, поэтому импорт внутри контейнера видит файл по пути `TELEGRAM_EXPORT_PATH=/app/old/result.json`.

Импортёр:

- читает `result.json` из Telegram Desktop export;
- копирует фото и видео в `public/uploads/telegram`;
- сохраняет посты в `data/blog.sqlite`;
- не мешает дальнейшей автопубликации новых постов через webhook.

Дополнительно сайт теперь:

- кэширует файлы, полученные через Telegram Bot API, в `data/telegram-file-cache`;
- генерирует уменьшенные thumbnails для ленты в `data/thumb-cache`;
- отдаёт локальные медиа с долгим `Cache-Control`, чтобы повторные открытия были быстрее.

## Запуск на сервере с встроенным Caddy

Серверный compose поднимает и сам блог, и `Caddy`, который отдаёт сайт на `80/443`:

```bash
docker compose -f docker-compose.server.yml up -d --build
```

В этом режиме:

- `blog` слушает только внутри compose-сети;
- `caddy` публикует `80/443` наружу;
- сертификат для `i.sporly.ru` получает сам `Caddy`;
- конфиг лежит в `deploy/Caddyfile.blog`.
Папки `public/uploads` и `old` монтируются с хоста внутрь контейнера, поэтому архивы и загруженные медиа не попадают в Docker image и не раздувают build context.

## Простой деплой на сервер

Для этого проекта используется более простой operational path без registry и без автодеплоя через GitHub Actions:

```bash
cd /opt/blog
git pull --ff-only
docker compose -f docker-compose.server.yml up -d --build
```

То же самое делает короткий серверный скрипт:

```bash
sh scripts/server-update.sh
```

Смысл такой:

1. код обновляется обычным `git pull`
2. Docker на сервере сам пересобирает контейнер
3. `Caddy` в том же compose-стеке продолжает проксировать новую версию

Это проще поддерживать для личного блога, чем отдельный registry и SSH-деплой из GitHub Actions.

## Что уже поддерживается

- фото и видео из Telegram-постов;
- форматирование `bold`, `italic`, `underline`, `strikethrough`, `code`, `pre`, ссылки и теги;
- отдельные страницы постов с полноразмерным медиа-блоком;
- SEO-метаданные для главной и отдельных постов;
- публичная главная страница с hero-блоком и featured-постом;
- `sitemap.xml` и `robots.txt` для индексации.

## Подключение Google и Яндекс индексации

1. Открой Google Search Console и добавь ресурс `https://your-domain.com`.
2. Выбери подтверждение через HTML meta tag и скопируй токен.
3. Открой Яндекс Вебмастер, добавь сайт и тоже выбери подтверждение через meta tag.
4. Заполни в `.env`:

```env
GOOGLE_SITE_VERIFICATION=your_google_token
YANDEX_VERIFICATION=your_yandex_token
```

5. Пересобери сайт:

```bash
docker compose -f docker-compose.server.yml up -d --build
```

6. После деплоя нажми Verify в Google Search Console и Яндекс Вебмастере.
7. Отправь sitemap `https://your-domain.com/sitemap.xml` в оба кабинета.

`robots.txt` и `sitemap.xml` уже генерируются автоматически, поэтому отдельные файлы для индексации добавлять не нужно.

## Что можно улучшить дальше

- загружать изображения Telegram через `getFile` и сохранять локально или в S3;
- заменить SQLite на Postgres, если захочется вынести блог за пределы одного сервера;
- добавить админку, теги, SEO и RSS;
- форматировать Telegram entities в HTML вместо простого текста.
