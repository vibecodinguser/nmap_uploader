# Штатная трассировка по полигону заметки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить выбранный полигон Блокнота картографа к штатной функции «Трассировка» НЯК как временный read-only кандидат.

**Architecture:** MAIN-world content script в `document_start` перехватывает регистрацию модулей `self.webpackChunknmaps` и по поведенческим признакам находит geometry factory и hotspot-компонент. Адаптер временно расширяет только `getGeoObjectsByCoords`: при вызове штатным tracer-provider он добавляет замороженный объект заметки с нативной Polygon-геометрией, не регистрируя его в модели редактора или коллекции сохранения. При несовпадении runtime-контракта интеграция не активируется.

**Tech Stack:** TypeScript 5.9, WXT 0.20 MAIN-world content scripts, Vitest 4, happy-dom, Biome.

## Global Constraints

- Пользователь самостоятельно включает штатную кнопку «Трассировка».
- Координаты payload и внутренних геометрий имеют порядок `[longitude, latitude]`.
- Служебный ID имеет вид `nmap-uploader:note:<id>`.
- Временная цель не добавляется в geoObjects карты, editor state, undo/redo или save payload.
- При ошибке capability probe исходный метод восстанавливается, а штатная трассировка продолжает работать.
- Диагностика начинается с `[nmap_uploader] native tracing` и не содержит координат.
- Готовность подтверждается ручной проверкой в живом НЯК; unit-тестов недостаточно.

---

### Task 1: Канонический замкнутый payload полигона

**Files:**
- Modify: `lib/nmaps_draw_objects.ts`
- Modify: `tests/unit/nmaps_draw_objects.test.ts`

**Interfaces:**
- Consumes: `PolygonSnapTarget`.
- Produces: `normalizePolygonCoordinates(coordinates): [number, number][] | null`; `createPolygonSnapTarget` и `parseDrawMapObjectsDetail` всегда возвращают замкнутый контур минимум с тремя уникальными точками.

- [ ] **Step 1: Write the failing tests**

Добавить проверки, что незамкнутый корректный контур замыкается копией первой точки, уже замкнутый не получает дубль, а `NaN`, `Infinity` и контур менее чем из трёх уникальных точек дают `snapTarget: null`.

```ts
it('замыкает валидный контур ровно один раз', () => {
  const detail = parseDrawMapObjectsDetail({
    points: [],
    snapTarget: {
      id: 'polygon',
      coordinates: [
        [37.6, 55.7],
        [37.7, 55.7],
        [37.7, 55.8],
      ],
    },
  })

  expect(detail?.snapTarget?.coordinates).toEqual([
    [37.6, 55.7],
    [37.7, 55.7],
    [37.7, 55.8],
    [37.6, 55.7],
  ])
})

it('не дублирует замыкающую точку', () => {
  const coordinates: [number, number][] = [
    [37.6, 55.7],
    [37.7, 55.7],
    [37.7, 55.8],
    [37.6, 55.7],
  ]
  expect(createPolygonSnapTarget({ id: 'polygon', geomType: 'Polygon', geomCoords: coordinates }))
    .toEqual({ id: 'polygon', coordinates })
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test:run tests/unit/nmaps_draw_objects.test.ts`

Expected: FAIL — незамкнутый контур возвращается без последней точки.

- [ ] **Step 3: Implement normalization**

Добавить и использовать одну функцию:

```ts
const coordinatesEqual = (left: [number, number], right: [number, number]): boolean =>
  left[0] === right[0] && left[1] === right[1]

export const normalizePolygonCoordinates = (
  value: unknown,
): [number, number][] | null => {
  if (!Array.isArray(value)) return null
  const coordinates = value.filter(isCoordinate)
  if (countUniqueCoordinates(coordinates) < 3) return null

  const normalized = coordinates.map(([longitude, latitude]) => [longitude, latitude] as [
    number,
    number,
  ])
  if (!coordinatesEqual(normalized[0], normalized.at(-1) as [number, number])) {
    normalized.push([...normalized[0]])
  }
  return normalized
}
```

В обеих точках создания payload использовать только результат `normalizePolygonCoordinates`; не фильтровать координаты второй раз.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `pnpm test:run tests/unit/nmaps_draw_objects.test.ts tests/unit/notes_tab.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nmaps_draw_objects.ts tests/unit/nmaps_draw_objects.test.ts
git commit -m "fix(tracing): нормализовать контур заметки"
```

---

### Task 2: Безопасный перехват модулей webpack

**Files:**
- Create: `lib/nmaps_webpack_module_observer.ts`
- Create: `tests/unit/nmaps_webpack_module_observer.test.ts`

**Interfaces:**
- Produces: `observeWebpackModules(globalObject, chunkName, onModule): () => void`.
- `onModule(exports, moduleId)` вызывается после исполнения каждой фабрики; функция восстановления возвращает исходный `push`.

- [ ] **Step 1: Write the failing contract tests**

Fake runtime должен покрыть: массив существует до runtime; runtime заменяет `push`; observer всё равно видит экспорт лениво выполненного модуля; повторная установка не оборачивает фабрику дважды; restore прекращает наблюдение.

```ts
it('наблюдает модуль после замены push webpack runtime', () => {
  const globalObject: Record<string, unknown> = {}
  const seen = vi.fn()
  const restore = observeWebpackModules(globalObject, 'webpackChunknmaps', seen)
  const chunks = globalObject.webpackChunknmaps as unknown[] & { push: (...args: unknown[]) => number }

  const factories: Record<string, Function> = {}
  chunks.push = (chunk: unknown) => {
    Object.assign(factories, (chunk as [number[], Record<string, Function>])[1])
    return 1
  }
  chunks.push([[265], { 48590: (_module: unknown, exports: Record<string, unknown>) => {
    exports.A = class GeometryFactory {}
  } }])
  const module = { exports: {} as Record<string, unknown> }
  factories['48590'](module, module.exports, vi.fn())

  expect(seen).toHaveBeenCalledWith(module.exports, '48590')
  restore()
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test:run tests/unit/nmaps_webpack_module_observer.test.ts`

Expected: FAIL — модуль отсутствует.

- [ ] **Step 3: Implement the observer**

Реализовать accessor для `chunkArray.push`. Getter должен возвращать wrapper, который захватывает текущий delegate в момент чтения; это сохраняет цепочку webpack `previousPush` без рекурсии. Перед передачей chunk в delegate заменить каждую фабрику один раз через `WeakSet<Function>`. Wrapper фабрики вызывает original через `Reflect.apply`, затем передаёт `module.exports` наблюдателю. `restore()` восстанавливает собственный descriptor `push`; если webpack runtime уже назначил свой обработчик, он остаётся обычным value-методом, чтобы последующие lazy chunks продолжили загружаться.

```ts
export type WebpackModuleObserver = (exports: unknown, moduleId: string) => void

export const observeWebpackModules = (
  globalObject: Record<string, unknown>,
  chunkName: string,
  onModule: WebpackModuleObserver,
): (() => void) => {
  const chunks = (globalObject[chunkName] ??= []) as unknown[] & {
    push: (...chunks: unknown[]) => unknown
  }
  const originalDescriptor = Object.getOwnPropertyDescriptor(chunks, 'push')
  let delegate = Array.prototype.push.bind(chunks) as (...chunks: unknown[]) => unknown
  let delegateWasAssigned = false
  const wrappedFactories = new WeakSet<Function>()
  let active = true

  const instrument = (chunk: unknown): void => {
    const modules = Array.isArray(chunk) ? chunk[1] : null
    if (!modules || typeof modules !== 'object') return
    for (const [moduleId, factory] of Object.entries(modules as Record<string, Function>)) {
      if (wrappedFactories.has(factory)) continue
      const wrapped = function (this: unknown, module: { exports: unknown }, ...args: unknown[]) {
        const result = Reflect.apply(factory, this, [module, ...args])
        if (active) onModule(module.exports, moduleId)
        return result
      }
      wrappedFactories.add(wrapped)
      ;(modules as Record<string, Function>)[moduleId] = wrapped
    }
  }

  Object.defineProperty(chunks, 'push', {
    configurable: true,
    get() {
      const currentDelegate = delegate
      return (...incoming: unknown[]) => {
        incoming.forEach(instrument)
        return currentDelegate(...incoming)
      }
    },
    set(next: unknown) {
      if (typeof next === 'function') {
        delegate = next.bind(chunks)
        delegateWasAssigned = true
      }
    },
  })

  return () => {
    active = false
    if (originalDescriptor) Object.defineProperty(chunks, 'push', originalDescriptor)
    else if (delegateWasAssigned) {
      Object.defineProperty(chunks, 'push', {
        configurable: true,
        writable: true,
        value: delegate,
      })
    }
    else Reflect.deleteProperty(chunks, 'push')
  }
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `pnpm test:run tests/unit/nmaps_webpack_module_observer.test.ts`

Expected: PASS, включая fake runtime без рекурсии.

- [ ] **Step 5: Commit**

```bash
git add lib/nmaps_webpack_module_observer.ts tests/unit/nmaps_webpack_module_observer.test.ts
git commit -m "feat(tracing): наблюдать внутренние модули НЯК"
```

---

### Task 3: Адаптер кандидата штатной трассировки

**Files:**
- Create: `lib/nmaps_native_tracing_adapter.ts`
- Create: `tests/unit/nmaps_native_tracing_adapter.test.ts`

**Interfaces:**
- Consumes: `observeWebpackModules`, `PolygonSnapTarget`, `getMap(): NativeTracingMap | null`.
- Produces: `createNativeTracingAdapter(options): NativeTracingAdapter`.
- `NativeTracingAdapter` exposes `setTarget(target)`, `getCapability(): 'pending' | 'active' | 'disabled'`, `destroy()`.

- [ ] **Step 1: Write fake native contracts and failing tests**

Fake geometry factory:

```ts
class FakePolygon {
  constructor(private coordinates: [number, number][][]) {}
  getCoordinates() { return this.coordinates }
  setCoordinates(value: [number, number][][]) { this.coordinates = value; return this }
  getType() { return 'Polygon' }
  isTypeOf(type: string) { return type === 'Polygon' }
  isEqual(other: FakePolygon) {
    return JSON.stringify(other.getCoordinates()) === JSON.stringify(this.coordinates)
  }
}

class FakeGeometryFactory {
  createPoint() {}
  createPolyline() {}
  createCollection() {}
  createPolygon(coordinates: [number, number][][]) { return new FakePolygon(coordinates) }
}

class FakeHotspot {
  attrs = { disabled: true, hotspotWidth: 10, ignoreZMax: true, simplify: false, zIndex: -1 }
  $Ig = { getObjectsInPosition: vi.fn() }
  getGeoObjectsByCoords(_coords: [number, number]) {
    return Promise.resolve([{ getId: () => 'native', getGeometry: () => new FakePolygon([[]]) }])
  }
}
```

Проверить:

1. До обнаружения обоих контрактов capability равна `pending`, provider не изменён.
2. После обнаружения `createPolygon/createPoint/createPolyline/createCollection` и `getGeoObjectsByCoords` capability равна `active`.
3. Вызов tracer-провайдера возле ребра сохраняет исходный массив и добавляет один объект `nmap-uploader:note:polygon`.
4. Вне 10 px возвращаются только исходные кандидаты.
5. Повторный вызов не дублирует цель.
6. Смена цели создаёт новую геометрию, `setTarget(null)` убирает цель.
7. Обычный hotspot без tracer-атрибутов не получает цель.
8. Некорректный результат provider переводит capability в `disabled`, восстанавливает original и логирует только префикс.
9. `destroy()` восстанавливает original prototype method.
10. Объект-кандидат заморожен и отсутствует в fake editor/save collection.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test:run tests/unit/nmaps_native_tracing_adapter.test.ts`

Expected: FAIL — адаптер отсутствует.

- [ ] **Step 3: Implement capability probes**

Использовать поведение, а не обязательные module IDs:

```ts
const isGeometryFactory = (value: unknown): value is GeometryFactoryConstructor => {
  if (typeof value !== 'function') return false
  const prototype = value.prototype as Record<string, unknown> | undefined
  return Boolean(
    prototype &&
      typeof prototype.createPoint === 'function' &&
      typeof prototype.createPolyline === 'function' &&
      typeof prototype.createPolygon === 'function' &&
      typeof prototype.createCollection === 'function',
  )
}

const isHotspotConstructor = (value: unknown): value is HotspotConstructor =>
  typeof value === 'function' &&
  typeof (value.prototype as Record<string, unknown> | undefined)?.getGeoObjectsByCoords ===
    'function'
```

Проверять все function-значения export object. Не вызывать неизвестные конструкторы до совпадения полного набора методов.

- [ ] **Step 4: Implement the transient candidate**

После обнаружения обоих контрактов создать geometry factory, сохранить original descriptor метода и поставить wrapper. Wrapper сначала вызывает original. Только после успешного массива кандидатов и совпадения tracer-атрибутов (`disabled === true`, `hotspotWidth === 10`, `ignoreZMax === true`, `simplify === false`, `zIndex === -1`) выполнить hit-test контура через projection карты.

Hit-test только решает, должен ли transient candidate попасть в результат provider; он не меняет DOM-события или координаты курсора. Проецировать cursor и сегменты через `projection.toGlobalPixels(coords, zoom)`, вычислять расстояние до сегмента, порог брать из `this.attrs.hotspotWidth`.

Кандидат:

```ts
const candidate = Object.freeze({
  getId: () => `nmap-uploader:note:${target.id}`,
  getGeometry: () => geometryFactory.createPolygon([target.coordinates]),
})
```

Перед добавлением исключить ID, уже присутствующий в исходном массиве. Массив вернуть как `[...nativeCandidates, candidate]`, не мутируя original. Не помещать candidate или geometry ни в одну коллекцию НЯК.

При исключении: восстановить original descriptor, установить capability `disabled`, вызвать:

```ts
console.debug('[nmap_uploader] native tracing unavailable')
```

- [ ] **Step 5: Run tests and verify GREEN**

Run: `pnpm test:run tests/unit/nmaps_native_tracing_adapter.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/nmaps_native_tracing_adapter.ts tests/unit/nmaps_native_tracing_adapter.test.ts
git commit -m "feat(tracing): добавить полигон заметки в штатный provider"
```

---

### Task 4: Подключение адаптера и удаление DOM snapping

**Files:**
- Modify: `entrypoints/nmaps-location-main.content.ts`
- Modify: `tests/unit/content_scripts/nmaps_location_main.content.test.ts`
- Delete: `lib/nmaps_polygon_snap_controller.ts`
- Delete: `tests/unit/nmaps_polygon_snap_controller.test.ts`
- Delete: `lib/polygon_snap.ts`
- Delete: `tests/unit/polygon_snap.test.ts`

**Interfaces:**
- Consumes: `createNativeTracingAdapter`.
- Produces: один page-lifetime adapter в `globalThis.__nmapNativeTracingAdapter__`.

- [ ] **Step 1: Replace the content-script integration test**

Удалить ожидания подменённого `MouseEvent` и синего marker. Fake webpack chunks должны зарегистрировать fake geometry factory и hotspot component, затем событие `nmaps:drawObjects` должно обновить adapter target.

```ts
it('передаёт snapTarget адаптеру штатной трассировки без DOM-перехвата', async () => {
  runMain()
  installFakeNmapsModules()

  document.dispatchEvent(new CustomEvent('nmaps:drawObjects', {
    detail: JSON.stringify({ points: [], snapTarget: polygonTarget }),
  }))

  const provider = new FakeHotspot()
  const result = await provider.getGeoObjectsByCoords([37.65, 55.7])

  expect(result.map((item) => item.getId())).toContain('nmap-uploader:note:polygon')
  expect(document.querySelector('[data-nmap-snap-marker]')).toBeNull()
})
```

Добавить тест `pagehide`: original `getGeoObjectsByCoords` восстановлен. Добавить тест `snapTarget: null`: transient ID отсутствует.

- [ ] **Step 2: Run integration test and verify RED**

Run: `pnpm test:run tests/unit/content_scripts/nmaps_location_main.content.test.ts`

Expected: FAIL — entrypoint всё ещё создаёт `createPolygonSnapController`.

- [ ] **Step 3: Replace controller initialization**

В imports и `main()` заменить старый controller:

```ts
const windowWithTracingAdapter = globalThis as typeof globalThis & {
  __nmapNativeTracingAdapter__?: NativeTracingAdapter
}
windowWithTracingAdapter.__nmapNativeTracingAdapter__?.destroy()

const tracingAdapter = createNativeTracingAdapter({
  globalObject: globalThis,
  getMap: () => (globalActiveMapInstance ?? findActiveMap()) as NativeTracingMap | null,
})
windowWithTracingAdapter.__nmapNativeTracingAdapter__ = tracingAdapter
globalThis.addEventListener('pagehide', () => tracingAdapter.destroy(), { once: true })
```

В обработчике `nmaps:drawObjects` вызвать `tracingAdapter.setTarget(detail.snapTarget)`. Остальную отрисовку заметок оставить без изменений. Удалить четыре старых файла целиком; после удаления `rg "findPolygonSnap|createPolygonSnapController|nmapSnapMarker"` не должен находить совпадений.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm test:run tests/unit/content_scripts/nmaps_location_main.content.test.ts
pnpm test:run
pnpm compile
pnpm compile:tests
pnpm lint
pnpm build
```

Expected: все команды завершаются с exit code 0; build создаёт Chrome extension.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/nmaps-location-main.content.ts tests/unit/content_scripts/nmaps_location_main.content.test.ts
git add lib/nmaps_native_tracing_adapter.ts lib/nmaps_webpack_module_observer.ts
git rm lib/nmaps_polygon_snap_controller.ts tests/unit/nmaps_polygon_snap_controller.test.ts
git rm lib/polygon_snap.ts tests/unit/polygon_snap.test.ts
git commit -m "refactor(tracing): заменить DOM snapping штатным provider"
```

---

### Task 5: Живая проверка НЯК и документация

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/verification/2026-10-09-native-tracing-note-polygon.md`

**Interfaces:**
- Produces: воспроизводимый протокол проверки версии НЯК, capability и save isolation.

- [ ] **Step 1: Document local launch and diagnostics**

В README добавить раздел: `pnpm install`, `pnpm dev`, загрузка `.output/chrome-mv3` в `browser://extensions`, выбор полигона, ручное включение «Трассировка». Указать, что единственное штатное диагностическое сообщение — `[nmap_uploader] native tracing unavailable`; координаты не логируются.

- [ ] **Step 2: Run the live acceptance scenario**

В актуальном авторизованном НЯК:

1. Выбрать полигональную заметку.
2. Начать создание «Растительность».
3. Включить штатную «Трассировка».
4. Подвести курсор к каждому из четырёх рёбер заметки и построить участки в обоих направлениях.
5. Убедиться, что жёлтая подсветка и добавляемый участок принадлежат штатному UI.
6. Выключить трассировку и убедиться, что заметка больше не влияет на рисование.
7. Сменить активную заметку, затем дату; старая цель не должна срабатывать.
8. Завершить и сохранить растительность.
9. Проверить, что служебный ID отсутствует в save request, undo/redo и истории изменений.
10. Перезагрузить страницу; transient candidate отсутствует до нового выбора заметки.

- [ ] **Step 3: Record evidence**

В verification-файле записать дату, `document.querySelector('#config')`/доступную версию НЯК, браузер, commit SHA расширения и результат каждого шага `PASS`/`FAIL`. Функция считается готовой только при десяти `PASS`; при `native tracing unavailable` записать capability mismatch и не включать обход через DOM.

- [ ] **Step 4: Re-run final verification**

Run:

```bash
pnpm test:run
pnpm compile
pnpm compile:tests
pnpm lint
pnpm build
git status --short
```

Expected: проверки успешны; в status только README и verification-файл текущего шага.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/verification/2026-10-09-native-tracing-note-polygon.md
git commit -m "docs(tracing): зафиксировать живую проверку НЯК"
```
