# Архитектурный план бэкенда: YouTube Summarizer

## Обзор

Бэкенд для YouTube Summarizer будет реализован как Vercel Functions (Next.js Route Handlers) с асинхронной обработкой через polling. Система интегрируется с Supadata API для получения транскриптов и Gemini Developer API для суммаризации.

## Архитектура системы

```mermaid
graph TB
    subgraph "Клиент (Frontend)"
        A[React App]
    end

    subgraph "Vercel Functions"
        B[POST /api/v1/summaries]
        C[GET /api/v1/summaries/{jobId}]
        D[DELETE /api/v1/summaries/{jobId}]
    end

    subgraph "Внешние сервисы"
        E[Supadata API]
        F[Gemini API]
    end

    subgraph "Хранилище"
        G[Vercel KV / Upstash Redis]
    end

    A -->|1. Создать job| B
    B -->|2. Сохранить состояние| G
    B -->|3. Вернуть jobId| A

    A -->|4. Polling| C
    C -->|5. Проверить состояние| G
    C -->|6. Запрос транскрипта| E
    E -->|7. Транскрипт или jobId| C
    C -->|8. Суммаризация| F
    F -->|9. Summary| C
    C -->|10. Сохранить результат| G
    C -->|11. Вернуть результат| A

    A -->|12. Отмена| D
    D -->|13. Пометить cancelled| G
```

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
├── src/
│   └── lib/
│       ├── config.ts                    # Конфигурация приложения
│       ├── validate.ts                  # Валидация входных данных (zod)
│       ├── supadataClient.ts            # Клиент для Supadata API
│       ├── geminiClient.ts              # Клиент для Gemini API
│       ├── jobStore.ts                  # Хранилище состояния (Vercel KV)
│       ├── summarizeService.ts           # Сервис суммаризации
│       ├── rateLimit.ts                 # Rate limiting (Upstash Ratelimit)
│       └── types.ts                     # TypeScript типы
├── tests/
│   ├── unit/
│   │   ├── validate.test.ts
│   │   ├── supadataClient.test.ts
│   │   ├── geminiClient.test.ts
│   │   ├── jobStore.test.ts
│   │   └── summarizeService.test.ts
│   └── integration/
│       ├── api.test.ts
│       └── e2e.test.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## API Endpoints

### 1. POST /api/v1/summaries

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

**Error Responses:**
- `400 Bad Request` - неверные входные данные
- `429 Too Many Requests` - превышен rate limit

### 2. GET /api/v1/summaries/{jobId}

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

**Error Responses:**
- `404 Not Found` - задача не найдена
- `410 Gone` - задача отменена
- `500 Internal Server Error` - внутренняя ошибка

### 3. DELETE /api/v1/summaries/{jobId}

Отменяет задачу.

**Response (204 No Content)**

**Error Responses:**
- `404 Not Found` - задача не найдена

## Модели данных

### Job Entity

```typescript
interface Job {
  id: string;                          // UUID
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  stage: 'transcript' | 'summarize';
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
  input: {
    title?: string;
    url: string;
    lang?: string;
    options?: {
      length?: 'short' | 'standard' | 'detailed';
      format?: 'bullets' | 'paragraph';
      transcriptMode?: 'native' | 'auto' | 'generate';
    };
  };
  supadata: {
    mode: string;
    jobId?: string;
    transcriptLang?: string;
    availableLangs?: string[];
  };
  result?: {
    summary: string;
    keyPoints: string[];
    confidence: number;
    model: string;
  };
  error?: {
    code: string;
    message: string;
    provider?: 'supadata' | 'gemini' | 'backend';
  };
}
```

## Интеграции

### Supadata API

**Endpoint:** `GET https://api.supadata.ai/v1/transcript`

**Параметры:**
- `url` (required): ссылка на YouTube видео
- `lang` (optional): предпочтительный язык (ISO 639-1)
- `text=true`: запрашивает plain text
- `mode` (optional): `native | auto | generate`

**Статусы:**
- `200 OK` - транскрипт готов
- `202 Accepted` - асинхронная обработка, возвращает `jobId`
- `400 Bad Request` - неверные параметры
- `403/404` - видео недоступно
- `206` - транскрипт недоступен

### Gemini Developer API

**Модель:** `gemini-2.5-flash-lite` (конфигурируется через `GEMINI_MODEL`)

**Формат ответа:** JSON

**JSON Schema:**
```json
{
  "summary": "string",
  "keyPoints": ["string"],
  "confidence": 0
}
```

**Ограничения:**
- `summary`: 600-1200 символов (short), 1200-2200 (standard), 2200-4000 (detailed)
- `keyPoints`: 5-9 пунктов
- `confidence`: 0-100

## Хранилище состояния (Vercel KV)

### Ключи

- `job:{jobId}` → состояние job (TTL: 2 часа)
- `cache:{sha256(url+options)}` → кэшированный результат (TTL: 7 дней)

### Операции

- `SET job:{jobId} <json> EX 7200` - сохранить job
- `GET job:{jobId}` - получить job
- `DEL job:{jobId}` - удалить job
- `SET cache:{hash} <json> EX 604800` - кэшировать результат
- `GET cache:{hash}` - получить из кэша

## Валидация и безопасность

### Валидация URL

- Протокол только `https://`
- Allowlist: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`
- Запрет IP-адресов и приватных диапазонов
- Запрет нестандартных протоколов

### Валидация входных данных (zod)

```typescript
const createSummarySchema = z.object({
  title: z.string().min(1).max(120).optional(),
  url: z.string().url().refine(validateYouTubeUrl),
  lang: z.enum(['auto', 'en', 'ru']).default('auto'),
  options: z.object({
    length: z.enum(['short', 'standard', 'detailed']).default('standard'),
    format: z.enum(['bullets', 'paragraph']).default('bullets'),
    transcriptMode: z.enum(['native', 'auto', 'generate']).default('auto'),
  }).optional(),
});
```

### Rate Limiting

- POST /summaries: 10 запросов/минута
- GET /summaries/{jobId}: 60 запросов/минута

Инструмент: Upstash Ratelimit поверх Vercel KV

## Обработка ошибок

### Коды ошибок Supadata

- `TRANSCRIPT_UNAVAILABLE` - транскрипт недоступен
- `VIDEO_UNAVAILABLE` - видео недоступно
- `SUPADATA_INVALID_REQUEST` - неверный запрос
- `SUPADATA_UPSTREAM_ERROR` - ошибка провайдера

### Коды ошибок Gemini

- `GEMINI_AUTH` - проблема с аутентификацией
- `GEMINI_QUOTA` - превышена квота
- `GEMINI_UPSTREAM_ERROR` - временная ошибка
- `GEMINI_INVALID_RESPONSE` - неверный формат ответа

## Chunking для длинных транскриптов

Если транскрипт превышает `MAX_TRANSCRIPT_CHARS` (120,000):

1. Разделить на блоки 12,000-18,000 символов
2. Суммировать каждый блок отдельно
3. Агрегировать промежуточные summaries в финальный результат

## Переменные окружения

```env
# Supadata
SUPADATA_API_KEY=

# Gemini Developer API
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite

# Vercel KV / Upstash
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_POST_RPM=10
RATE_LIMIT_GET_RPM=60

# Job/cache TTL
JOB_TTL_SECONDS=7200
CACHE_TTL_SECONDS=604800
MAX_TRANSCRIPT_CHARS=120000
```

## Зависимости

### Runtime

```json
{
  "dependencies": {
    "@ai-sdk/google": "^1.0.0",
    "@upstash/redis": "^1.34.0",
    "@upstash/ratelimit": "^1.2.0",
    "zod": "^3.24.1",
    "nanoid": "^5.0.9"
  }
}
```

### DevDependencies

```json
{
  "devDependencies": {
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "msw": "^2.4.0",
    "typescript": "^5.7.3"
  }
}
```

## Тестирование

### Unit Tests

- Валидация URL
- Маппинг ответов Supadata
- Логика polling статусов
- Парсинг JSON от Gemini
- Chunking и агрегация
- Сериализация job в KV

### Integration Tests

- POST создаёт job и пишет в KV
- GET прогоняет job от transcript к summarize
- Rate limit возвращает 429
- Cancel возвращает 410

### Coverage Targets

- Lines ≥ 90%
- Branches ≥ 85%

## CI/CD (GitHub Actions)

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test --coverage
      - uses: codecov/codecov-action@v4
```

## Деплой на Vercel

### Шаги деплоя

1. Подключить репозиторий к Vercel
2. Настроить переменные окружения в Vercel Dashboard
3. Добавить Vercel KV (Upstash Redis)
4. Деплой автоматически при push в main

### Конфигурация Vercel

```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

## Критерии приемки

- ✅ POST возвращает jobId и не раскрывает секреты
- ✅ GET переводит job в completed при успешном транскрипте и корректном ответе Gemini
- ✅ Ошибки нормализуются и не содержат чувствительные данные
- ✅ Тесты выполняются в CI, покрытие удовлетворяет порогам
- ✅ Код запускается на Vercel без необходимости хранить ключи в репозитории

## Следующие шаги

1. Утвердить архитектурный план
2. Переключиться в режим Code для реализации
3. Создать структуру файлов
4. Реализовать API endpoints
5. Написать тесты
6. Настроить CI/CD
7. Деплой на Vercel
