# Внутренности редактора Народной карты

Справочник по устройству `n.maps.yandex.ru`: как устроены редакторы объектов,
как к ним подключиться из расширения и что при этом нельзя ломать.

Документ нужен, чтобы не проходить путь реверс-инжиниринга заново. Инструмент
разреза растительности (`lib/vegetation_cut/`, ADR 0012 и 0013) — первый потребитель,
но справочник общий: счётчик вершин, трассировка, трекер и будущие инструменты
опираются на те же механизмы.

## Как читать

Каждый факт помечен источником:

- **[код]** — прочитано в бандле НЯК, приведён фрагмент. Сюда же относится прогон
  настоящих модулей НЯК вне браузера (раздел 12.1): это тот же код, но без
  сервера и без интерфейса.
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
| `16.13e8e9e116f945f1a647.ru.js` | общие зависимости (чанк 16): без него модули `app-bundle` не исполняются |
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

**[код]** `app.js` подключается не тегом в `<head>`, а встроенным загрузчиком в
конце `<body>`; остальные бандлы он догружает сам (`Promise.all([e(16), e(265)])`).
Content script на `document_start` при обычной загрузке страницы исполняется
раньше любого модуля НЯК.

**[код]** Колбэк рантайма, которым `app.js` заменяет `push`:

```js
function onChunk(parentPush, [chunkIds, factories, runtime]) {
  if (chunkIds.some(id => installed[id] !== 0)) {
    for (const id in factories) require.m[id] = factories[id]   // ← фабрики копируются здесь
    if (runtime) runtime(require)
  }
  if (parentPush) parentPush([chunkIds, factories, runtime])    // ← прежний push — после
  // …пометить чанки загруженными
}
chunks.forEach(onChunk.bind(null, 0))
chunks.push = onChunk.bind(null, chunks.push.bind(chunks))
```

Отсюда два следствия:

- Обернуть фабрику можно только **до** колбэка рантайма: к моменту вызова прежнего
  `push` фабрики уже скопированы в `require.m`, и подмена в чанке ни на что не
  влияет. Наблюдатель поэтому держит `push` аксессором и оборачивает фабрики в
  момент, когда страница зовёт `push`.
- Две независимые подмены `push` не уживаются: чанк первой видит только та, что
  поставлена последней, остальные получают его после копирования. На странице два
  потребителя наблюдателя (разрез растительности и адаптер трассировки), и каждый
  content script — отдельный бандл со своей копией модуля. Поэтому подмена одна на
  страницу, а список подписчиков лежит на самом массиве чанков
  (`__nmapWebpackModuleObservers__`, неперечислимое свойство): любой бандл и любая
  новая копия расширения подключаются к уже стоящему перехвату. См. ADR 0013.

**[код]** У рантайма нет открытого кэша модулей (`require.c` отсутствует): узнать,
какие модули уже исполнены, снаружи нельзя.

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

**[код]** Базовый класс активности экспортируется из модуля 17574 (`exports.A`),
а `start` и `stop` объявлены именно на нём. Классы конкретных редакторов из
модулей не экспортируются, но они наследники базового: достаточно обернуть
`start`/`stop` базового класса, и обёртку получат все редакторы.

**[код]** Признак класса активности:

```js
proto.start && proto.stop && proto.onStart && proto.onViewAttrsRequest && proto.isStarted
```

**[вывод]** Проверять надо `hasOwnProperty`: у подклассов `start` наследуется, и
повторная обёртка дала бы двойной вызов. Поэтому в `editor_access.ts` подклассы
без собственного `start` пропускаются.

**[код]** Хук ставится в MAIN world на `document_start`
(`entrypoints/map-vegetation-cut.content.ts`): модуль 17574 исполняется при
загрузке `app-bundle`, и наблюдатель видит его экспорт в этот момент. Если скрипт
появился на странице позже (раздел 3.4.1), класс уже не поймать.

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
- **[код]** Достать `require` страницы можно (чанк с runtime-функцией:
  `chunks.push([[id], {}, (require) => …])`), но пользоваться им из расширения
  нельзя: кэша модулей снаружи не видно, и `require(id)` исполнит модуль, который
  страница ещё не запускала. Перехват `di-container.instantiate`, построенный на
  этом, из инструмента убран (ADR 0013). Для разбора вне браузера приём годится
  (раздел 12.1).

### 3.3. Диагностика

Первым делом проверяется, дошёл ли скрипт до страницы. Инструмент разреза
растительности ставит на `<html>` атрибут `data-nmap-veg-cut`:

```js
document.documentElement.getAttribute('data-nmap-veg-cut')
```

| Значение | Что значит |
|---|---|
| `null` | content script не загружен (расширение в браузере старше сборки) или уже остановлен: метка снимается при остановке скрипта |
| `loaded` | скрипт исполнился, хук ещё не поставлен |
| `hooked:0` | наблюдатель стоит, но базовый класс активности через него не проходил: редактор откроется мимо хука |
| `hooked:<N>` | перехвачено N классов активностей (обычно 1 — базовый), редактор растительности не открыт |
| `idle` | редактор закрыт |
| `other:<категория>` | открыт редактор не растительности |
| `wait:<категория>` | растительность открыта, но редактор ещё не готов резать (элементы не загрузились или это экран выбора контура) |
| `unsupported:commands` | редактор готов, но у активности не нашёлся менеджер команд (или их несколько): разрез нельзя было бы отменить, кнопка не показывается |
| `ready:<категория>:<элементов>` | кнопка доступна |
| `error:<сообщение>` | скрипт загрузился, но упал при инициализации |

**[код]** Кнопка живёт только внутри редактора линейной растительности. Открытый
редактор записан в адресе страницы (`#!/objects/<id>/edit`), поэтому после
перезагрузки вкладки НЯК открывает его снова — и кнопка должна появиться без
дополнительных действий. Если после перезагрузки на `…/edit` кнопки нет, это
сбой, а не норма; порядок разбора — в разделе 3.5.

**[код]** `hooked:0` сразу после загрузки — нормальное промежуточное значение:
`app.js` ещё не исполнился. Тревожно, если оно осталось, когда интерфейс НЯК уже
нарисован: базовый класс активности прошёл мимо наблюдателя. Причин две.

1. Скрипт появился на странице позже бандла НЯК. Firefox подставляет content
   scripts в открытые вкладки при обновлении расширения; Chrome этого не делает,
   там в такой вкладке останется прежняя копия скрипта (или `null`). Лечится
   перезагрузкой вкладки.
2. На очереди чанков стоит чужая подмена `push`, поставленная позже нашей и не
   через общий реестр (раздел 1). Так было до ADR 0013: разрез и трассировка
   ставили по собственной подмене, манифест исполняет разрез первым, и в
   production-сборке кнопка не появлялась никогда — `hooked:0` при каждой загрузке.
   В dev-режиме порядок регистрации скриптов не закреплён, поэтому там кнопка
   иногда была, и ошибка выглядела как «пропадает после перезагрузки».

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

В консоли при загрузке печатается `[nmap_vegetation_cut] content script loaded`.

Журнал запусков активностей и подробный лог в консоль включаются флагом (хук
срабатывает на каждую активность приложения, поэтому без флага ничего не
собирается):

```js
localStorage.setItem('nmap-veg-cut-debug', '1')   // затем перезагрузить вкладку

window.__nmapVegCutLog                             // последние 50 запусков
// [{categoryId, elementCategoryId, elementRoleId, elements, canCut, attrsKeys}, …]
```

С тем же флагом при включённом режиме в консоль пишется каждый клик мышью:
`[nmap_vegetation_cut] click {result, target, point}` (уровень `debug` — в
консоли Chrome включить «Verbose»). `result` — исход разреза (`cut`, `opened`,
`miss`, `too-short`…) или причина, по которой клик не взят: `не карта`,
`перетаскивание`, `нет координат`. Если после клика по линии записи нет вовсе,
клик до инструмента не дошёл.

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

### 3.4.1. Скрипт опоздал: хука не будет до перезагрузки вкладки

**[код]** При обычной загрузке страницы content script успевает раньше `app.js`
(раздел 1), и базовый класс активности приходит через наблюдатель. Прежнее
объяснение «бандлы объявляются раньше content script, поэтому перехват `push`
почти всегда опаздывает» было неверным: `hooked:0` давал конфликт двух подмен
`push`, а не порядок загрузки.

**[код]** Опоздать скрипт может только в уже загруженной вкладке (Firefox
подставляет скрипты при обновлении расширения). Модуль 17574 к этому моменту
исполнен и второй раз через `push` не пройдёт. Инструмент в такой вкладке не
подключается и ждёт перезагрузки — так же ведёт себя трассировка.

**[вывод]** Запасной путь через `di-container.instantiate` (достать `require`
страницы, найти контейнер по форме, подменить `instantiate`) из инструмента
убран. Он требовал `require` модулей из расширения, а это исполняет код, который
страница ещё не запускала; после починки наблюдателя путь стал не нужен. Решение
записано в ADR 0013.

**[живой]** Момент `start` — не момент готовности: у топологии элементы
приходят асинхронно (`getContourTopologyByBounds`), в `start` их ещё ноль.
Готовность нужно перепроверять при перерисовке интерфейса.

### 3.5. Если кнопки нет: порядок проверки

1. `document.documentElement.getAttribute('data-nmap-veg-cut')`.
2. `null` — скрипт не исполнялся. Проверить в `chrome://extensions`, что
   расширение загружено из актуального каталога (`.output/chrome-mv3` или
   `.output/chrome-mv3-dev`), нажать «Обновить» и перезагрузить вкладку.
3. `error:…` — скрипт упал при инициализации; текст ошибки в значении атрибута.
4. `hooked:0` при нарисованном интерфейсе — базовый класс активности прошёл мимо
   наблюдателя. Перезагрузить вкладку. Если значение то же и после перезагрузки,
   на очереди чанков стоит чужая подмена `push` (раздел 3.3): проверить, какие
   скрипты расширения работают на странице в MAIN world и все ли они ходят через
   `observeWebpackModules`.
5. `hooked:<N>` — всё готово, редактор растительности не открыт. Открыть объект и
   нажать «Редактировать».
6. `wait:…` — редактор растительности открыт, но топология не запущена
   (например, открыт режим редактирования содержимого контура). Достаточно
   переключиться в режим топологии или закрыть и открыть редактор.
7. `unsupported:commands` — редактор изменился: у активности топологии не нашёлся
   ровно один менеджер команд (раздел 7). Инструмент выключен намеренно; нужно
   сверить набор методов менеджера и поправить поиск в `editor_bridge.ts`.
8. `ready:…` — всё работает; если кнопки не видно, смотреть тулбар над картой.

**[код]** Активность `Mo` (топология) запускается при входе в редактирование
контура — в том числе сама, после перезагрузки вкладки на `…/edit`. Хук ловит
только запуск: если скрипт появился на странице при уже открытом редакторе
(обновление расширения в Firefox), `start` уже прошёл, и нужна перезагрузка
вкладки.

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
`getZoom()`, `options.get('projection').toGlobalPixels`, `converter`,
`container.getElement()`.

**Следствие:** проецировать координаты нужно на карте из `getYMap()`; мост
разворачивает обёртку сам (`lib/vegetation_cut/editor_bridge.ts`, `readMap`).

### 4.5. Клик по линии до карты не доходит

**[живой, ymaps 2.1.79 вне НЯК]** Событие `click` карты (`map.events`)
срабатывает только на пустом месте. Клик по геообъекту — линии или вершине в
режиме редактирования — получает сам геообъект и `map.geoObjects.events`, до
`map.events` он не доходит. НЯК грузит ту же версию API
(`api-maps.yandex.ru/2.1.79`), а редактируемая часть контура — геообъект `ymaps`
(компонент 57318 рисует `polyline`).

Инструмент разреза подписывался на `map.events` и поэтому молчал: кнопка нажата,
состояние `ready:…`, а клик по линии ничего не делает. Автотесты этого не
ловили: они звали обработчик клика напрямую, минуя источник события.

Что проверено на той же странице:

| Клик | `map.events` | `map.geoObjects.events` | DOM `click`, цель |
|---|---|---|---|
| по пустому месту | да | нет | панель событий |
| по линии | **нет** | да | панель событий |
| по вершине в режиме редактирования | **нет** | да | панель событий |
| по пункту меню вершины | нет | нет | меню вершины |

- Все клики по карте, линиям и вершинам браузер отдаёт одному элементу —
  `<ymaps class="ymaps-2-1-79-events-pane …">`; попадание в геообъект `ymaps`
  считает сам. Меню вершины лежит в контейнере карты, но вне этой панели.
- `map.converter.pageToGlobal([pageX, pageY])` даёт те же глобальные пиксели, что
  и `globalPixels` в событии карты.
- `ymaps` узнаёт о клике из DOM-события `click`: если остановить его в фазе
  перехвата на `document`, ни геообъект, ни карта клика не получают, меню
  вершины не открывается.

**Следствие:** клики для разреза берутся из DOM (`click` на `document`, фаза
перехвата), а не из событий карты; см. раздел 10.5 и ADR 0015.

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

**[код]** Менеджер команд (модуль 49706):

```js
class CommandManager {
  apply(command) {            // обрезает «будущее» истории, кладёт команду, затем command.apply()
    history.splice(position, history.length - position, command)
    position++
    command.apply()
    this.emit('apply')
  }
  canUndo()                   // position > 0
  undo()                      // history[--position].undo()
  canRedo()                   // position < history.length
  redo()                      // history[position++].redo()
}
```

Команды проверяются утиной типизацией: годится любой объект с `apply`, `undo` и
`redo`. У базового класса команд (модуль 21822) `redo()` — это `apply()`; своя
команда без `redo` сломает повтор.

**[код]** Менеджер — поле активности (`$KN` у топологии), в `attrs` он не
попадает; кнопки «Отменить»/«Повторить» тулбара и `Ctrl+Z`/`Ctrl+Y` ходят в него
же. Имя поля минифицировано, поэтому инструмент разреза ищет менеджер среди
значений активности по набору методов (`apply`, `undo`, `redo`, `canUndo`,
`canRedo`) и включается, только если такой объект ровно один.

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

**[код]** Редактор топологии рисует **не** связь контура, а собственную коллекцию:

```js
backup   = contour.getSlavesByRole(elementRoleId).getGeoObjects().clone()   // $bO
elements = backup.len() === 1 ? backup.clone() : Collection.create()        // $dO → attrs.elements
// при нескольких частях elements наполняется ответом getContourTopologyByBounds
```

`clone()` копирует и сами объекты, поэтому элемент из `attrs.elements` и объект с
тем же id в связи контура — разные экземпляры. В связь правленый элемент попадает
только через `commitToContour`. Следствия для расширения:

- добавить часть в связь (`addGeoObject`) мало: редактор её не нарисует и резать
  дальше её нельзя. Часть нужно положить и в `attrs.elements`;
- активность подписана на `add` и `change` коллекции: `add` включает слежку за
  ограничениями геометрии (`geometryRestrictionsManager.startWatching`), `change`
  перерисовывает вид. Коллекция шлёт `change` и при добавлении, и при удалении;
  слежку при удалении активность сама не снимает;
- `collection.add(item)` молча пропускает объект с уже известным id.

**[код]** `isChanged()` сравнивает объект с копией, снятой при создании
(`fast-deep-equal` по свойствам): после отмены правки координат объект снова «не
изменён», и `commitToContour` убирает его из связи.

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

**[код]** Что уходит на сервер после правок контура (`contour.toJSON()`, получено
прогоном настоящих моделей НЯК, раздел 12.1). Неизменённый объект сериализуется
ссылкой `{id, revisionId}`; изменения частей лежат в `slaves.<роль>.diff`:

```js
// правлена существующая часть и добавлена новая (разрез линии надвое)
{ id: '100', revisionId: '100:1', categoryId: 'vegetation_cnt', slaves: { part: { diff: {
  added:   [{ uuid: '…', categoryId: 'vegetation_el', geometry: { type: 'LineString', coordinates: […] } }],
  changed: [{ id: '200', revisionId: '200:1', categoryId: 'vegetation_el', geometry: {…} }]
}}}}
```

- новый объект идёт целиком и с `uuid` вместо `id`; объект, уже описанный в этом
  же JSON, повторно пишется ссылкой `{uuid}`;
- в `changed` попадают объекты связи, у которых `isChanged()`; в `added` и
  `removed` — то, что прошло через `addGeoObject`/`removeGeoObject`;
- после отмены всех правок JSON возвращается к `{id, revisionId}`.

**[код]** Если новую часть после добавления править штатным обработчиком
топологии (перетащить вершину или разрезать ещё раз), `commitToContour` положит
её и в связь: в JSON она окажется дважды — целиком в `added` и ссылкой `{uuid}` в
`changed`. Штатно редактор топологии с новыми частями не работает (их создаёт
редактор содержимого и правит без `commitToContour`), поэтому как сервер
принимает такой JSON, неизвестно — см. «Открытые вопросы».

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
}, { observe: observeWebpackModules })
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
const commands = /* менеджер команд активности, найден по набору методов (раздел 7) */
const relation = attrs.geoObject.getSlavesByRole(attrs.elementRoleId)
const element = /* выбранный LineString из attrs.elements */
const [left, right] = splitLineAtCut(element.getGeometry().getCoordinates(), cut)

const second = attrs.geoObjectFactory.createGeoObject({
  categoryId: attrs.elementCategoryId,
  geometry: attrs.geometryFactory.createPolyline(right),
})

// Штатную правку первой части забираем, не применяя: на время вызова
// менеджеру подставляется собственный apply, который только запоминает команду.
const edit = captureCommand(commands, () => attrs.onChangeElementCoords(element, left))

commands.apply({
  apply: () => { edit.apply(); relation.addGeoObject(second); attrs.elements.add(second) },
  undo:  () => {
    attrs.geometryRestrictionsManager.stopWatching(second.getGeometry())
    relation.removeGeoObject(second); attrs.elements.remove(second)
    edit.undo()
  },
  redo:  () => { edit.redo(); relation.addGeoObject(second); attrs.elements.add(second) },
})
```

**[код]** Разрез — одна запись в истории редактора: одна отмена возвращает линию
целиком, повтор режет снова. Вторая часть добавляется тем же порядком, каким
редактор содержимого добавляет нарисованную часть (раздел 7): в связь контура и
в коллекцию, которую рисует редактор. Проверено прогоном на настоящих моделях
НЯК (раздел 12.1): после отмены `contour.isChanged()` снова `false`, JSON для
сохранения совпадает с исходным.

**Не подтверждено вживую:** как это выглядит в редакторе (видна ли вторая часть
сразу, работают ли кнопки отмены тулбара) и принимает ли сервер сохранение.
Проверяется чек-листом `docs/checklists/vegetation-cut-smoke.md`; до прогона
пометка остаётся **[код]**.

**[код]** Готовый мост — `lib/vegetation_cut/editor_bridge.ts`:
`createEditorBridge(activity)` возвращает `getElements()`, `canCut()` и
`applyCut(elementId, parts)`. Одна часть (первая граница замкнутой линии) правит
элемент, две части — правят элемент и добавляют новый в роль `elementRoleId`.
Если вторую часть создать нельзя или редактор отказал в правке (лимит вершин),
линия остаётся нетронутой.

**[код]** Замкнутой линии нужны два клика (ADR 0014). Первый переносит её начало
в точку клика (`splitLineAtCut` возвращает одну часть) — это первая граница.
Второй делит линию от начала до начала на две части (`splitRingInTwo`). Линия с
перенесённым началом по координатам остаётся кольцом, поэтому режим
(`lib/vegetation_cut/mode.ts`) помнит точку первой границы по id элемента и
верит записи, только пока линия начинается в этой точке: так отмена в редакторе
учитывается без слежки за его историей.

### 10.4. Кнопка в нативном тулбаре

```ts
ensureVegetationCutButton({ label, onClick })
// классы: nk-button nk-button_theme_air nk-button_size_xl nk-on-map-toolbar__item
// встаёт после нативной кнопки разрезания ([class*="nk-icon_id_split"]), иначе в конец
```

### 10.5. Поймать клик по линии

```ts
const map = attrs.map.getYMap()
const container = map.container.getElement()

document.addEventListener('click', (event) => {
  // только сама карта: панель событий, а не меню вершины или интерфейс поверх
  const surface = event.target.closest('[class*="events-pane"]')
  if (!surface || !container.contains(surface)) return

  const globalPixels = map.converter.pageToGlobal([event.pageX, event.pageY])
  if (/* клик попал в линию и обработан */) event.stopPropagation()
}, true)
```

**[код]** Браузер присылает `click` и после перетаскивания карты или вершины,
поэтому контроллер запоминает точку нажатия (`pointerdown`/`mousedown`) и
пропускает клик, если указатель сдвинулся больше чем на 5 px. Клик, попавший в
линию, редактору не отдаётся: иначе он откроет меню вершины. Клик мимо линии
идёт редактору как обычно. Подписка живёт, только пока режим включён.

## 11. Грабли

1. **`ymaps.geometryEditor` не участвует** в редактировании объектов НЯК —
   **[живой]**. Хуки на `startEditing` для растительности не срабатывают.
2. **`attrs.map` — обёртка, а не карта** — **[живой]**. Нет `events` и проекции;
   настоящая карта в `getYMap()`. Подписка на клик через обёртку молчит.
   Подписка на `click` настоящей карты молчит тоже, если кликать по линии
   (раздел 4.5).
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
13. **`attrs.elements` — не связь контура** — **[код]**. Это отдельная коллекция
    копий; объект, добавленный только в связь, редактор не рисует (раздел 7).
14. **Dev-сборка не показывает порядок скриптов.** В `pnpm dev` content scripts
    регистрируются динамически, в production — по манифесту. Всё, что зависит от
    порядка исполнения, проверять на `pnpm build`.
15. **Одна подмена `push` на страницу** — **[код]**. Вторая независимая подмена
    ослепляет первую (раздел 1); всё, что смотрит на модули НЯК, должно ходить
    через `observeWebpackModules`. Общее состояние между скриптами расширения
    нельзя держать в замыкании модуля: каждый content script собран отдельно.
16. **`map.events` не видит кликов по геообъектам** — **[живой, вне НЯК]**
    (раздел 4.5). Всё, что должно реагировать на клик по редактируемой линии,
    слушает DOM. Тест, который зовёт обработчик клика напрямую, такую ошибку не
    ловит: событие в тесте должно идти тем же путём, что в браузере.

## 12. Как проверить самому

Консоль на `n.maps.yandex.ru` (контекст `top`):

```js
// какие скрипты загружены (оттуда брать актуальные хэши бандлов)
performance.getEntriesByType('resource').map(e => e.name).filter(n => /\.js(\?|$)/.test(n))

// включить диагностику разреза растительности (и перезагрузить вкладку)
localStorage.setItem('nmap-veg-cut-debug', '1')

// узнать, что отдаёт открытый редактор (после старта активности)
// см. лог [nmap_vegetation_cut] activity started и window.__nmapVegCutLog

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

### 12.1. Прогон модулей НЯК вне браузера

Часть вопросов решается без редактора и без сохранения на карте: бандлы НЯК —
обычные файлы, и их модули исполняются в `happy-dom`.

1. Скачать `index.html` и бандлы из таблицы «Версия и источники» (адреса — в
   `r.p` и `r.u` внутри `app.js`).
2. Создать окно `happy-dom` с элементом `<script id="config">` (модуль 75744
   читает из него JSON с `analytics`, `fonts`, `urls.base`) и исполнить в нём
   `app.js`, чанк 16, `app-bundle`, `geoobject-bundle`. Точка входа `app.js`
   упадёт на сети — рантайм к этому моменту уже стоит.
3. Достать `require`: `webpackChunknmaps.push([[987654321], {}, (r) => { … }])`.
4. Собрать нужное из настоящих классов: коллекция — модуль 64127, менеджер
   команд — 49706, пакет команд — 18368, правка координат — 6998, фабрика
   геометрий — 48590, фабрика объектов — 44046 (в конструктор передаётся
   собственный `categories-config` с `getSlaveRoles`/`getMasterRoles`/`hasGeometry`).

Так проверены: конфликт двух подмен `push` на production-сборке расширения
(старая сборка — `hooked:0`, новая — `hooked:1` при любом порядке скриптов),
события коллекции, менеджер команд и JSON сохранения после разреза и отмены,
а также замкнутая линия: первая граница, деление вторым кликом, отмены и повтор
(координаты после правки и отмены совпадают с запомненной точкой точно).

**Грабли:** сравнение моделей (`fast-deep-equal`) считает массивы из разных
миров разными. Координаты, созданные в мире теста, а не окна `happy-dom`, делают
объект «изменённым» навсегда. В браузере мир один (MAIN world), поэтому в тесте
координаты нужно пересоздавать в окне: `window.JSON.parse(JSON.stringify(coords))`.

Редактор целиком (`Mo` с картой и представлением) так не поднять: нужны `ymaps`
и сервер. Внешний вид и сохранение проверяются только вживую.

### 12.2. Стенд на настоящей карте ymaps

Всё, что касается кликов и координат, проверяется без НЯК и без входа в Яндекс:
API карт публичный, версия та же (`2.1.79`).

1. Локальная страница: `<script src="https://api-maps.yandex.ru/2.1.79/?load=package.full&coordorder=longlat&lang=ru_RU">`,
   блок `.nk-on-map-toolbar` и блок карты.
2. Стенд: карта, `ymaps.Polyline` с `editor.startEditing()` и редактор-заглушка с
   контрактом активности (`onViewAttrsRequest` отдаёт `map: { getYMap }`,
   `elements`, фабрики, `onChangeElementCoords`; менеджер команд — поле
   активности). В заглушку передаётся настоящий `VegetationCutController`.
3. Собрать одним файлом: `esbuild harness.ts --bundle --format=iife --alias:@=.`
   и отдать через `python3 -m http.server`.

Так воспроизведён дефект «кнопка нажата, клик по линии ничего не делает» на
сборке до исправления и проверено исправление: клик по линии и по вершине режет
в точке клика, редактор клика не получает, меню вершины не открывается, отмена
возвращает линию.

Стенд не заменяет живой прогон: редактор в нём — заглушка.

## 13. Чек-лист при обновлении редактора

1. Открыть растительность, включить `nmap-veg-cut-debug`, проверить лог:
   приходит ли активность, есть ли `categoryId`, `elementRoleId`, `elements`.
2. Сверить регистрацию контурных активностей (`contour-*`) и наличие
   `onChangeElementCoords` в `attrs`.
3. Сверить колбэк рантайма в `app.js` (раздел 1): фабрики по-прежнему копируются
   до вызова прежнего `push`, базовый класс активности по-прежнему экспортируется.
   Признак расхождения — `hooked:0` при нарисованном интерфейсе.
4. Сверить набор методов менеджера команд (раздел 7). Признак расхождения —
   `unsupported:commands`.
5. Проверить, не появился ли у элементов `splitPoints` (тогда можно упростить
   инструмент до точек разреза).
6. Перепроверить, что `ymaps.geometryEditor` по-прежнему не используется.
7. Прогнать `pnpm test:run` — тесты `tests/unit/vegetation_cut` построены на
   контракте активности и падают, если контракт изменился в коде расширения.
8. Пройти `docs/checklists/vegetation-cut-smoke.md` на production-сборке.

## Открытые вопросы

- Что сервер делает с `editContext.splitPoints` при сохранении: режет объект на
  части или игнорирует. Проверяется только сохранением (нужна учётная запись
  с правом правки).
- Как именно получены девять элементов у `120112714`: контурная топология,
  нативное разрезание (`createIntersections`) или применение точек разреза.
- Доступен ли `geometry-on-map-editor` с `splittable: true` для линейных
  растительных объектов в каких-то режимах.
- Принимает ли сервер разрез без узлов. Части контура связаны с объектами-узлами
  ролями `start`/`end`; инструмент узел в точке разреза не создаёт и концы новой
  части ни к чему не привязывает (ADR 0013). Проверяется сохранением.
- Принимает ли сервер новую часть, которая после добавления правилась в
  редакторе топологии: в JSON она идёт и в `added`, и ссылкой в `changed`
  (раздел 8). Проверяется сохранением после повторного разреза новой части.
