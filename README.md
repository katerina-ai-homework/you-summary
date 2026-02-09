# YouTube Summarizer

Приложение для автоматического создания краткого содержания YouTube видео с использованием AI.

## Технологии

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Vercel Functions (Next.js Route Handlers)
- **AI**: Gemini Developer API (Google AI Studio)
- **Transcript**: Supadata API
- **Storage**: Vercel KV (Upstash Redis)
- **Rate Limiting**: Upstash Ratelimit
- **Testing**: Vitest, MSW

## Архитектура

Бэкенд реализован как Vercel Functions с асинхронной обработкой через polling:

1. Клиент отправляет запрос на создание задачи
2. Бэкенд создаёт job и возвращает `jobId`
3. Клиент опрашивает статус задачи через polling
4. Бэкенд получает транскрипт через Supadata API
5. Бэкенд суммирует транскрипт через Gemini API
6. Бэкенд возвращает результат клиенту

Подробная архитектура описана в [`plans/backend-architecture.md`](plans/backend-architecture.md).

## Установка

### Требования

- Node.js 20+
- npm или pnpm

### Локальная разработка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd you-tube-summarizer-ui
```

2. Установите зависимости:
```bash
npm install
# или
pnpm install
```

3. Создайте файл `.env.local` на основе `.env.example`:
```bash
cp .env.example .env.local
```

4. Заполните переменные окружения в `.env.local`:
```env
# Supadata
SUPADATA_API_KEY=your_supadata_api_key

# Gemini Developer API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite

# Vercel KV / Upstash
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_POST_RPM=10
RATE_LIMIT_GET_RPM=60

# Job/cache TTL
JOB_TTL_SECONDS=7200
CACHE_TTL_SECONDS=604800
MAX_TRANSCRIPT_CHARS=120000
```

5. Запустите сервер разработки:
```bash
npm run dev
# или
pnpm dev
```

Приложение будет доступно по адресу `http://localhost:3000`.

## Получение API ключей

### Supadata API

1. Зарегистрируйтесь на [supadata.ai](https://supadata.ai)
2. Получите API ключ в настройках аккаунта
3. Добавьте ключ в `SUPADATA_API_KEY` в `.env.local` (для локальной разработки) или в Vercel Dashboard (для деплоя)

### Gemini Developer API

1. Перейдите в [Google AI Studio](https://aistudio.google.com)
2. Создайте новый API ключ
3. Добавьте ключ в `GEMINI_API_KEY` в `.env.local` (для локальной разработки) или в Vercel Dashboard (для деплоя)

### Vercel KV (Upstash Redis)

📖 **Подробная инструкция**: См. [`docs/UPSTASH_SETUP.md`](docs/UPSTASH_SETUP.md)

**Для деплоя на Vercel (рекомендуется):**
1. В Vercel Dashboard перейдите в **"Storage"** → **"Create Database"**
2. Выберите **"KV"** и нажмите **"Create"**
3. Выберите ваш проект для подключения
4. Переменные будут автоматически добавлены в Vercel Dashboard

**Для локальной разработки:**
1. Создайте аккаунт на [Upstash](https://upstash.com)
2. Создайте новый Redis database
3. Скопируйте REST API URL и Token
4. Добавьте их в `.env.local`:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

## API Endpoints

### POST /api/v1/summaries

Создаёт новую задачу на суммаризацию видео.

**Request:**
```json
{
  "title": "optional",
  "url": "https://www.youtube.com/watch?v=...",
  "lang": "auto|en|ru",
  "options": {
    "length": "short|standard|detailed",
    "format": "bullets|paragraph",
    "transcriptMode": "native|auto|generate"
  }
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "uuid",
  "status": "processing",
  "stage": "transcript"
}
```

### GET /api/v1/summaries/{jobId}

Получает статус задачи или результат.

**Response (202 Accepted):**
```json
{
  "jobId": "uuid",
  "status": "processing",
  "stage": "transcript",
  "providerStatus": "queued|active"
}
```

**Response (200 OK):**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "result": {
    "summary": "string",
    "keyPoints": ["..."],
    "confidence": 85,
    "model": "gemini-2.5-flash-lite"
  },
  "meta": {
    "transcriptLang": "en",
    "availableLangs": ["en", "es"]
  }
}
```

### DELETE /api/v1/summaries/{jobId}

Отменяет задачу.

**Response (204 No Content)**

## Тестирование

### Запуск тестов

```bash
# Запустить все тесты
npm test

# Запустить тесты с покрытием
npm run test:coverage

# Запустить тесты в watch режиме
npm test -- --watch
```

### Покрытие кода

Требуемое покрытие:
- Lines ≥ 90%
- Branches ≥ 85%
- Functions ≥ 90%
- Statements ≥ 90%

## Сборка

```bash
npm run build
```

## Деплой на Vercel

📖 **Подробная инструкция по деплою**: См. [`docs/VERCEL_DEPLOYMENT.md`](docs/VERCEL_DEPLOYMENT.md)

### Краткая инструкция

1. Подключите репозиторий к Vercel
2. Настройте переменные окружения в Vercel Dashboard (не в `.env.local`)
3. Создайте Vercel KV базу данных (опционально, но рекомендуется)
4. Деплой автоматически при push в main

### Переменные окружения в Vercel

Добавьте следующие переменные в Vercel Dashboard → Settings → Environment Variables:

**Обязательные:**
- `SUPADATA_API_KEY` - API ключ Supadata
- `GEMINI_API_KEY` - API ключ Gemini

**Опциональные (для Vercel KV):**
- `KV_REST_API_URL` - URL из Vercel KV
- `KV_REST_API_TOKEN` - Token из Vercel KV

**Настройки (опционально):**
- `GEMINI_MODEL` (default: `gemini-2.5-flash-lite`)
- `RATE_LIMIT_ENABLED` (default: `true`)
- `RATE_LIMIT_POST_RPM` (default: `10`)
- `RATE_LIMIT_GET_RPM` (default: `60`)
- `JOB_TTL_SECONDS` (default: `7200`)
- `CACHE_TTL_SECONDS` (default: `604800`)
- `MAX_TRANSCRIPT_CHARS` (default: `120000`)

⚠️ **Важно**: Не добавляйте переменные окружения в `.env.local` для деплоя на Vercel. Используйте только Vercel Dashboard.

## Структура проекта

```
you-tube-summarizer-ui/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── summaries/
│   │           ├── route.ts              # POST /api/v1/summaries
│   │           └── [jobId]/
│   │               └── route.ts          # GET, DELETE /api/v1/summaries/{jobId}
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/                            # shadcn/ui компоненты
│   ├── youtube-summarizer.tsx
│   ├── input-state.tsx
│   ├── loading-state.tsx
│   ├── result-state.tsx
│   └── error-state.tsx
├── lib/
│   ├── types.ts                       # TypeScript типы
│   ├── config.ts                      # Конфигурация
│   ├── validate.ts                    # Валидация (zod)
│   ├── supadataClient.ts              # Клиент Supadata API
│   ├── geminiClient.ts                # Клиент Gemini API
│   ├── jobStore.ts                    # Хранилище состояния (Vercel KV)
│   ├── summarizeService.ts             # Сервис суммаризации
│   └── rateLimit.ts                  # Rate limiting
├── tests/
│   ├── unit/
│   │   ├── validate.test.ts
│   │   └── jobStore.test.ts
│   └── integration/
│       └── api.test.ts
├── plans/
│   └── backend-architecture.md         # Архитектурный план
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Безопасность

- Все секреты хранятся только в переменных окружения
- Валидация URL (allowlist YouTube доменов)
- Защита от SSRF
- Rate limiting для предотвращения злоупотреблений
- Санитизация ошибок (удаление чувствительных данных)

## Ограничения

- Максимальная длина транскрипта: 120,000 символов
- Rate limit: 10 POST запросов/минута, 60 GET запросов/минута
- TTL job: 2 часа
- TTL cache: 7 дней

## Лицензия

MIT

## Поддержка

Для вопросов и предложений создайте issue в репозитории.
