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

| Команда              | Описание                        |
|----------------------|---------------------------------|
| `pnpm dev`           | Dev-сборка Chrome с HMR         |
| `pnpm dev:firefox`   | Dev-сборка Firefox              |
| `pnpm build`         | Production-сборка Chrome        |
| `pnpm build:firefox` | Production-сборка Firefox       |
| `pnpm zip`           | ZIP-архив Chrome для публикации |
| `pnpm zip:firefox`   | ZIP-архив Firefox               |
| `pnpm compile`       | Проверка типов (`tsc --noEmit`) |
| `pnpm lint`          | Проверка Biome                  |
| `pnpm lint:fix`      | Автоисправление Biome           |
| `pnpm format`        | Форматирование Biome            |

## Структура

```text
entrypoints/
  background.ts                      # service worker: side panel, OAuth, загрузка на Диск
  panel/                             # UI Chrome Side Panel (panel.html)
    App.tsx                          # корневой компонент, вкладки и настройки
    main.tsx                         # точка входа Side Panel
  panel-sidebar.content.tsx          # встроенная боковая панель для Yandex Browser
  map-stroke-recolor.content.ts      # content script: перекраска контуров на карте
  map-stroke-recolor-main.content.ts # основной скрипт перекраски (world: MAIN)
components/                          # React-компоненты UI
  Header.tsx
  PoligonTab.tsx                      # загрузка полигонов
  PointsTab.tsx                      # ручное добавление точек и загрузка списком
  SettingsTab.tsx                    # настройки: цвет контура, тема, о приложении
hooks/                               # хуки React
  useAuth.ts
  useFileUpload.ts
  usePointUpload.ts
  useStrokeColor.ts
  useTheme.ts
lib/                                 # бизнес-логика и интеграции
  upload_service.ts                  # загрузка файлов на Yandex Disk
  point_uploader.ts                  # формирование точек для Блокнота
  converters/                        # конвертеры GeoJSON, SHP, KML и др.
  yandex/                            # OAuth и API Yandex
  stroke_color*.ts                   # настройка и применение цвета контура
assets/styles/                       # globals.css, uploader.css
public/icon/                         # иконки расширения
tests/
  unit/                              # unit-тесты (Vitest)
  integration/                       # интеграционные тесты с MSW
  smoke/                             # smoke-тесты против live API
```



https://oauth.yandex.ru/client/6c57204892c04069a74cd41b1f16fff7

pnpm test:run
npm test:integration



npx biome check .
npx biome check --write .
npx biome format --write .