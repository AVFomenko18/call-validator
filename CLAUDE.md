# Валидатор звонков — Брифинг для Claude

Ты работаешь с проектом **call-validator** — веб-приложением для обучения менеджеров по продажам.
Владелец проекта — Александр Фоменко (Eduson EdTech). Он не пишет код сам, поэтому ты пишешь весь код.

## Что делает приложение

1. Администратор загружает образцовый звонок топа по продажам: транскрипцию, аудио, фидбек руководителя
2. Менеджер прослушивает звонок и пишет что заметил (сильные / слабые стороны)
3. Claude анализирует ответ и выставляет балл 0–100
4. Результат показывается как **карточная игра**: карточки перелистываются — зелёные (угадал) и тёмные (пропустил)
5. Если открыто ≥50% → менеджер может завершить или улучшить результат
6. При завершении: все пропущенные карточки раскрываются (красные), потом экран поздравления с цитатой

## Стек

- **Frontend:** React 18 + Vite + Tailwind CSS (`client/`)
- **Backend:** Node.js + Express, ESM (`server/`)
- **База данных:** Neon (PostgreSQL бесплатный тир, serverless)
- **AI:** Claude claude-sonnet-4-6 через `@anthropic-ai/sdk` — system prompt ОБЯЗАТЕЛЬНО массивом `[{type:'text',text:'...'}]`
- **Хостинг:** Render.com (бесплатный Web Service, автодеплой из GitHub master)
- **Аудио:** Яндекс Диск → серверный прокси `/api/audio-proxy` (обход CORS)

## Ссылки

- **Приложение:** https://call-validator.onrender.com
- **Репозиторий:** https://github.com/AVFomenko18/call-validator (ветка `master`)
- **База данных:** Neon — ep-lucky-snow-a21j9vlk-pooler.eu-central-1.aws.neon.tech

## Переменные окружения (Render Dashboard → Environment)

```
ANTHROPIC_API_KEY=sk-ant-...
ADMIN_PASSWORD=...
DATABASE_URL=postgresql://...@neon.tech/...
NODE_ENV=production
```

Для локальной разработки — создай `.env` по образцу `.env.example`.

## Структура файлов

```
call-validator/
├── server/
│   ├── index.js      ← Express сервер, ВСЕ маршруты здесь
│   ├── claude.js     ← extractKeyMoments() + scoreSubmission()
│   ├── db.js         ← pg Pool с SSL для production
│   └── db-init.js    ← скрипт инициализации БД
├── client/
│   ├── src/
│   │   ├── App.jsx              ← Routes: / | /call/:id | /admin
│   │   ├── pages/Home.jsx       ← список звонков для менеджера
│   │   ├── pages/CallPage.jsx   ← плеер + форма + карточная игра
│   │   └── pages/Admin.jsx      ← управление звонками + статистика
│   └── index.html
├── db/
│   ├── init.sql        ← создание таблиц (для новой БД)
│   └── migrate_v2.sql  ← миграция (уже применена в Neon)
├── package.json        ← корневой, "type":"module", скрипты dev/build/start
├── .env.example
└── CLAUDE.md           ← этот файл
```

## Схема БД

```sql
calls (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  audio_url TEXT,                    -- ссылка Яндекс Диск / Google Drive / прямой mp3
  transcription TEXT NOT NULL,
  supervisor_feedback TEXT NOT NULL, -- эталон руководителя (золотой стандарт)
  key_moments JSONB DEFAULT '[]',    -- извлекает Claude при создании: [{moment, importance}]
  created_at TIMESTAMPTZ DEFAULT NOW()
)

submissions (
  id SERIAL PRIMARY KEY,
  call_id INTEGER REFERENCES calls(id) ON DELETE CASCADE,
  manager_name TEXT NOT NULL,
  strengths TEXT NOT NULL,
  weaknesses TEXT NOT NULL,
  score INTEGER,
  score_details JSONB DEFAULT '{}',  -- {matched_points[], missed_points[], generic_phrases[], reasoning}
  attempt_number INT DEFAULT 1,      -- номер попытки
  is_final BOOLEAN DEFAULT FALSE,    -- true = менеджер нажал "Завершить"
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- УНИКАЛЬНОГО индекса НЕТ — разрешены множественные попытки
)
```

## API маршруты (server/index.js)

| Метод | URL | Auth | Описание |
|---|---|---|---|
| GET | /api/calls | — | Список звонков |
| GET | /api/calls/:id | — | Один звонок со всеми полями |
| POST | /api/calls | admin | Создать звонок (Claude извлекает key_moments) |
| PUT | /api/calls/:id | admin | Редактировать звонок (Claude пересчитывает key_moments) |
| DELETE | /api/calls/:id | admin | Удалить звонок и все submissions |
| GET | /api/submissions/check | — | Попытки менеджера: `{attempt_count, is_final, best_score, latest}` или null |
| GET | /api/submissions/summary | admin | Сводная таблица: лучший балл + completed + attempt_count |
| GET | /api/submissions | admin | Все submissions (с фильтром по call_id) |
| POST | /api/submissions | — | Новая попытка (блокирует если is_final=true) |
| POST | /api/submissions/:id/finish | — | Отметить как завершённый (is_final=true) |
| DELETE | /api/submissions/reset | admin | Удалить ВСЕ попытки менеджера по звонку |
| DELETE | /api/submissions/:id | admin | Удалить конкретную попытку |
| GET | /api/audio-proxy | — | Прокси Яндекс Диск аудио |

**Авторизация admin:** заголовок `x-admin-token: <ADMIN_PASSWORD>`

## Ключевые особенности кода

### Claude API (server/claude.js)
```js
// system ОБЯЗАТЕЛЬНО массивом — Claude 4 иначе падает с ошибкой
system: [{ type: 'text', text: '...' }]
```

`extractKeyMoments(transcription)` — вызывается при создании/редактировании звонка, возвращает `[{moment, importance}]`.

`scoreSubmission(call, feedback)` — возвращает `{score, score_details}`, где score_details содержит `matched_points[]` и `missed_points[]` (короткие фразы на русском БЕЗ мета-комментариев типа "соответствует эталону").

### Аудио (server/index.js → /api/audio-proxy)
- **Яндекс Диск** → резолвится через `cloud-api.yandex.net/v1/disk/public/resources/download` → проксируется через сервер
- **Google Drive** → iframe embed на фронте (прямой `<audio>` не работает из-за CORS)
- **Прямой mp3** → нативный `<audio>` с кастомным плеером

### Фронтенд (client/src/pages/CallPage.jsx)

Компоненты:
- `AudioPlayer` — кастомный плеер с кнопками 1x/1.25x/1.5x/2x
- `FlipCard` — карточка с CSS 3D flip анимацией (`transform: rotateY`), два лица: тёмное "?" и цветное (зелёное для matched, красное для missed при раскрытии)
- `CardGame` — игровая логика: staggered reveal (160мс между картами), прогресс-бар, кнопки "Улучшить" / "Завершить и показать все"
- `CompletionScreen` — тёмный градиент, конфетти, анимированный трофей, случайная цитата

Состояния `phase` в CallPage: `'loading'` → `'form'` → `'cards'` → `'completed'`

### Сборка на Render
- Build: `cd client && npm ci --include=dev && npm run build`
- `--include=dev` обязательно (NODE_ENV=production иначе пропускает vite/tailwind)
- `package-lock.json` закоммичен → сборка ~1-2 мин

## Локальная разработка

```powershell
cd C:\Users\[имя]\call-validator
# Создать .env с реальными значениями
npm install
cd client && npm install && cd ..
npm run dev    # сервер на :3001, клиент на :5173
```

Vite проксирует `/api/*` на `localhost:3001` (настройка в `client/vite.config.js`).

## Деплой

Render автодеплоит при каждом push в `master`:
```
git add .
git commit -m "описание изменений"
git push origin master
```

Деплой занимает ~2 минуты. Логи доступны в Render Dashboard → Logs.

## Типичные задачи

**Добавить новое поле в форму звонка:** изменить `NewCallForm` в `Admin.jsx` + добавить колонку в БД + обновить POST/PUT маршруты в `server/index.js`.

**Изменить промпт скоринга:** `server/claude.js` → функция `scoreSubmission`. Помни про `system: [{type:'text',text:'...'}]`.

**Изменить список цитат на экране поздравления:** `client/src/pages/CallPage.jsx` → константа `QUOTES` в начале файла.

**Добавить новый маршрут:** только в `server/index.js` (не создавай отдельные файлы routes — всё уже там).

**Сбросить результаты менеджера:** Админка → Статистика → клик на ячейку → "Удалить результат".

## Что НЕ делать

- Не создавай отдельные файлы для маршрутов (есть `server/routes/` но они не используются — всё в `server/index.js`)
- Не используй `system` как строку в Claude API — только массив
- Не добавляй UNIQUE индекс на (call_id, manager_name) в submissions — он был специально удалён
- Не трогай `npm ci` без `--include=dev` в build команде

## История изменений (кратко)

- v1: базовый скоринг, форма, хранение в Neon
- v1.1: JSON транскрипции, Яндекс Диск аудио, серверный прокси
- v2: **карточная игра** — анимированные FlipCard, множественные попытки, экран поздравления, удаление результатов из админки
