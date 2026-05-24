# nmap_uploader

## Сборка для разработки

Для разработки лучше всего применяется режим сборки HMR (Hot Module Replacement), который автоматически обновляет изменённые модули в браузере без перезагрузки страницы. Сборка для браузеров:

**Chrome**

```bash
pnpm dev
```

**Firefox**

```bash
pnpm dev:firefox
```

По умолчанию WXT собирает приложение в папку `.output/chrome-mv3` распакованным, если нужна упаковка расширения после сборки необходимо выполнить:

```bash
pnpm zip
```

оно появится в папке `.output/nmap-uploader-X.X.X-chrome.zip` в виде .Zip архива.


## Сборка для релиза

Так же как и для отладочных сборок WXT соберёт релизнубю в папку `.output/`

```bash
pnpm zip:firefox
```
```bash
pnpm build
```

```bash
pnpm zip
```
```bash
pnpm zip:firefox
```

## Подключение в браузер

**Chrome**

1. Откройте `chrome://extensions`
2. Включите **Режим разработчика**
3. Нажмите **Загрузить распакованное расширение** и выберите папку `.output/chrome-mv3` или перетащите упакованое в окно **Расширения**


## Проверка перед коммитом

```bash
pnpm compile   # проверка типов TypeScript
pnpm lint      # Biome
pnpm build     # production-сборка
```

## Скрипты

| Команда | Описание |
| --------- | ---------- |
| `pnpm dev` | Dev-сборка Chrome с HMR |
| `pnpm dev:firefox` | Dev-сборка Firefox |
| `pnpm build` | Production-сборка Chrome |
| `pnpm build:firefox` | Production-сборка Firefox |
| `pnpm zip` | ZIP-архив Chrome для публикации |
| `pnpm zip:firefox` | ZIP-архив Firefox |
| `pnpm compile` | Проверка типов (`tsc --noEmit`) |
| `pnpm lint` | Проверка Biome |
| `pnpm lint:fix` | Автоисправление Biome |
| `pnpm format` | Форматирование Biome |

## Структура

```text
entrypoints/
  background.ts                  # sidePanel + обработка submit
  panel/                         # UI панели
  panel-sidebar.content.ts       # встроенная боковая панель (fallback для Yandex)
assets/styles/                   # CSS-переменные и компоненты nmaputils.ru
components/                      # React-компоненты
```



https://oauth.yandex.ru/client/6c57204892c04069a74cd41b1f16fff7

pnpm test:run
npm test:integration



npx biome check .
npx biome check --write .
npx biome format --write .