# Тестирование бэкенда YouTube Summarizer

## Текущая конфигурация

Ваш [`.env.local`](../.env.local) уже содержит:
- ✅ Supadata API ключ
- ✅ Gemini API ключ
- ⚠️ Vercel KV ключи (пустые - используется локальный режим)

## Запуск локального сервера

```bash
npm run dev
```

Сервер запустится на `http://localhost:3000`

## Тестирование API endpoints

### 1. Создание задачи (POST)

Используйте curl, Postman или любой HTTP клиент:

```bash
curl -X POST http://localhost:3000/api/v1/summaries \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "lang": "auto",
    "options": {
      "length": "short",
      "format": "bullets",
      "transcriptMode": "auto"
    }
  }'
```

**Ожидаемый ответ (202 Accepted):**
```json
{
  "jobId": "abc123...",
  "status": "processing",
  "stage": "transcript"
}
```

### 2. Проверка статуса (GET)

Используйте `jobId` из предыдущего ответа:

```bash
curl http://localhost:3000/api/v1/summaries/{jobId}
```

**Ожидаемый ответ (202 Accepted - в процессе):**
```json
{
  "jobId": "abc123...",
  "status": "processing",
  "stage": "transcript",
  "providerStatus": "processing"
}
```

**Ожидаемый ответ (200 OK - завершено):**
```json
{
  "jobId": "abc123...",
  "status": "completed",
  "result": {
    "summary": "Краткое содержание видео...",
    "keyPoints": [
      "Тезис 1",
      "Тезис 2",
      ...
    ],
    "confidence": 85,
    "model": "gemini-2.5-flash-lite"
  },
  "meta": {
    "transcriptLang": "en",
    "availableLangs": ["en", "es"]
  }
}
```

### 3. Отмена задачи (DELETE)

```bash
curl -X DELETE http://localhost:3000/api/v1/summaries/{jobId}
```

**Ожидаемый ответ (204 No Content)**

## Тестирование через браузер

### Использование DevTools Console

1. Откройте `http://localhost:3000`
2. Нажмите F12 для открытия DevTools
3. Перейдите на вкладку "Console"
4. Выполните:

```javascript
// Создать задачу
const response = await fetch('/api/v1/summaries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    options: { length: 'short', format: 'bullets' }
  })
});
const job = await response.json();
console.log('Job created:', job);

// Проверить статус
const status = await fetch(`/api/v1/summaries/${job.jobId}`);
const statusData = await status.json();
console.log('Job status:', statusData);
```

## Возможные ошибки и их решения

### 400 Bad Request - Invalid YouTube URL

**Причина**: Неверный формат URL или не YouTube ссылка

**Решение**: Проверьте, что ссылка начинается с `https://` и содержит YouTube домен

### 429 Too Many Requests

**Причина**: Превышен rate limit (10 запросов/минуту)

**Решение**: Подождите минуту или измените `RATE_LIMIT_POST_RPM` в `.env.local`

### 500 Internal Server Error

**Причины**:
- Неверные API ключи
- Проблемы с внешними сервисами
- Ошибка в коде

**Решение**:
1. Проверьте консоль сервера на детали ошибки
2. Убедитесь, что API ключи правильные
3. Проверьте подключение к интернету

## Запуск тестов

```bash
# Все тесты
npm test

# С покрытием
npm run test:coverage
```

## Мониторинг

### Логи сервера

При запуске `npm run dev` все ошибки будут отображаться в терминале.

### Проверка состояния хранилища

В локальном режиме данные хранятся в памяти. Вы можете добавить логирование в [`lib/jobStore.local.ts`](../lib/jobStore.local.ts) для отладки.

## Следующие шаги

После успешного тестирования:

1. **Настройте Upstash** (см. [`UPSTASH_SETUP.md`](UPSTASH_SETUP.md))
2. **Деплой на Vercel**
3. **Настройте переменные окружения** в Vercel Dashboard
4. **Протестируйте production версию**

## Полезные ссылки

- [Supadata API Documentation](https://supadata.ai/docs)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Upstash Documentation](https://upstash.com/docs)
