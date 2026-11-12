# Инструкция для ИИ-агентов (Manus, Claude и др.)

bai.kun — сайт для изучения китайского и подготовки к экзаменам студента SCUT
(International Economics and Trade). Живой сайт: https://baikun-ap.github.io

## Главные правила

1. **Не пушить в `main`.** Каждый пуш в `main` сразу публикует сайт
   (`.github/workflows/deploy.yml`). Работай в своей ветке (`agent/<задача>`)
   и открывай pull request. В `main` его вливает хозяин сайта.
2. **Не удалять и не переписывать учебные данные:** книги, уроки, слова,
   задания мидтерма, разборы иероглифов. Это файлы в `src/content/`,
   `src/data/`, `public/files/` (PDF) и `public/` целиком. Добавлять можно,
   менять существующее только если об этом прямо попросили.
3. **Главная (`index.html`) — ледяной мир** (`src/landing/`, 3D-история по
   прокрутке в `src/landing/story.ts`; как всё устроено — `docs/ICE-PLAN.md`).
   Её дизайн меняется только по прямой просьбе хозяина сайта.
4. **Прогресс пользователя не ломать.** Поля `CourseState` в
   `src/course/store.ts` только добавлять (необязательными), не переименовывать
   и не удалять, иначе у людей пропадёт сохранённый прогресс и синхронизация
   (`src/course/cloud.ts`, `src/course/ghsync.ts`).
5. Весь интерфейс на двух языках: `t('по-русски', 'in English')` из `src/i18n.ts`.
6. Чужой закрытый код и материалы (платные аудио издательств, движки с чужих
   сайтов) не добавлять.

## Как устроен проект

- Vite 8 + React 19 + TypeScript. Приложение — `app/index.html` → `src/main.tsx` → `src/App.tsx`.
- Маршруты через hash: `#/course`, `#/lesson/<id>/<шаг>`, `#/cards`, `#/write`,
  `#/midterm/...`, `#/micro/...`, `#/parts`, `#/hanzi`, `#/settings`.
  Новый раздел = компонент в `src/course/` + `case` в `App.tsx` + пункт в `nav()`.
- Стили приложения: `src/course/x.css`. Tailwind v4 подключён **только** для
  компонентов из `src/components/charts` и `src/components/kokonutui`
  (`src/vendor.css`), на остальной сайт он не действует.
- Анимации: Anime.js, `src/lib/anim.ts` (с учётом `prefers-reduced-motion`).
- Микроэкономика: вопросы в `src/content/micro.ts` (4 задания × 20 вопросов,
  на экзамене 50), страница `src/course/Micro.tsx`.

## Перед pull request обязательно

```
npm ci
npx playwright install --with-deps chromium   # один раз: браузер для проверок
npm run build                      # tsc + сборка, должно пройти без ошибок
node scripts/app-check.mjs         # все страницы, телефон и компьютер
LOCALE=en-US node scripts/app-check.mjs
node scripts/midterm-check.mjs
node scripts/listening-check.mjs
node scripts/flow-check.mjs
node scripts/sync-check.mjs
node scripts/hero-check.mjs        # главная: телефон, планшет, компьютер
```

Проверки запускают Chromium через Playwright (свой путь к браузеру можно
задать переменной `CHROME=/путь/к/chromium`). Каждая должна закончиться
строкой `... ok`. Перед коммитом: `git checkout -- shots/` (скриншоты проверок
не коммитим). В описании PR напиши, что изменено и какие проверки прошли.
