# Nmap Uploader

Расширение для браузера (Chrome, Firefox, Yandex Browser) в виде `SidePanel`, которое помогает загружать геоданные (геометрии, треки и точки) в [Блокнот картографа](https://yandex.ru/support/nmaps/ru/map-blocknot.html) редактора [Народной карты Яндекс](https://n.maps.yandex.ru/). Работает в боковой панели браузера (Chrome Side Panel) или во встроенной панели в Yandex Browser на странице редактора.

## Возможности

- **Конвертация** — конвертирует поддерживаемые форматы в формат Блокнота;
- **Загрузка** — автоматически загружает сконвертированые данные в Блокнот (Яндекс.Диск);
- **Описания** — позволяет добавлять описания до 150 символов;
- **Структурирование** — позволяет организовать ваши заметки по датам;
- **Форматы** — Shapefile, GeoJSON, GPX, KML, KMZ, TopoJSON, WKT;
- **Авторизация** — вход через OAuth Яндекса (нужен доступ к Диску);


| Тип                    | Поддержка | Как попадает в Блокнот                                |
| ---------------------- | --------- | ----------------------------------------------------- |
| **Point**              | да        | один путь из одной координаты + точка-метка           |
| **MultiPoint**         | да        | каждая точка — отдельный путь                         |
| **LineString**         | да        | линия как `paths`                                     |
| **MultiLineString**    | да        | каждая линия — отдельный путь                         |
| **Polygon**            | да        | **каждое кольцо** (внешнее и дыры) — отдельный `path` |
| **MultiPolygon**       | да        | все кольца всех полигонов — отдельные `path`          |
| **GeometryCollection** | да        | рекурсивно по вложенным геометриям                    |


## Разработка и сборка

### Разработка

Для разработки лучше всего применяется режим HMR (Hot Module Replacement): изменённые модули подхватываются в браузере без перезагрузки страницы.

#### Структура

```text
entrypoints/
  background.ts                      # service worker: side panel, OAuth, загрузка на Диск
  panel/                             # UI Chrome Side Panel
    index.html
    App.tsx                          # корневой компонент, вкладки и настройки
    main.tsx                         # точка входа Side Panel
  panel-sidebar.content.tsx          # встроенная боковая панель для Yandex Browser
  map-stroke-recolor.content.ts      # content script: перекраска контуров на карте
  map-stroke-recolor-main.content.ts # основной скрипт перекраски (world: MAIN)
components/                          # React-компоненты UI
  Header.tsx
  TabBar.tsx
  PoligonTab.tsx                     # загрузка полигонов
  PointsTab.tsx                      # ручное добавление точек и загрузка списком
  PointDateField.tsx                 # поле даты для точек
  SettingsTab.tsx                    # настройки: цвет контура, тема, о приложении
  UploadProgressRing.tsx             # индикатор прогресса загрузки
  UploadStatusMessage.tsx            # статус и сообщения об ошибках
hooks/                               # хуки React
  useAuth.ts
  useFileUpload.ts
  usePointUpload.ts
  useStrokeColor.ts
  useTheme.ts
lib/                                 # бизнес-логика и интеграции
  upload_service.ts                  # загрузка файлов на Yandex Disk
  point_uploader.ts                  # формирование точек для Блокнота
  converters/                        # index.ts, geojson.ts — SHP, GPX, KML, KMZ и др.
  yandex/                            # client.ts, auth_message.ts — OAuth и API
assets/
  logo.svg
  styles/                            # uploader.css, theme_tokens.css
public/icon/                         # иконки расширения (16–128 px)
tests/
  setup/                             # vitest.setup, MSW-хендлеры, browser mock
  unit/                              # unit-тесты (Vitest)
  integration/                       # интеграционные тесты с MSW
  smoke/                             # smoke-тесты против live API
```

#### Biome

Единый инструмент для качества и оформления, проверяет TypeScript/React на типичные ошибки и производит форматирование кода.

```bash
npx biome check .
npx biome check --write .
npx biome format --write .
```

#### StyleLint

Линтер для CSS и стилей, который проверяет код на ошибки, соблюдение соглашений и единообразие.

```bash
npx stylelint "**/*.css"
npx stylelint "**/*.scss"
npx stylelint "**/*.css" --fix
```

### Сборка

Сборка осуществляется фреймворком [WXT](https://wxt.dev/), который сам собирает расширение под нужную версию манифеста и браузера.


| Команда              | Описание                        |
| -------------------- | ------------------------------- |
| `pnpm dev`           | Dev-сборка Chrome с HMR         |
| `pnpm dev:firefox`   | Dev-сборка Firefox              |
| `pnpm build`         | Production-сборка Chrome        |
| `pnpm build:firefox` | Production-сборка Firefox       |
| `pnpm zip`           | ZIP-архив Chrome для публикации |
| `pnpm zip:firefox`   | ZIP-архив Firefox               |


WXT собирает production-версию в `.output/NmapUploader-[[browser]]_X.X.X.zip` в виде архива.

### Отладка

#### Chrome

- Открыть `chrome://extensions`
- Включить **Режим разработчика**
- Нажать **Загрузить распакованное расширение** и выбрать папку `.output/chrome-mv3` или перетащить упакованное в окно **Расширения**
- Расширение появится в списке **Все расширения**.

#### Firefox

- Открыть `about:debugging#/runtime/this-firefox` (Меню → Дополнительные инструменты → Отладка расширений → Этот Firefox)
- Нажать «Загрузить временное дополнение…»
- Выбрать файл manifest.json из папки: `.output/firefox-mv2/manifest.json`
- Расширение появится в списке **Временные дополнения**.

### Тестирование

В проекте тесты написаны на **Vitest**, с окружением **Node.js**, общий setup в `tests/setup/vitest.setup.ts`.

- Unit-тесты (`tests/unit/`)
- Integration-тесты (`tests/integration/`)
- Smoke-тесты (`tests/smoke/`)

#### Команды запуска


| Команда                 | Назначение                                           |
| ----------------------- | ---------------------------------------------------- |
| `pnpm test`             | Vitest в watch-режиме (перезапуск при изменениях)    |
| `pnpm test:run`         | Все тесты один раз — основная команда для CI/коммита |
| `pnpm test:integration` | Только интеграционные (`tests/integration/`)         |
| `pnpm test:smoke`       | Smoke против live API Яндекса (`tests/smoke/`)       |
| `pnpm compile:tests`    | Проверка типов тестов (`tsc -p tests/tsconfig.json`) |


