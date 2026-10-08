# Snapping к полигону заметки — план реализации

> **Для agentic workers:** ОБЯЗАТЕЛЬНЫЙ SUB-SKILL: используйте `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans`, выполняя задачи по одной. Шаги отслеживаются checkbox-синтаксисом (`- [ ]`).

**Цель:** Добавить в штатное рисование полигонов НЯК прилипание курсора и новых вершин к любому месту рёбер активной полигональной заметки.

**Архитектура:** `NotesTab` выбирает одну активную цель и передаёт её через существующий канал `DRAW_MAP_OBJECTS`. Чистый геометрический модуль ищет ближайшую проекцию курсора на сегменты, а контроллер в `MAIN world` переводит координаты заметки в экранные, безопасно подменяет координаты DOM-событий до их обработки редактором и отображает маркер snapping.

**Технологии:** TypeScript 5.9, React 19, WXT, Yandex Maps JS API 2.1, Vitest 4, Testing Library, happy-dom, Biome.

## Общие ограничения

- Активной целью может быть только одна заметка с `geomType: 'Polygon'`.
- Порог snapping равен 10 экранным пикселям.
- Координаты заметок хранятся в порядке `[longitude, latitude]`; API Яндекс Карт получает `[latitude, longitude]`.
- Сбой snapping не должен блокировать или отменять штатные события редактора.
- Новые runtime-зависимости не добавляются.
- Внутренняя интеграция НЯК должна быть изолирована от чистой геометрии и React-компонентов.

---

## Структура файлов

- `lib/polygon_snap.ts` — чистая экранная геометрия без DOM.
- `lib/nmaps_draw_objects.ts` — типы, валидация и формирование payload для объектов карты и цели snapping.
- `lib/nmaps_polygon_snap_controller.ts` — проекция координат, перехват событий и маркер.
- `components/NotesTab.tsx` — состояние активной заметки и отправка цели.
- `assets/styles/uploader.css` — визуальное выделение активной строки.
- `entrypoints/background.ts` — ретрансляция цели во вкладку НЯК.
- `entrypoints/panel-sidebar.content.tsx` — передача цели из isolated world в `MAIN world`.
- `entrypoints/nmaps-location-main.content.ts` — подключение контроллера к найденной карте.
- `tests/unit/polygon_snap.test.ts` — unit-тесты геометрии.
- `tests/unit/nmaps_draw_objects.test.ts` — unit-тесты payload и валидации.
- `tests/unit/nmaps_polygon_snap_controller.test.ts` — unit-тесты контроллера.
- `tests/unit/notes_tab.test.tsx` — выбор, смена и сброс активной заметки.
- `tests/unit/content_scripts/nmaps_location_main.content.test.ts` — интеграция события с контроллером.
- `README.md` — описание новой возможности.

---

### Задача 1: Чистая геометрия snapping

**Файлы:**
- Создать: `lib/polygon_snap.ts`
- Создать: `tests/unit/polygon_snap.test.ts`

**Интерфейсы:**
- Производит: `findPolygonSnap(cursor, vertices, thresholdPx): PolygonSnapResult | null`.
- Производит: типы `ScreenPoint` и `PolygonSnapResult`.
- Не использует DOM, карту или координаты широты/долготы.

- [ ] **Шаг 1: Написать падающие тесты проекции**

Создать `tests/unit/polygon_snap.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findPolygonSnap } from '@/lib/polygon_snap'

describe('findPolygonSnap', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]

  it.each([
    [{ x: 40, y: 6 }, { x: 40, y: 0 }],
    [{ x: 94, y: 40 }, { x: 100, y: 40 }],
    [{ x: 55, y: 94 }, { x: 55, y: 100 }],
    [{ x: 6, y: 60 }, { x: 0, y: 60 }],
  ])('проецирует курсор на ближайшее ребро', (cursor, expected) => {
    expect(findPolygonSnap(cursor, square, 10)?.point).toEqual(expected)
  })

  it('учитывает замыкающее ребро', () => {
    expect(findPolygonSnap({ x: 4, y: 50 }, square, 10)?.segmentIndex).toBe(3)
  })

  it('ограничивает проекцию концами сегмента', () => {
    const result = findPolygonSnap(
      { x: 104, y: -3 },
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      10,
    )
    expect(result?.point).toEqual({ x: 100, y: 0 })
  })

  it('возвращает null за пределами порога', () => {
    expect(findPolygonSnap({ x: 50, y: 11 }, square, 10)).toBeNull()
  })

  it('принимает точку точно на границе порога', () => {
    expect(findPolygonSnap({ x: 50, y: 10 }, square, 10)?.distance).toBe(10)
  })

  it('игнорирует нечисловые вершины и вырожденные сегменты', () => {
    const vertices = [
      { x: Number.NaN, y: 0 },
      { x: 20, y: 20 },
      { x: 20, y: 20 },
      { x: 80, y: 20 },
    ]
    expect(findPolygonSnap({ x: 50, y: 25 }, vertices, 10)?.point).toEqual({ x: 50, y: 20 })
  })
})
```

- [ ] **Шаг 2: Убедиться, что тест падает**

Выполнить:

```bash
pnpm vitest run tests/unit/polygon_snap.test.ts
```

Ожидание: FAIL с ошибкой разрешения `@/lib/polygon_snap`.

- [ ] **Шаг 3: Реализовать минимальный геометрический модуль**

Создать `lib/polygon_snap.ts`:

```ts
export type ScreenPoint = {
  x: number
  y: number
}

export type PolygonSnapResult = {
  point: ScreenPoint
  distance: number
  segmentIndex: number
}

const isFinitePoint = (point: ScreenPoint): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y)

const projectToSegment = (
  cursor: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint,
): ScreenPoint | null => {
  if (!isFinitePoint(start) || !isFinitePoint(end)) return null

  const dx = end.x - start.x
  const dy = end.y - start.y
  const squaredLength = dx * dx + dy * dy
  if (squaredLength === 0) return null

  const rawRatio = ((cursor.x - start.x) * dx + (cursor.y - start.y) * dy) / squaredLength
  const ratio = Math.max(0, Math.min(1, rawRatio))
  return { x: start.x + ratio * dx, y: start.y + ratio * dy }
}

export const findPolygonSnap = (
  cursor: ScreenPoint,
  vertices: ScreenPoint[],
  thresholdPx: number,
): PolygonSnapResult | null => {
  if (!isFinitePoint(cursor) || vertices.length < 2 || thresholdPx < 0) return null

  let nearest: PolygonSnapResult | null = null
  for (let index = 0; index < vertices.length; index += 1) {
    const point = projectToSegment(cursor, vertices[index], vertices[(index + 1) % vertices.length])
    if (!point) continue

    const distance = Math.hypot(cursor.x - point.x, cursor.y - point.y)
    if (distance <= thresholdPx && (!nearest || distance < nearest.distance)) {
      nearest = { point, distance, segmentIndex: index }
    }
  }
  return nearest
}
```

- [ ] **Шаг 4: Запустить тесты и проверку типов**

Выполнить:

```bash
pnpm vitest run tests/unit/polygon_snap.test.ts
pnpm compile
```

Ожидание: оба процесса завершаются с кодом 0.

- [ ] **Шаг 5: Закоммитить геометрическое ядро**

```bash
git add lib/polygon_snap.ts tests/unit/polygon_snap.test.ts
git commit -m "feat(snapping): добавить расчёт ближайшей точки полигона"
```

---

### Задача 2: Типизированный payload и выбор активной заметки

**Файлы:**
- Создать: `lib/nmaps_draw_objects.ts`
- Создать: `tests/unit/nmaps_draw_objects.test.ts`
- Изменить: `components/NotesTab.tsx`
- Изменить: `assets/styles/uploader.css`
- Изменить: `tests/unit/notes_tab.test.tsx`

**Интерфейсы:**
- Производит: `PolygonSnapTarget = { id: string; coordinates: [number, number][] }`.
- Производит: `createPolygonSnapTarget(note): PolygonSnapTarget | null`.
- Производит: `createDrawMapObjectsDetail(points, snapTarget): DrawMapObjectsDetail`.
- `NotesTab` отправляет `{ action: 'DRAW_MAP_OBJECTS', points, snapTarget }`.

- [ ] **Шаг 1: Написать падающие тесты payload**

Создать `tests/unit/nmaps_draw_objects.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createDrawMapObjectsDetail,
  createPolygonSnapTarget,
  parseDrawMapObjectsDetail,
} from '@/lib/nmaps_draw_objects'

describe('nmaps_draw_objects', () => {
  const polygon = {
    id: 'polygon-1',
    geomType: 'Polygon',
    geomCoords: [
      [37.6, 55.7],
      [37.7, 55.7],
      [37.7, 55.8],
      [37.6, 55.7],
    ] as [number, number][],
  }

  it('создаёт цель только для валидного полигона', () => {
    expect(createPolygonSnapTarget(polygon)).toEqual({
      id: 'polygon-1',
      coordinates: polygon.geomCoords,
    })
    expect(createPolygonSnapTarget({ ...polygon, geomType: 'LineString' })).toBeNull()
    expect(createPolygonSnapTarget({ ...polygon, geomCoords: [[37.6, 55.7]] })).toBeNull()
  })

  it('валидирует detail после JSON-сериализации', () => {
    const detail = createDrawMapObjectsDetail([polygon], createPolygonSnapTarget(polygon))
    expect(parseDrawMapObjectsDetail(JSON.stringify(detail))).toEqual(detail)
  })

  it('сбрасывает некорректную цель, сохраняя список объектов', () => {
    expect(
      parseDrawMapObjectsDetail({ points: [polygon], snapTarget: { id: 1, coordinates: [] } }),
    ).toEqual({ points: [polygon], snapTarget: null })
  })
})
```

- [ ] **Шаг 2: Убедиться, что тест payload падает**

```bash
pnpm vitest run tests/unit/nmaps_draw_objects.test.ts
```

Ожидание: FAIL с ошибкой разрешения нового модуля.

- [ ] **Шаг 3: Реализовать типы и валидацию payload**

В `lib/nmaps_draw_objects.ts` определить:

```ts
export type PolygonSnapTarget = {
  id: string
  coordinates: [number, number][]
}

export type MapObjectLike = {
  id?: string
  localId?: string
  geomType?: string
  geomCoords?: [number, number][]
  [key: string]: unknown
}

export type DrawMapObjectsDetail = {
  points: MapObjectLike[]
  snapTarget: PolygonSnapTarget | null
}

const isCoordinate = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1])

const countUniqueCoordinates = (coordinates: [number, number][]): number =>
  new Set(coordinates.map(([longitude, latitude]) => `${longitude}:${latitude}`)).size

export const createPolygonSnapTarget = (note: MapObjectLike): PolygonSnapTarget | null => {
  const id = note.id ?? note.localId
  const coordinates = note.geomCoords?.filter(isCoordinate)
  if (
    note.geomType !== 'Polygon' ||
    !id ||
    !coordinates ||
    countUniqueCoordinates(coordinates) < 3
  ) {
    return null
  }
  return { id, coordinates }
}

export const createDrawMapObjectsDetail = (
  points: MapObjectLike[],
  snapTarget: PolygonSnapTarget | null,
): DrawMapObjectsDetail => ({ points, snapTarget })

export const parseDrawMapObjectsDetail = (raw: unknown): DrawMapObjectsDetail | null => {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  if (!Array.isArray(record.points)) return null

  const rawTarget = record.snapTarget
  let snapTarget: PolygonSnapTarget | null = null
  if (rawTarget && typeof rawTarget === 'object') {
    const target = rawTarget as Record<string, unknown>
    const coordinates = Array.isArray(target.coordinates)
      ? target.coordinates.filter(isCoordinate)
      : []
    if (typeof target.id === 'string' && countUniqueCoordinates(coordinates) >= 3) {
      snapTarget = { id: target.id, coordinates }
    }
  }
  return { points: record.points as MapObjectLike[], snapTarget }
}
```

- [ ] **Шаг 4: Написать падающий компонентный тест выбора**

В `tests/unit/notes_tab.test.tsx` добавить `waitFor` в импорт Testing Library, импортировать `downloadIndexJson`, установить mock и helper:

```tsx
vi.mock('@/lib/yandex/client', () => ({
  downloadIndexJson: vi.fn(),
  getStoredAuth: vi.fn(() => Promise.resolve({ token: 'token' })),
  uploadIndexJson: vi.fn(),
}))

const mockedDownloadIndexJson = vi.mocked(downloadIndexJson)

const renderNotesTab = () =>
  render(
    <LocaleProvider>
      <OccupiedDatesProvider isLoggedIn={true}>
        <NotesTab
          isUploading={false}
          isLoggedIn={true}
          onRequireAuth={() => {}}
          onManualUpload={() => {}}
        />
      </OccupiedDatesProvider>
    </LocaleProvider>,
  )
```

В `beforeEach` вернуть валидную выбранную дату через существующий storage mock. Затем добавить тест:

```tsx
it('отправляет только выбранный полигон как цель snapping и сбрасывает цель на линии', async () => {
  mockedDownloadIndexJson.mockResolvedValue({
    points: {
      polygon: { coords: [37.6, 55.7], desc: 'Полигон' },
      line: { coords: [37.8, 55.8], desc: 'Линия' },
    },
    paths: {
      polygon: [
        [37.6, 55.7],
        [37.7, 55.7],
        [37.7, 55.8],
        [37.6, 55.7],
      ],
      line: [
        [37.8, 55.8],
        [37.9, 55.8],
      ],
    },
  })

  renderNotesTab()
  fireEvent.click(await screen.findByRole('button', { name: /Полигон/ }))

  await waitFor(() =>
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DRAW_MAP_OBJECTS',
        snapTarget: expect.objectContaining({ id: 'polygon' }),
      }),
    ),
  )

  fireEvent.click(screen.getByRole('button', { name: /Линия/ }))
  await waitFor(() =>
    expect(browser.runtime.sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'DRAW_MAP_OBJECTS', snapTarget: null }),
    ),
  )
})
```

Ожидание перед реализацией: FAIL, потому что сообщения не содержат `snapTarget`.

- [ ] **Шаг 5: Добавить состояние активной заметки**

В `NotesTab`:

```ts
const [activeSnapNoteId, setActiveSnapNoteId] = useState<string | null>(null)

const handleActivateSnapTarget = (note: NotePoint): void => {
  const id = note.id ?? note.localId
  setActiveSnapNoteId(note.geomType === 'Polygon' && id ? id : null)
}

const activeSnapNote = points.find((point) => {
  const id = point.id ?? point.localId
  return id === activeSnapNoteId && point.date === selectedDate
})
const snapTarget = activeSnapNote ? createPolygonSnapTarget(activeSnapNote) : null
```

Передать `isSnapTarget` и `handleActivateSnapTarget` в `NoteListItem`; обработчик строки сначала вызывает `handleActivateSnapTarget(p)`, затем существующий `toggleExpand`. Добавить `aria-pressed={isSnapTarget}` и класс `notes-list-item-btn--snap-target`. В эффекте отправки использовать один detail:

```ts
const detail = createDrawMapObjectsDetail(pts, snapTarget)
document.dispatchEvent(
  new CustomEvent('nmaps:drawObjects', { detail: JSON.stringify(detail) }),
)
browser.runtime
  .sendMessage({ action: 'DRAW_MAP_OBJECTS', ...detail })
  .catch(() => {})
```

До проверки `lastDispatchedRef` сформировать `detail`, сериализовать весь payload, а не только `points`, и сравнивать именно его:

```ts
const detail = createDrawMapObjectsDetail(pts, snapTarget)
const detailString = JSON.stringify(detail)
if (lastDispatchedRef.current === detailString) return
lastDispatchedRef.current = detailString
```

Включить `activeSnapNoteId` в зависимости эффекта. При смене `selectedDate` вызвать `setActiveSnapNoteId(null)`, а после удаления активной заметки также сбросить идентификатор.

В `assets/styles/uploader.css` добавить:

```css
.notes-list-item-btn--snap-target {
  background: color-mix(in srgb, var(--nmap-accent) 12%, transparent);
  box-shadow: inset 3px 0 0 var(--nmap-accent);
}
```

- [ ] **Шаг 6: Запустить связанные тесты**

```bash
pnpm vitest run tests/unit/nmaps_draw_objects.test.ts tests/unit/notes_tab.test.tsx
pnpm compile
```

Ожидание: все тесты проходят, TypeScript завершается с кодом 0.

- [ ] **Шаг 7: Закоммитить выбор цели**

```bash
git add lib/nmaps_draw_objects.ts tests/unit/nmaps_draw_objects.test.ts components/NotesTab.tsx assets/styles/uploader.css tests/unit/notes_tab.test.tsx
git commit -m "feat(snapping): добавить выбор активного полигона заметки"
```

---

### Задача 3: Контроллер snapping в `MAIN world`

**Файлы:**
- Создать: `lib/nmaps_polygon_snap_controller.ts`
- Создать: `tests/unit/nmaps_polygon_snap_controller.test.ts`

**Интерфейсы:**
- Потребляет: `PolygonSnapTarget` и `findPolygonSnap`.
- Производит: `createPolygonSnapController(options): PolygonSnapController`.
- Контроллер предоставляет `setTarget(target)` и `destroy()`.

- [ ] **Шаг 1: Написать падающие тесты контроллера**

Создать happy-dom тесты со стабом карты:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPolygonSnapController } from '@/lib/nmaps_polygon_snap_controller'

const target = {
  id: 'polygon',
  coordinates: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 0],
  ] as [number, number][],
}

const createMap = () => ({
  getZoom: () => 18,
  options: {
    get: () => ({
      toGlobalPixels: ([lat, lon]: [number, number]) => [lon, lat],
    }),
  },
  converter: {
    globalToPage: ([x, y]: [number, number]) => [x, y],
  },
})

describe('createPolygonSnapController', () => {
  afterEach(() => document.body.replaceChildren())

  it('подменяет координаты события возле ребра и сохраняет trusted-путь обработки', () => {
    const map = document.createElement('div')
    map.className = 'nk-map'
    document.body.appendChild(map)
    const downstream = vi.fn((event: MouseEvent) => [event.clientX, event.clientY])
    map.addEventListener('mousemove', downstream)

    const controller = createPolygonSnapController({ getMap: createMap })
    controller.setTarget(target)
    map.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 6 }))

    expect(downstream).toHaveReturnedWith([40, 0])
    expect(document.querySelector('[data-nmap-snap-marker]')).not.toBeNull()
    controller.destroy()
  })

  it('не меняет событие вне порога', () => {
    const map = document.createElement('div')
    map.className = 'nk-map'
    document.body.appendChild(map)
    const downstream = vi.fn((event: MouseEvent) => [event.clientX, event.clientY])
    map.addEventListener('mousemove', downstream)

    const controller = createPolygonSnapController({ getMap: createMap })
    controller.setTarget(target)
    map.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 20 }))

    expect(downstream).toHaveReturnedWith([40, 20])
    expect(document.querySelector('[data-nmap-snap-marker]')).toBeNull()
    controller.destroy()
  })

  it('снимает обработчики и маркер при destroy', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const controller = createPolygonSnapController({ getMap: createMap })
    controller.setTarget(target)
    controller.destroy()
    expect(removeSpy).toHaveBeenCalled()
    expect(document.querySelector('[data-nmap-snap-marker]')).toBeNull()
  })

  it('не прерывает событие, если проекция карты выбрасывает ошибку', () => {
    const map = document.createElement('div')
    map.className = 'nk-map'
    document.body.appendChild(map)
    const downstream = vi.fn()
    map.addEventListener('mousemove', downstream)
    const controller = createPolygonSnapController({
      getMap: () => {
        throw new Error('map destroyed')
      },
    })
    controller.setTarget(target)
    map.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 6 }))
    expect(downstream).toHaveBeenCalledOnce()
    controller.destroy()
  })
})
```

- [ ] **Шаг 2: Убедиться, что тесты падают**

```bash
pnpm vitest run tests/unit/nmaps_polygon_snap_controller.test.ts
```

Ожидание: FAIL с ошибкой разрешения контроллера.

- [ ] **Шаг 3: Реализовать проекцию и обработку событий**

В `lib/nmaps_polygon_snap_controller.ts` определить:

```ts
import type { PolygonSnapTarget } from '@/lib/nmaps_draw_objects'
import { findPolygonSnap, type ScreenPoint } from '@/lib/polygon_snap'

type SnapMap = {
  getZoom: () => number
  options: { get: (name: string) => { toGlobalPixels: (coords: number[], zoom: number) => number[] } }
  converter: { globalToPage: (pixels: number[]) => number[] }
}

type ControllerOptions = {
  getMap: () => SnapMap | null
  thresholdPx?: number
}

export type PolygonSnapController = {
  setTarget: (target: PolygonSnapTarget | null) => void
  destroy: () => void
}

const eventTypes = ['pointermove', 'pointerdown', 'mousedown', 'mousemove', 'click'] as const

const isMapTarget = (target: EventTarget | null): target is Element =>
  target instanceof Element && Boolean(target.closest('.nk-map, .ymaps-map, ymaps'))

const createMarker = (): HTMLDivElement => {
  const marker = document.createElement('div')
  marker.dataset.nmapSnapMarker = ''
  marker.style.cssText =
    'position:fixed;width:10px;height:10px;border:2px solid #fff;border-radius:50%;' +
    'background:#0078ff;transform:translate(-50%,-50%);pointer-events:none;' +
    'z-index:2147483646;display:none'
  document.documentElement.appendChild(marker)
  return marker
}

const coordinateOverrides = new WeakMap<MouseEvent, ScreenPoint>()

const installCoordinateGetterFallback = (): (() => void) => {
  const propertyNames = ['clientX', 'clientY', 'pageX', 'pageY'] as const
  const originalDescriptors = new Map(
    propertyNames.map((name) => [name, Object.getOwnPropertyDescriptor(MouseEvent.prototype, name)]),
  )
  propertyNames.forEach((name) => {
    const original = originalDescriptors.get(name)
    Object.defineProperty(MouseEvent.prototype, name, {
      configurable: true,
      get(this: MouseEvent) {
        const point = coordinateOverrides.get(this)
        if (point) {
          if (name === 'clientX') return point.x
          if (name === 'clientY') return point.y
          if (name === 'pageX') return point.x + window.scrollX
          return point.y + window.scrollY
        }
        return original?.get?.call(this) ?? 0
      },
    })
  })
  return () => {
    originalDescriptors.forEach((descriptor, name) => {
      if (descriptor) Object.defineProperty(MouseEvent.prototype, name, descriptor)
    })
  }
}

const overrideCoordinates = (event: MouseEvent, point: ScreenPoint): boolean => {
  try {
    Object.defineProperties(event, {
      clientX: { configurable: true, value: point.x },
      clientY: { configurable: true, value: point.y },
      pageX: { configurable: true, value: point.x + window.scrollX },
      pageY: { configurable: true, value: point.y + window.scrollY },
    })
    return true
  } catch {
    coordinateOverrides.set(event, point)
    return true
  }
}

export const createPolygonSnapController = ({
  getMap,
  thresholdPx = 10,
}: ControllerOptions): PolygonSnapController => {
  let target: PolygonSnapTarget | null = null
  const marker = createMarker()
  const restoreCoordinateGetters = installCoordinateGetterFallback()

  const hideMarker = (): void => {
    marker.style.display = 'none'
  }

  const projectTarget = (): ScreenPoint[] => {
    const map = getMap()
    if (!map || !target) return []
    const projection = map.options.get('projection')
    return target.coordinates.map(([longitude, latitude]) => {
      const globalPixels = projection.toGlobalPixels([latitude, longitude], map.getZoom())
      const [x, y] = map.converter.globalToPage(globalPixels)
      return { x, y }
    })
  }

  const handlePointerEvent = (event: Event): void => {
    if (!(event instanceof MouseEvent) || !target || !isMapTarget(event.target)) {
      hideMarker()
      return
    }
    try {
      const snap = findPolygonSnap(
        { x: event.clientX, y: event.clientY },
        projectTarget(),
        thresholdPx,
      )
      if (!snap) {
        hideMarker()
        return
      }
      marker.style.left = `${snap.point.x}px`
      marker.style.top = `${snap.point.y}px`
      marker.style.display = 'block'
      overrideCoordinates(event, snap.point)
    } catch (error) {
      hideMarker()
      console.debug('[nmap_uploader] polygon snapping unavailable:', error)
    }
  }

  eventTypes.forEach((type) => document.addEventListener(type, handlePointerEvent, true))

  return {
    setTarget(nextTarget) {
      target = nextTarget
      if (!target) hideMarker()
    },
    destroy() {
      eventTypes.forEach((type) => document.removeEventListener(type, handlePointerEvent, true))
      restoreCoordinateGetters()
      marker.remove()
      target = null
    },
  }
}
```

Fallback через временно переопределённые getter-ы `MouseEvent.prototype` применяется только к событиям из `coordinateOverrides` и восстанавливает исходные descriptors в `destroy()`. Поэтому downstream-обработчики получают скорректированные координаты, даже если браузер запрещает собственные свойства у экземпляра события. Не вызывать `preventDefault`, `stopPropagation` или `stopImmediatePropagation`.

- [ ] **Шаг 4: Запустить тесты контроллера и геометрии**

```bash
pnpm vitest run tests/unit/polygon_snap.test.ts tests/unit/nmaps_polygon_snap_controller.test.ts
pnpm compile
```

Ожидание: тесты и компиляция проходят.

- [ ] **Шаг 5: Закоммитить контроллер**

```bash
git add lib/nmaps_polygon_snap_controller.ts tests/unit/nmaps_polygon_snap_controller.test.ts
git commit -m "feat(snapping): добавить контроллер прилипания на карте"
```

---

### Задача 4: Провести цель через расширение и подключить контроллер

**Файлы:**
- Изменить: `entrypoints/background.ts`
- Изменить: `entrypoints/panel-sidebar.content.tsx`
- Изменить: `entrypoints/nmaps-location-main.content.ts`
- Изменить: `tests/unit/content_scripts/nmaps_location_main.content.test.ts`

**Интерфейсы:**
- Потребляет: `parseDrawMapObjectsDetail` и `createPolygonSnapController`.
- Сохраняет существующую отрисовку всех `points`.
- Передаёт `snapTarget` без изменений через background и isolated content script.

- [ ] **Шаг 1: Написать падающий интеграционный тест**

Дополнить `tests/unit/content_scripts/nmaps_location_main.content.test.ts` helper-функциями:

```ts
const createMapInstance = () => ({
  getCenter: () => [55.7, 37.6] as [number, number],
  getZoom: () => 18,
  events: { add: vi.fn(), remove: vi.fn() },
  options: {
    get: () => ({
      toGlobalPixels: ([lat, lon]: [number, number]) => [lon, lat],
    }),
  },
  converter: {
    globalToPage: ([x, y]: [number, number]) => [x, y],
  },
})

const installMapElement = (mapInstance: ReturnType<typeof createMapInstance>): HTMLElement => {
  const mapElement = document.createElement('div')
  mapElement.className = 'nk-map ymaps-map'
  ;(mapElement as unknown as Record<string, unknown>).__ymaps_map = mapInstance
  document.body.appendChild(mapElement)
  return mapElement
}
```

Затем добавить тест:

```ts
it('активирует snapping только для цели из события отрисовки', () => {
  const mapInstance = createMapInstance()
  installMapElement(mapInstance)
  runMain()
  vi.runAllTimers()

  const detail = {
    points: [],
    snapTarget: {
      id: 'polygon',
      coordinates: [
        [37.6, 55.7],
        [37.7, 55.7],
        [37.6, 55.7],
      ],
    },
  }
  document.dispatchEvent(
    new CustomEvent('nmaps:drawObjects', { detail: JSON.stringify(detail) }),
  )

  expect(document.querySelector('[data-nmap-snap-marker]')).not.toBeNull()
  document.dispatchEvent(
    new CustomEvent('nmaps:drawObjects', {
      detail: JSON.stringify({ points: [], snapTarget: null }),
    }),
  )
  document.querySelector('.nk-map')?.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 1 }),
  )
  expect(
    (document.querySelector('[data-nmap-snap-marker]') as HTMLElement).style.display,
  ).toBe('none')
})
```

Ожидание: FAIL, потому что `nmaps-location-main.content.ts` ещё не создаёт контроллер.

- [ ] **Шаг 2: Расширить ретрансляцию background и isolated content script**

В `handleDrawMapObjects` файла `entrypoints/background.ts`:

```ts
const relayMessage = {
  action: 'DRAW_MAP_OBJECTS',
  points: message.points,
  snapTarget: message.snapTarget ?? null,
}
```

В ветке `DRAW_MAP_OBJECTS` файла `entrypoints/panel-sidebar.content.tsx`:

```ts
document.dispatchEvent(
  new CustomEvent('nmaps:drawObjects', {
    detail: JSON.stringify({
      points: message.points,
      snapTarget: message.snapTarget ?? null,
    }),
  }),
)
```

- [ ] **Шаг 3: Подключить контроллер в `MAIN world`**

В `entrypoints/nmaps-location-main.content.ts` импортировать parser и controller. Создать контроллер один раз внутри `main()`:

```ts
const snapController = createPolygonSnapController({
  getMap: () => {
    const map = globalActiveMapInstance ?? findActiveMap()
    return map as any
  },
})
```

В обработчике `nmaps:drawObjects` заменить ручной JSON parsing:

```ts
const detail = parseDrawMapObjectsDetail((event as CustomEvent).detail)
if (!detail) return

snapController.setTarget(detail.snapTarget)
const { points } = detail
```

Оставить существующее создание `GeoObjectCollection`, полигонов, линий и меток без функциональных изменений. До раннего выхода из-за отсутствия `ymaps` или карты уже вызвать `snapController.setTarget(detail.snapTarget)`, чтобы цель не терялась до завершения поиска карты.

На `pagehide` один раз вызвать `snapController.destroy()`. Повторный запуск защищать ключом на `window`, чтобы HMR или повторная инъекция не устанавливали второй набор обработчиков:

```ts
const SNAP_CONTROLLER_KEY = '__nmapPolygonSnapController__'
const windowRecord = window as typeof window & {
  __nmapPolygonSnapController__?: PolygonSnapController
}
windowRecord[SNAP_CONTROLLER_KEY]?.destroy()
windowRecord[SNAP_CONTROLLER_KEY] = snapController
window.addEventListener('pagehide', () => snapController.destroy(), { once: true })
```

- [ ] **Шаг 4: Запустить интеграционные и фоновые тесты**

```bash
pnpm vitest run tests/unit/content_scripts/nmaps_location_main.content.test.ts tests/integration
pnpm compile
pnpm compile:tests
```

Ожидание: все команды завершаются с кодом 0.

- [ ] **Шаг 5: Закоммитить сквозную интеграцию**

```bash
git add entrypoints/background.ts entrypoints/panel-sidebar.content.tsx entrypoints/nmaps-location-main.content.ts tests/unit/content_scripts/nmaps_location_main.content.test.ts
git commit -m "feat(snapping): подключить полигон заметки к редактору"
```

---

### Задача 5: Общая проверка и документация

**Файлы:**
- Изменить: `README.md`

**Интерфейсы:**
- Не создаёт новых программных интерфейсов.
- Проверяет весь пользовательский поток и регрессии.

- [ ] **Шаг 1: Добавить возможность в README**

В список «Возможности» добавить:

```md
- **Snapping** — при рисовании объектов в редакторе контур прилипает к рёбрам выбранного полигона из Блокнота;
```

- [ ] **Шаг 2: Выполнить полный автоматический прогон**

```bash
pnpm test:run
pnpm compile
pnpm compile:tests
pnpm lint
pnpm lint:css
pnpm build
```

Ожидание: каждая команда завершается с кодом 0; тесты не содержат skipped/failing случаев, production-сборка создаётся в `.output`.

- [ ] **Шаг 3: Провести ручную проверку в актуальном НЯК**

Запустить `pnpm dev`, загрузить development-сборку и проверить по порядку:

1. Выбрать дату с полигональной заметкой.
2. Нажать строку полигона и убедиться в её визуальном выделении.
3. Начать штатное рисование нового полигона НЯК.
4. Подвести курсор к середине каждого ребра ближе чем на 10 px: появляется маркер, контур и вершина попадают на ребро.
5. Повторить возле концов сегментов и замыкающего ребра.
6. Отвести курсор дальше 10 px: маркер исчезает, координаты не корректируются.
7. Изменить масштаб и положение карты: snapping остаётся совмещённым с полигоном заметки.
8. Выбрать линию или точку: snapping отключается.
9. Выбрать другой полигон: snapping работает только с новой целью.
10. Удалить активную заметку и сменить дату: маркер и snapping исчезают.
11. Завершить и отменить рисование: штатные действия редактора работают без задержек и ошибок.

- [ ] **Шаг 4: Закоммитить документацию**

```bash
git add README.md
git commit -m "docs: описать snapping к полигону заметки"
```
