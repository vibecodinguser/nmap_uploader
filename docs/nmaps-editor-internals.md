# Внутренности редактора Народной карты

Справочник по устройству `n.maps.yandex.ru`: как устроены редакторы объектов,
как к ним подключиться из расширения и что при этом нельзя ломать.

Документ нужен, чтобы не проходить путь реверс-инжиниринга заново. Инструмент
разреза растительности (`lib/vegetation_cut/`, ADR 0012) — первый потребитель,
но справочник общий: счётчик вершин, трассировка, трекер и будущие инструменты
опираются на те же механизмы.

## Как читать

Каждый факт помечен источником:

- **[код]** — прочитано в бандле НЯК, приведён фрагмент.
- **[живой]** — проверено в запущенном редакторе или через API.
- **[вывод]** — следствие из первых двух, отдельно не проверялось.

Если факт перестанет совпадать с кодом, верна пометка **[код]**: её легко
перепроверить, см. «Как проверить самому».

Фрагменты кода приведены **по смыслу**: минифицированные имена (`$aK`, `$VI`,
`Zr.A`) заменены говорящими (`onChangeCoords`, `mode`, `Batch`), структура и
порядок вызовов сохранены. Литеральный исходник ищется по минифицированному имени,
которое указано рядом с описанием.

## Версия и источники

Проверялось на редакторе **3.548.0** (ноябрь 2026). Бандлы (хэши в именах
меняются с каждой сборкой, искать через `performance.getEntriesByType('resource')`):

| Бандл | Что внутри |
|---|---|
| `app.bb5a5ff497660d348414.ru.js` | точка входа, ставит рантайм отправки чанков |
| `app-bundle.fe02360fe85e6c0922e7.ru.js` | базовый класс активностей (модуль 17574), менеджер активностей (37330), фабрика активностей (74041), DI-контейнер (7006), сохранение (`editor/saveGeoObject`) |
| `geoobject-bundle.38ae03d742da6fb6406b.ru.js` | редакторы объектов и контуров (модуль 74613), компонент редактора геометрии с разрезами (модуль 57318) |
| `full.js` (jsapi 2.1.79) | `ymaps.geometryEditor`, справка по нему есть в документации Яндекса |

Имена полей минифицированы (`$aK`, `$KN`, `$VI`), поэтому в документе они
названы по смыслу с указанием минифицированного имени в скобках.

## 1. Слои приложения

```
window.webpackChunknmaps        // очередь чанков: [[ids, factories], ...]
        │
        ├── модули бандлов      // классы, фабрики, сервисы
        │
        └── DI-контейнер (7006) // singleton-сервисы по имени
                │
                ├── editor-service      // сетевые вызовы редактора
                ├── geoobject-factory   // создание объектов
                ├── geometry-factory    // создание геометрий
                ├── categories-config   // конфиг категорий с сервера
                ├── token               // токен авторизации
                ├── activity-factory    // transient: создание активностей
                └── activity-manager    // transient: запуск/остановка активностей
```

**[код]** `webpackChunknmaps` — обычный массив чанков; третьего элемента
(рантайма) в нём нет, рантайм ставит `app.js` через `push`. Поэтому
`lib/nmaps_webpack_module_observer.ts` работает: он подменяет `push` и оборачивает
фабрики модулей.

**[код]** DI-контейнер — модуль 7006:

```js
registerType(t, e, s)     // тип; s = 'transient' | 'singleton' (по умолчанию)
registerValue(t, e)       // готовое значение (singleton)
registerProvider(t, e, s)
get(t)                    // 'di-container' возвращает сам контейнер
instantiate(t, e)         // создать экземпляр с аргументами
```

**[код]** `app-bundle`: `registerType("editor-service", ...)`,
`registerType("geoobject-factory", ...)`, `registerType("geometry-factory", ...)`
— **singleton**; `registerType("activity-factory", ..., "transient")` и
`registerType("activity-manager", ..., "transient")` — **transient**;
`categories-config`, `current-user`, `layers-config` — `registerValue`, то есть
готовые объекты.

**[код]** В debug-режиме контейнер публикуется как `window.diContainer`
(`n.A.debug && (window.diContainer = r)`). В обычном режиме его нет — **[живой]**.

**Практический вывод:** `get('activity-manager')` вернёт **новый** менеджер, а не
тот, что управляет открытым редактором. Живой редактор можно получить только
перехватом (раздел 3) или через сервисы контейнера.

## 2. Активности

Всё, что показывает интерфейс редактора, — «активности»: класс с жизненным
циклом и методом `onViewAttrsRequest()`, который отдаёт данные своему
представлению. Это главный контракт: чтобы узнать состояние редактора, не нужно
лезть во внутренние модели — достаточно вызвать `onViewAttrsRequest()`.

### 2.1. Базовый класс (модуль 17574)

**[код]**

```js
class Activity {
  static defaultParams = {}
  constructor(params, viewCls) { /* params поверх defaultParams, только !== undefined */ }

  start(container, ctx) {
    if (this.$wq) return this
    this.container = container
    this.$wq = this.onStart() !== false   // false — активность не запускается
    if (!this.$wq) return this
    this.$Lq()                            // создать и смонтировать представление
    this.updateUrlState(true)
    this.emit('started')
    return this
  }

  stop() { /* отменить rAF, снять представление, отменить cancellator, onStop(), eventManager.un(), emit('stopped') */ }

  onStart() {}
  onStop() {}
  onViewAttrsRequest() { return {} }      // ← данные для представления
  onMapEditingParamsRequest() { return {} } // minEditingZoom и прочее

  isStarted()          // $wq
  isPaused() / pause() / resume()
  isDisabled() / enable() / disable()
  updateView()         // перерисовать: rAF + страховочный setTimeout(1s)
  hasUnsavedData()     // по умолчанию false
  createCancellator()  // отменить промисы при остановке
}
```

**[код]** Представление получает ровно то, что вернул `onViewAttrsRequest()`, плюс
служебный контекст `{disabled, hidden, setupChildrenContainer,
teardownChildrenContainer}`.

**[код]** Параметры активности — это её `params`; они же попадают в URL-состояние
через `onUrlStateRequest()`.

### 2.2. Менеджер активностей (модуль 37330)

**[код]**

```js
manager.setOwner(activity)     // подписка на stopped/disabled/enabled/paused/resumed владельца
manager.regActivity(id, activityCls, viewCls = null)
manager.start(id, params)      // перезапускает активность с тем же id
manager.stop(id) / stopAll() / startAll()
manager.isStarted(id)
```

**[код]** События менеджера: на каждое событие активности он испускает
`${id}:${type}` и `*:${type}`. Именно так родительская активность узнаёт о
запуске дочерних:

```js
this.eventManager.on(this.$vk, { '*:started': this.updateView, ... })
```

**[код]** Активность с представлением не запустится, пока у менеджера нет
контейнера: `hasView && !container` → `pending`, запуск откладывается.

**[код]** `setOwner` подписывает менеджер на события владельца: когда владелец
останавливается, `stopAll()` гасит дочерние активности. Вложенность редакторов
устроена именно так: редактор контура держит дочерние редакторы.

### 2.3. Фабрика активностей (модуль 74041)

**[код]**

```js
factory.register(id, activityCls, viewCls)
factory.create(id, params)   // di-container.instantiate(activityCls, [params, viewCls])
factory.isRegistered(id)
```

### 2.4. Страницы приложения

**[код]** Навигация тоже на активностях: `registerPages({ pageName: {activityCls, viewCls, params} })`,
`goTo(pageName, params)`, `goBack()`, кэш страниц (`params.cacheable`).
Несохранённые данные проверяются через `activity.hasUnsavedData()` перед уходом
со страницы.

## 3. Как подключиться из расширения

### 3.1. Рабочий способ: хук прототипа активности

**[код]** Классы активностей не экспортируются поимённо, но модули отдают их как
значения экспорта. Значит, можно поймать класс по форме прототипа и обернуть
`start`/`stop`.

**[код]** Признак класса активности:

```js
proto.start && proto.stop && proto.onStart && proto.onViewAttrsRequest && proto.isStarted
```

**[вывод]** Проверять надо `hasOwnProperty`: у подклассов `start` наследуется, и
повторная обёртка дала бы двойной вызов. Поэтому в `editor_access.ts` подклассы
без собственного `start` пропускаются.

**[код]** Хук ставится в MAIN world на `document_start`
(`entrypoints/map-vegetation-cut.content.ts`): классы объявляются при исполнении
бандла, оборачивать нужно раньше, чем редактор откроет объект.

Готовый код — `lib/vegetation_cut/editor_access.ts`:

```ts
installActivityHook({ onStart, onStop }, { observe: observeWebpackModules })
```

### 3.2. Что НЕ работает

- **[живой]** `ymaps.geometryEditor.Base/MultiGeometry.startEditing` для объектов
  растительности **не вызывается** — ни при открытии, ни при рисовании. Ставить
  инструменты только на этот хук нельзя.
- **[живой]** `ymaps.Hotspot.getGeoObjectsByCoords` на этих объектах тоже не
  вызывается.
- **[код]** `window.diContainer` доступен только в debug-режиме.
- **[код]** `get('activity-manager')` даёт новый экземпляр (transient).

### 3.3. Диагностика

Первым делом проверяется, дошёл ли скрипт до страницы. Инструмент разреза
растительности ставит на `<html>` атрибут `data-nmap-veg-cut`:

```js
document.documentElement.getAttribute('data-nmap-veg-cut')
```

| Значение | Что значит |
|---|---|
| `null` | content script не загружен: расширение в браузере старше сборки |
| `loaded` | скрипт исполнился, хук ещё не поставлен |
| `hooked:0` | ни модули, ни DI-контейнер не найдены: хук не сможет поймать активности |
| `hooked:<N>` | хук стоит (N — число подписок/обёрнутый контейнер), редактор не открыт |
| `idle` | редактор закрыт |
| `other:<категория>` | открыт редактор не растительности |
| `wait:<категория>` | растительность открыта, но редактор ещё не готов резать (элементы не загрузились или это экран выбора контура) |
| `ready:<категория>:<элементов>` | кнопка доступна |
| `error:<сообщение>` | скрипт загрузился, но упал при инициализации |

**[живой]** Кнопка живёт только внутри редактора растительности. После
перезагрузки вкладки редактор закрывается (в URL его нет), поэтому кнопки нет —
это нормальное поведение, а не сбой. Чтобы она появилась снова, нужно открыть
объект и нажать «Редактировать».

**[живой]** `hooked:0` — тревожный признак: скрипт загрузился, но классы
активностей через наблюдатель не проходили. В этом случае редактор откроется мимо
хука. Причина обычно одна: скрипт исполняется позже, чем бандл НЯК (например,
расширение обновили при открытой вкладке — Chrome не переинжектирует content
scripts в уже открытые страницы). Лечится перезагрузкой вкладки.

**[живой]** На объекте `120112714` сразу после открытия редактора атрибут принимал
значение `editor:skip:vegetation` (старый формат): ловилась активность
объекта-контейнера `vegetation`, у которой нет ни элементов, ни обработчика
правки. Отсюда правило: готовность определяется не по последней активности, а по
самой способной из запущенных.

**[живой]** Редактор топологии (`Mo`, активность `contour-topology-on-map-editor`)
отдаёт ровно то, что нужно инструменту:

```
categoryId         vegetation_fc
elementCategoryId  vegetation_el
elementRoleId      part
elements           9 объектов
onChangeElementCoords  есть
geoObjectFactory, geometryFactory  есть
```

Он стартует **после** контейнера `object-with-contours-on-map-editor`, поэтому
правило «самая способная, а не последняя» обязательно: иначе контейнер вытеснит
топологию.

Полный журнал запусков активностей (последние 50) доступен без флагов:

```js
window.__nmapVegCutLog
// [{categoryId, elementCategoryId, elementRoleId, elements, canCut, attrsKeys}, …]
```

В консоли при загрузке печатается `[nmap_vegetation_cut] content script loaded`.

Подробный лог в консоль включается флагом:

```js
localStorage.setItem('nmap-veg-cut-debug', '1')
```

**[живой]** Если `data-nmap-veg-cut` равен `null`, а другие кнопки расширения на
странице есть, значит браузер держит старую копию расширения: content scripts
читаются с диска только при загрузке/перезагрузке расширения, а не при обновлении
файлов в `.output`.

### 3.4. Перезагрузка расширения и подписки на активности

**[код]** Обёрнутый прототип активности переживает перезагрузку расширения:
страница остаётся, старый content script умирает, а методы `start`/`stop` на
прототипе уже подменены. Поэтому подписки хранятся **на прототипе** в мире
страницы (реестр `proto[HOOK_MARKER].hooks`), а не в замыкании скрипта:

- обёртка при каждом вызове читает актуальный список подписок;
- новая копия скрипта добавляет свою подписку и снимает её при остановке;
- подписки прошлой (мёртвой) копии, которые бросают
  `Extension context invalidated`, изолированы `try/catch` и не мешают работе;
- один и тот же класс может встретиться в нескольких модулях — подписка
  дедуплицируется по ссылке, поэтому `start` не вызывает обработчик дважды.

**[живой]** До этого исправления маркер `proto[HOOK_MARKER] = true` ставился
навсегда: после перезагрузки расширения новая копия видела маркер, не ставила хук
и кнопка пропадала до перезагрузки вкладки.

### 3.4.1. Главная точка подключения — DI-контейнер, а не экспорт модуля

**[живой]** Бандлы НЯК объявляются в `<script>` раньше content script, поэтому
перехват `webpackChunknmaps.push` почти всегда опаздывает: к моменту установки
хука модули уже выполнены и через `push` не пройдут. Состояние `hooked:0` — ровно
этот случай.

**[код]** Классы редакторов при этом **не экспортируются** из модулей: модуль
`geoobject-bundle` отдаёт только фабрику/сервис, а классы активностей
регистрируются внутри и создаются через `di-container.instantiate`.

**[живой]** Поэтому единственная надёжная точка — сам DI-контейнер:

```js
// контейнер — синглтон модуля: require отдаёт тот же объект, что у приложения
const di = require(7006)
const container = di.A            // { instantiate, get, registerType, registerProvider }

// при создании любой активности приходит её класс
container.instantiate = function (Cls, args) { /* подписаться на Cls */ }
```

**[живой]** Проверено на `120112714`: через `instantiate` приходит `Mo`
(`contour-topology-on-map-editor`) с `categoryId: vegetation_fc`,
`elementCategoryId: vegetation_el`, `elementRoleId: part` и
`onChangeElementCoords`. Контейнер ищется по форме (`instantiate` + `get` +
`registerType` + `registerProvider`), а не по id модуля: id меняются со сборкой.

**[вывод]** У активностей из контейнера `start` обычно **унаследован** (минификатор
сводит его к базовому), поэтому подписка должна уметь создавать собственную
обёртку поверх унаследованного метода. Иначе подклассы молча пропускаются.

**[живой]** Момент `start` — не момент готовности: у топологии элементы
приходят асинхронно (`getContourTopologyByBounds`), в `start` их ещё ноль.
Готовность нужно перепроверять при перерисовке интерфейса.

### 3.5. Если кнопки нет: порядок проверки

1. `document.documentElement.getAttribute('data-nmap-veg-cut')`.
2. `null` — скрипт не исполнялся. Проверить в `chrome://extensions`, что
   расширение загружено из актуального каталога (`.output/chrome-mv3` или
   `.output/chrome-mv3-dev`), нажать «Обновить» и перезагрузить вкладку.
3. `error:…` — скрипт упал при инициализации; текст ошибки в значении атрибута.
4. `hooked:0` — хук стоит, но классы активностей не проходили. Перезагрузить
   вкладку: значит скрипт исполнился позже бандла НЯК.
5. `hooked:<N>` — всё готово, редактор ещё не открывался. Открыть объект и нажать
   «Редактировать».
6. `wait:…` — редактор растительности открыт, но топология не запущена
   (например, открыт режим редактирования содержимого контура). Достаточно
   переключиться в режим топологии или закрыть и открыть редактор.
7. `ready:…` — всё работает; если кнопки не видно, смотреть тулбар над картой.

**[живой]** Кнопка существует только внутри редактора растительности. После
перезагрузки вкладки редактор закрыт, поэтому кнопки нет — это ожидаемо.

**[живой]** Активность `Mo` (топология) запускается только при входе в
редактирование контура. Если расширение обновили при уже открытом редакторе,
`start` этой активности уже прошёл и хук его не увидит — нужно закрыть и заново
открыть редактор (или перезагрузить вкладку).

## 4. Объекты и их связи

### 4.1. API объекта

**[код]** Модель объекта (`geoobject`):

| Метод | Что даёт |
|---|---|
| `getCategoryId()` | категория (`vegetation_el`) |
| `getGeometry()` | геометрия (`LineString`, `Polygon`, `MultiPolygon`…) |
| `getAttrs()` | атрибуты (`vegetation:ft_type_id`) |
| `getId()`, `getRevisionId()` | идентификаторы |
| `getSlavesByRole(role)` | коллекция подчинённых объектов по роли |
| `getMastersByRole(role)` | коллекция владельцев по роли |
| `getEditContext()` | контекст правки, в том числе точки разреза |
| `isNew()`, `isChanged()`, `isDeleted()`, `isInvalid()` | состояние |
| `toJSON()` | сериализация для сохранения |

**[код]** Коллекция объектов (`geoObjects`): `get()`, `getGeoObjects()`,
`getCurrentGeoObjects()`, `getAddedGeoObjects()`, `getRemovedGeoObjects()`,
`addGeoObject()`, `removeGeoObject()`, `removeAll()`, `findById()`, `isLimitExceeded()`,
`add()`, `remove()`, `clone()`.

### 4.2. Роли и категории

**[код]** Связи «владелец → часть» описываются ролями, а не прямыми ссылками:
`contourRoleId` (роль контура), `elementRoleId` (роль элементов).

**[живой]** Растительность устроена так:

```
vegetation            (120112714) — атрибуты, своей геометрии нет
└── vegetation_fc     (120112715) — контур
    └── vegetation_el (9 объектов) — линейные части, каждая LineString
```

**[живой]** У объекта `120112715` девять элементов, 6…119 вершин, концы соседних
совпадают до знака, замыкающих точек нет.

### 4.3. Контекст правки (`editContext`)

**[код]** `editContext` — модель с точками и линиями разреза:

```js
editContext.getSplitPoints()   // коллекция точек разреза
editContext.getSplitLines()    // коллекция линий разреза
editContext.set({center, zoom, allowIntersections, allowInvalidContours})
editContext.getZoom()
```

**[код]** `editContext` объявлен `serializable: true`, то есть попадает в
`geoObject.toJSON()` при сохранении. Валидатор проверяет `splitLines`
(`splitLines.every(line => line.isValid())`).

**[живой]** При чтении объекта через `editor/getGeoObject` `editContext` в ответе
**не приходит**: сервер его не возвращает. Что именно делает сервер с
`splitPoints` при сохранении, не проверено (см. «Открытые вопросы»).

### 4.4. Карта редактора — это обёртка

**[код]** В `onViewAttrsRequest()` поле `map` — не `ymaps.Map`, а сервис-обёртка
(`map-service`). У неё есть `getZoom`, `getCenter`, `getFlatBounds`, `setCenter`,
`fitToViewport`, `addLayer` и т. п., но **нет** `events` и
`options.get('projection')`.

**[живой]** Проверено на живом редакторе:

```
Object.keys(attrs.map)  → $br, $vo, $Sb, … (минифицированные поля)
attrs.map.events        → undefined
attrs.map.options.get('projection') → undefined
attrs.map.getYMap()     → ymaps.Map
```

Настоящая карта доступна через `getYMap()`; у неё есть `events.add/remove`,
`getZoom()`, `options.get('projection').toGlobalPixels`, `converter`.

**Следствие:** подписываться на клики и проецировать координаты нужно на карте из
`getYMap()`. Если подписаться на обёртку, клик просто не придёт — инструмент будет
молча ничего не делать. Это уже было ошибкой в инструменте разреза, теперь мост
разворачивает обёртку (`lib/vegetation_cut/editor_bridge.ts`, `readMap`).

**[живой]** Событие клика настоящей карты содержит `globalPixels`, `coords`,
`pagePixels` и `target`; `globalPixels` можно использовать напрямую, без
проекции клика.

## 5. Редакторы контура: карта активностей

**[код]** Контурные редакторы — внутри модуля 74613 `geoobject-bundle`, регистрируются
через реестр `tm` и фабрику активностей. Регистрация контурной группы:

```js
activityManager.setOwner(this)
  .regActivity('contour-selector-on-map',        SelectorActivity,  SelectorView)
  .regActivity('contour-topology-on-map-editor', TopologyActivity,  TopologyView)
  .regActivity('contour-content-on-map-editor',  ContentActivity,   ContentView)
  .regActivity('rendered-on-map-viewer',         RenderedActivity,  RenderedView)
```

Что отдаёт каждая активность в `onViewAttrsRequest()`:

| Активность | `params` | `attrs` |
|---|---|---|
| `contour-selector-on-map` | `geoObject`, `contourRoleId`, `elementRoleId`, `onContourSelect` | `map`, `interactive`, `geoObject`, `contourRoleId`, `elementRoleId`, `hotspotsProvider`, `categoriesConfig`, `editorUtils`, `token`, `geoObjectFactory`, `onContourSelect` |
| `contour-topology-on-map-editor` | контур, роли, `minEditingZoom`, снаппинг, трассировка | `map`, `onMapEditingEnabled`, `geoObject`, `elementCategoryId`, `elementRoleId`, `elements`, `junctions`, `adjacentElements`, `geoObjectFactory`, `geometryFactory`, `editorState`, **`onChangeElementCoords`** |
| `contour-content-on-map-editor` | то же | `onMapEditingEnabled`, `toolbarItems` (сама активность — контейнер дочерних) |
| `contour-content-on-map-editor` → дочерняя `drawing` | контур, роль элементов, снаппинг | `map`, `geoObject`, `elementRoleId`, `elementCategoryId`, `editableElements` (новые), `nonEditableElements` (существующие), `geoObjectFactory`, `geometryFactory`, **`onChangeElementCoords`** |
| `contour-content-on-map-editor` → дочерняя `selector` | набор объектов | выбор объектов и командная панель с undo/redo |

**[код]** Ветвление при открытии контура (`startSubActivities`):

- нет элементов → создаётся новый контур, открывается редактор содержимого;
- один элемент → редактор топологии (`contour-topology-on-map-editor`);
- несколько элементов → экран выбора контура (`contour-selector-on-map`).

**[вывод]** Объект с девятью частями открывается через выбор контура, а не сразу
в редакторе топологии.

**[код]** Уточнение по порядку: выбор контура нужен, когда у объекта несколько
**контуров**. Если контур один и у него есть части (`getSlaves()`), редактор
сразу запускает топологию:

```js
if (contours.length === 1) {
  const contour = contours.getFirst()
  if (contour.getSlaves()) { setCurrentContour(contour); startContourTopologyEditor() }
  else loadContour(contour.getId())
} else {
  startContourSelector()
}
```

**[код]** Важное следствие для перехвата: дочерняя активность запускается
**внутри** `onStart` контейнера, поэтому хук контейнера срабатывает **после**
дочерней. Если запоминать «последнюю запущенную активность», контейнер вытеснит
рабочий редактор топологии. Правильно — держать самую способную активность
(ту, у которой есть `onChangeElementCoords` и элементы), а не последнюю.

**[код]** Элементы топологии подгружаются асинхронно
(`getContourTopologyByBounds().then(...)`), поэтому в момент `start` коллекция
`elements` может быть пустой. Готовность нужно перепроверять при перерисовке
интерфейса, а не один раз при запуске активности.

**[код]** У контурных элементов **нет** точек разреза: представление топологии
рендерит элемент с `cuttable: false` и **без** атрибута `splitPoints`. Значит,
нативный механизм точек разреза (раздел 6) для растительности недоступен.

## 6. Компонент редактора геометрии (модуль 57318)

Тот же компонент используется и для простых линий/полигонов, и для элементов
контура. Именно он умеет «разрезать» — но только когда ему передали нужные
атрибуты.

### 6.1. Атрибуты

**[код]**

| Атрибут | Смысл |
|---|---|
| `geometry` | редактируемая геометрия |
| `splitPoints` | коллекция точек разреза; **само наличие** включает режим разреза |
| `splitLines` | коллекция линий разреза (для площадей) |
| `cuttable` | разрешить «Разрезать» в меню вершины |
| `closable` | разрешить замыкание линии в кольцо |
| `mode` | `polygon` \| `polyline` \| `spline` \| `circle` \| `split` \| `tracer` |
| `onChangeCoords` | `({coords, splitCoords, splitLinesCoords}, reason) => void` |
| `onModeChange`, `onDrawingChange`, `onDone` | служебные |

**[код]** Проверки компонента:

```js
hasSplitPoints() { return !!this.attrs.splitPoints }   // $IJ
isCuttable()     { return !!this.attrs.cuttable }       // $iK
isClosable()     { return !!this.attrs.closable }       // $gK
isClosed()       { return this.attrs.geometry.isClosed() } // $pK
```

**[код]** Пункты меню вершины появляются по условиям:

```js
d > 2 && push({ title: 'round-angles' })
isClosable() && isCuttable() && push({ title: 'cut', onClick: () => cut(index) })
hasSplitPoints() && index > 0 && index < d-1 && push({ title: isSplit ? 'unsplit' : 'split' })
```

### 6.2. Что делает «cut»

**[код]** Для площадей «разрезать» — это разомкнуть кольцо в выбранной вершине:

```js
cut(index) {
  const coords = geometry.getCoordinates()
  const rotated = coords.slice(index, coords.length - 1).concat(coords.slice(0, index + 1))
  rotated[0] = shiftByPixels(rotated[0], 5, zoom)
  const rest = splitPoints.get().map(p => p.getCoordinates()).filter(p => !equals(p, rotated.at(-1)))
  onChangeCoords({ coords: rotated, splitCoords: rest })
}
```

**[вывод]** Это не «разрезание площади на две», а размыкание контура: материал не
удаляется. Нативный нож строений работает именно так.

### 6.3. Точки разреза и нативный алгоритм вставки

**[код]** Разрез линии — это **точка разреза**, а не две геометрии. Компонент
вставляет точку в ломаную и отдельно сообщает список точек:

```js
onSplitPointsChange(points) {
  const { geometry, onChangeCoords } = this.attrs
  onChangeCoords({ splitCoords: points, coords: insertSplitCoords(geometry.getCoordinates(), points) })
}
```

**[код]** `insertSplitCoords` (нативный алгоритм, `1e-4` — допуск):

```js
function insertSplitCoords(coords, splitPoints) {
  let remaining = splitPoints.length
  return coords.reduce((result, vertex, index) => {
    const prev = index > 0 ? coords[index - 1] : null
    const next = index < coords.length - 1 ? coords[index + 1] : null
    if (prev && remaining > 0) {
      result = result.concat(splitPoints.filter(point => {
        if (equal(point, prev)) { remaining--; return false }        // совпал с вершиной — не дублируем
        const onSegment = !equal(point, vertex) && pointOnSegment([prev, vertex], point, 1e-4)
        if (onSegment) remaining--
        return onSegment
      }))
    }
    // промежуточная вершина на одной прямой с соседями и не точка разреза — выбрасываем
    if (!(prev && next && pointOnSegment([prev, next], vertex, 1e-4) && !splitPoints.some(p => equal(p, vertex)))) {
      result.push(vertex)
    }
    return result
  }, [])
}
```

**[вывод]** Геометрия остаётся **одной** линией; точки разреза становятся её
вершинами и одновременно хранятся в `splitPoints`. Разбиение на части — дело
сохранения/сервера, а не редактора.

**[код]** Клик по линии ставит точку разреза с привязкой к вершинам в радиусе
20 px (`vertexSnappingArea: 20`); повторный клик по маркеру перетаскивает его,
двойной клик удаляет; курсор — `crosshair`, маркеры рисуются как `split-marker-N`.

### 6.4. Где точки разреза включены, а где нет

**[код]** Активность `polyline-geometry-on-map-editor` отдаёт точки разреза
только если её запустили с `splittable: true`:

```js
splitPoints: splittable ? geoObject.getEditContext().getSplitPoints() : undefined
```

**[код]** Контурные редакторы такого параметра не передают, у элементов
`splitPoints` нет. **Точки разреза для растительности недоступны** — это главный
факт для инструмента разреза.

## 7. Команды и отмена

Правки редактора идут через менеджер команд активности (у каждой активности свой,
создаётся в конструкторе). Меню `Ctrl+Z` работает через него же.

**[код]** Виды команд:

| Команда | Параметры | Смысл |
|---|---|---|
| пакет | `{commands: [...]}` | выполнить набор как одну правку |
| координаты | `{geometry, coords}` | `geometry.setCoordinates(coords)` |
| коллекция геометрий | `{geometryCollection, geometries}` | заменить содержимое коллекции |
| своя | `{onApply, onUndo}` | произвольное действие с откатом |

**[код]** Правка координат элемента контура (топология):

```js
onChangeElementCoords(element, coords) {
  commandManager.apply(new Batch({ commands: [
    new SetCoords({ geometry: element.getGeometry(), coords }),
    new Custom({ onApply: () => commitToContour(element) })
  ]}))
}
```

**[код]** Создание нового элемента (редактор содержимого, `onChangeElementCoords(null, coords)`):

```js
const element = geoObjectFactory.createGeoObject({
  categoryId: elementCategoryId,
  geometry: geometryFactory.createPolyline(coords)
})
commandManager.apply(new Custom({
  onApply: () => { watch(element.getGeometry()); slaves.addGeoObject(element); added.add(element) },
  onUndo:  () => { unwatch(element.getGeometry()); slaves.removeGeoObject(element); added.remove(element) }
}))
```

**[код]** Удаление элемента — та же схема с `onApply`/`onUndo` в обратном порядке.

**[код]** Фиксация элемента в контуре (после правки):

```js
commitToContour(element) {
  const collection = contour.getSlavesByRole(elementRoleId).getGeoObjects()
  const existing = collection.findById(element.getId())
  if (element.isChanged()) {
    if (existing && existing !== element) collection.remove(existing).add(element)
    else if (!existing) collection.add(element)
  } else if (existing) {
    collection.remove(existing)
  }
  if (!collection.some(item => item.isChanged())) {
    collection.removeAll()
    backup.forEach(item => collection.add(item))
  }
}
```

## 8. Сохранение

**[код]** Сохраняется объект целиком, JSON-ом:

```js
saveGeoObject({ geoObject: geoObject.toJSON(), feedbackTaskId, stickPolygons, roadSurfaceDeepSplit })
  // → editor/saveGeoObject

saveGeoObjects({ geoObjects: collection.toJSON(), feedbackTaskId, stickPolygons })
  // → editor/saveGeoObjects
```

**[код]** Транспорт — batch (`/api/v2/batch`): `content-type: text/plain;charset=UTF-8`,
заголовок `x-csrf-token`, `x-lang`, куки. HTTP 200 даже при ошибке: результат
разбирается по элементам массива.

**[живой]** CSRF-токен живёт в `localStorage["nk:token"]` (значение вида
`"1795296163:24047060"`), но в заголовок идёт из замыкания приложения. Пустой
заголовок → **403**. В расширении токен перехватывается хуком `fetch`/XHR
(`lib/object_tracker/csrf_capture.ts`).

**[вывод]** Если инструмент пишет на сервер сам, он обязан брать токен через
существующий перехват, а не из `localStorage`.

## 9. Нативное разрезание объектов

**[код]** В редакторе есть серверный инструмент пересечений:

```js
editorService.createIntersections({ geoObjects, editContext })
  .then(({ geoObjects, splitObjectIds }) => { /* ... */ })
```

**[код]** Обработчик результата заменяет объект на части:

```js
splitObjectIds.forEach(({ id, parts }) => {
  collections.forEach(collection => {
    const original = collection.findById(id)
    if (!original) return
    collection.remove(original)
    parts.forEach(part => collection.add(geoObjectFactory.createGeoObject(part)))
  })
})
```

**Вывод:** сервер умеет резать объекты и возвращать готовые части. Это
альтернативный путь для инструмента разреза — но он требует выделения объектов и
не даёт нативной отмены на уровне редактора (части приходят с сервера).

## 10. Рецепты

### 10.1. Поймать открытый редактор

```ts
installActivityHook({
  onStart: (activity) => {
    const attrs = activity.onViewAttrsRequest?.()     // данные для представления
    const categoryId = activity.params?.geoObject?.getCategoryId?.()
  },
  onStop: () => {},
})
```

### 10.2. Прочитать геометрию и карту

```ts
const attrs = activity.onViewAttrsRequest()
const geometry = attrs.geoObject.getGeometry()
const coords = geometry.getCoordinates()
const map = attrs.map                                  // getZoom(), options.get('projection'), events
```

### 10.3. Разрезать элемент на две части (без точек разреза)

```ts
const attrs = activity.onViewAttrsRequest()
const collection = attrs.geoObject.getSlavesByRole(attrs.elementRoleId)
const element = /* выбранный LineString */
const [left, right] = splitLineAtCut(element.getGeometry().getCoordinates(), cut)

attrs.onChangeElementCoords(element, left)                       // первая часть, с отменой
const second = attrs.geoObjectFactory.createGeoObject({
  categoryId: attrs.elementCategoryId,
  geometry: attrs.geometryFactory.createPolyline(right)
})
collection.addGeoObject(second)                                 // вторая часть (см. ограничения)
```

**[вывод]** Первая часть правки откатывается штатно (`onChangeElementCoords` идёт
через менеджер команд). Добавление второй части через коллекцию — вне менеджера
команд: отмена её не снимет, а представление может показать её только после
перерисовки. Надёжнее добавлять часть той же схемой, что и редактор содержимого
(команда `onApply`/`onUndo`) — но её менеджер команд не отдаётся в `attrs`.

**[код]** Готовый мост — `lib/vegetation_cut/editor_bridge.ts`:
`createEditorBridge(activity)` возвращает `getElements()`, `canCut()` и
`applyCut(elementId, parts)`. Одна часть (размыкание кольца) правит элемент,
две части — правят элемент и добавляют новый в роль `elementRoleId`.

### 10.4. Кнопка в нативном тулбаре

```ts
ensureVegetationCutButton({ label, onClick })
// классы: nk-button nk-button_theme_air nk-button_size_xl nk-on-map-toolbar__item
// встаёт после нативной кнопки разрезания ([class*="nk-icon_id_split"]), иначе в конец
```

## 11. Грабли

1. **`ymaps.geometryEditor` не участвует** в редактировании объектов НЯК —
   **[живой]**. Хуки на `startEditing` для растительности не срабатывают.
2. **`attrs.map` — обёртка, а не карта** — **[живой]**. Нет `events` и проекции;
   настоящая карта в `getYMap()`. Подписка на клик через обёртку молчит.
3. **Имена минифицированы.** Опираться можно на методы (`start`,
   `onViewAttrsRequest`) и на `params`/`attrs`, но не на `$aK`-подобные поля.
4. **Хук прототипа глобален.** Он влияет на все активности сразу; обработчики
   должны быть дешёвыми и не падать (`try/catch` внутри).
5. **Подклассы.** Оборачивать только классы с собственным `start`, иначе двойной
   вызов.
6. **Подписки живут на прототипе.** Маркер «уже обёрнут» не должен быть
   одноразовым флагом: при перезагрузке расширения обёрнутый прототип остаётся, и
   новая копия скрипта обязана иметь возможность подписаться (см. 3.4).
7. **`transient`-сервисы.** `activity-manager` и `activity-factory` из контейнера
   — не живые экземпляры.
8. **`document_start` + MAIN world.** Позже хука не поставить: классы уже
   объявлены и, возможно, использованы.
9. **Тулбар перерисовывается.** Кнопку нужно переустанавливать по мутациям DOM
   и не вешать обработчик дважды (см. `lib/vegetation_cut/button.ts`).
10. **`getGeoObject` не возвращает `editContext`** — **[живой]**. Нельзя прочитать
   точки разреза из API, только из открытого редактора.
11. **403 без CSRF** даже при валидном токене в `localStorage` — **[живой]**.
12. **Правка мимо менеджера команд** не откатывается `Ctrl+Z`.

## 12. Как проверить самому

Консоль на `n.maps.yandex.ru` (контекст `top`):

```js
// какие скрипты загружены (оттуда брать актуальные хэши бандлов)
performance.getEntriesByType('resource').map(e => e.name).filter(n => /\.js(\?|$)/.test(n))

// включить диагностику разреза растительности
localStorage.setItem('nmap-veg-cut-debug', '1')

// узнать, что отдаёт открытый редактор (после старта активности)
// см. лог [nmap_vegetation_cut] activity started

// проверить, что хук активностей встал на классы
ymaps.modules.require(['geometryEditor.Base'], (Base) => console.log(Base.prototype))
```

Проверка объекта через API (нужен токен из перехвата):

```js
fetch('/api/v2/batch', {
  method: 'POST',
  headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-lang': 'ru', 'x-csrf-token': token },
  credentials: 'include',
  body: JSON.stringify([{ method: 'editor/getGeoObject', params: { id: '120112715', token: '', branch: '0' } }]),
}).then(r => r.text()).then(console.log)
```

## 13. Чек-лист при обновлении редактора

1. Открыть растительность, включить `nmap-veg-cut-debug`, проверить лог:
   приходит ли активность, есть ли `categoryId`, `elementRoleId`, `elements`.
2. Сверить регистрацию контурных активностей (`contour-*`) и наличие
   `onChangeElementCoords` в `attrs`.
3. Проверить, не появился ли у элементов `splitPoints` (тогда можно упростить
   инструмент до точек разреза).
4. Перепроверить, что `ymaps.geometryEditor` по-прежнему не используется.
5. Прогнать `pnpm test:run` — тесты `tests/unit/vegetation_cut` построены на
   контракте активности и падают, если контракт изменился в коде расширения.

## Открытые вопросы

- Что сервер делает с `editContext.splitPoints` при сохранении: режет объект на
  части или игнорирует. Проверяется только сохранением (нужна учётная запись
  с правом правки).
- Как именно получены девять элементов у `120112714`: контурная топология,
  нативное разрезание (`createIntersections`) или применение точек разреза.
- Доступен ли `geometry-on-map-editor` с `splittable: true` для линейных
  растительных объектов в каких-то режимах.
