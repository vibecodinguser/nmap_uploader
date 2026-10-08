# Автоматическая трассировка по всем полигонам даты — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать ручной выбор цели и автоматически подключать к штатной трассировке все валидные полигоны выбранной даты.

**Architecture:** Панель формирует массив `snapTargets` из заметок уже выбранной даты и передаёт его через существующий relay в MAIN world. Нативный адаптер хранит read-only candidate для каждой цели, но при каждом запросе provider добавляет только ближайший к курсору полигон. Исходные координаты не изменяются и не попадают в модель сохранения НЯК.

**Tech Stack:** TypeScript 5.9, React 19, WXT 0.20 MAIN-world content scripts, Vitest 4, Testing Library, happy-dom, Biome.

## Global Constraints

- Автоматические цели — только полигоны выбранной даты.
- Пользователь самостоятельно включает штатную кнопку «Трассировка».
- Точки, линии и некорректные полигоны не участвуют.
- При равном расстоянии выбирается первая цель в порядке payload.
- В provider добавляется не более одного transient candidate.
- Координаты имеют порядок `[longitude, latitude]` и не получают промежуточных вершин.
- Служебный ID имеет вид `nmap-uploader:note:<id>`.
- Transient candidate не регистрируется в editor state, undo/redo или save payload.
- Ошибка capability probe восстанавливает оригинальный provider.

---

### Task 1: Массив целей в контракте drawObjects

**Files:**
- Modify: `lib/nmaps_draw_objects.ts`
- Modify: `tests/unit/nmaps_draw_objects.test.ts`

**Interfaces:**
- Produces: `createPolygonSnapTargets(points: MapObjectLike[]): PolygonSnapTarget[]`.
- Changes: `DrawMapObjectsDetail.snapTargets: PolygonSnapTarget[]`.
- Changes: `createDrawMapObjectsDetail(points, snapTargets)` and `parseDrawMapObjectsDetail(raw)`.

- [ ] **Step 1: Write failing tests for array construction**

Добавить два валидных полигона, линию и некорректный полигон. Проверить порядок, замыкание и независимый пропуск ошибок:

```ts
it('создаёт цели для всех валидных полигонов в порядке заметок', () => {
  expect(createPolygonSnapTargets([
    polygon,
    { id: 'line', geomType: 'LineString', geomCoords: [[0, 0], [1, 1]] },
    {
      id: 'polygon-2',
      geomType: 'Polygon',
      geomCoords: [[38, 56], [39, 56], [39, 57]],
    },
    { id: 'invalid', geomType: 'Polygon', geomCoords: [[0, 0]] },
  ])).toEqual([
    { id: 'polygon-1', coordinates: polygon.geomCoords },
    {
      id: 'polygon-2',
      coordinates: [[38, 56], [39, 56], [39, 57], [38, 56]],
    },
  ])
})
```

Добавить parse-тест:

```ts
expect(parseDrawMapObjectsDetail({
  points: [],
  snapTargets: [
    { id: 'one', coordinates: [[0, 0], [1, 0], [1, 1]] },
    { id: 2, coordinates: [] },
  ],
})).toEqual({
  points: [],
  snapTargets: [{ id: 'one', coordinates: [[0, 0], [1, 0], [1, 1], [0, 0]] }],
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test:run tests/unit/nmaps_draw_objects.test.ts`

Expected: FAIL — `createPolygonSnapTargets` отсутствует и detail содержит `snapTarget`.

- [ ] **Step 3: Implement the array contract**

```ts
export type DrawMapObjectsDetail = {
  points: MapObjectLike[]
  snapTargets: PolygonSnapTarget[]
}

export const createPolygonSnapTargets = (points: MapObjectLike[]): PolygonSnapTarget[] =>
  points.reduce<PolygonSnapTarget[]>((targets, point) => {
    const target = createPolygonSnapTarget(point)
    if (target) targets.push(target)
    return targets
  }, [])

export const createDrawMapObjectsDetail = (
  points: MapObjectLike[],
  snapTargets: PolygonSnapTarget[],
): DrawMapObjectsDetail => ({ points, snapTargets })
```

В parser использовать:

```ts
const rawTargets = Array.isArray(record.snapTargets) ? record.snapTargets : []
const snapTargets = rawTargets.reduce<PolygonSnapTarget[]>((targets, rawTarget) => {
  if (!rawTarget || typeof rawTarget !== 'object') return targets
  const target = rawTarget as Record<string, unknown>
  const coordinates = normalizePolygonCoordinates(target.coordinates)
  if (typeof target.id === 'string' && coordinates) {
    targets.push({ id: target.id, coordinates })
  }
  return targets
}, [])
```

Возвращать `{ points, snapTargets }`; одиночное поле полностью удалить.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `pnpm test:run tests/unit/nmaps_draw_objects.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nmaps_draw_objects.ts tests/unit/nmaps_draw_objects.test.ts
git commit -m "refactor(tracing): передавать массив полигонов"
```

---

### Task 2: Выбор ближайшей цели в native tracing adapter

**Files:**
- Modify: `lib/nmaps_native_tracing_adapter.ts`
- Modify: `tests/unit/nmaps_native_tracing_adapter.test.ts`

**Interfaces:**
- Changes: `NativeTracingAdapter.setTargets(targets: PolygonSnapTarget[]): void`.
- Internal: `targets: TracingTarget[]`, where each entry owns copied payload coordinates, native geometry and frozen candidate.

- [ ] **Step 1: Write failing multi-target tests**

Заменить вызовы `setTarget` на `setTargets`. Добавить две непересекающиеся цели:

```ts
adapter.setTargets([
  target,
  {
    id: 'near-second',
    coordinates: [[200, 0], [300, 0], [300, 100], [200, 0]],
  },
])

const result = await new FakeHotspot().getGeoObjectsByCoords([240, 6])
expect(result.map((item) => item.getId())).toEqual([
  'native',
  'nmap-uploader:note:near-second',
])
```

Добавить проверки:

```ts
it('при пересечении выбирает ближайшую цель, а при равенстве первую', async () => {
  // Первая граница на y=0, вторая на y=8; cursor y=4 даёт равенство.
  // Ожидается ID первой цели и ровно один transient candidate.
})

it('setTargets заменяет весь набор и пустой массив очищает его', async () => {
  adapter.setTargets([target])
  adapter.setTargets([])
  expect(await new FakeHotspot().getGeoObjectsByCoords([40, 6])).toEqual([nativeCandidate])
})

it('не изменяет вершины ни одной цели после повторных mousemove', async () => {
  // Вызвать provider у разных рёбер и сравнить getCoordinates() с payload.
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test:run tests/unit/nmaps_native_tracing_adapter.test.ts`

Expected: FAIL — `setTargets` отсутствует.

- [ ] **Step 3: Implement per-target candidates**

Ввести:

```ts
type TracingTarget = {
  payload: PolygonSnapTarget
  geometry: NativeGeometry
  candidate: NativeCandidate
}

let targets: TracingTarget[] = []
```

Заменить `refreshCandidate` на:

```ts
const refreshTargets = (nextTargets: PolygonSnapTarget[]): void => {
  targets = []
  if (!geometryFactoryConstructor || capability === 'disabled') return

  const geometryFactory = new geometryFactoryConstructor()
  for (const nextTarget of nextTargets) {
    try {
      const payload = {
        id: nextTarget.id,
        coordinates: nextTarget.coordinates.map(
          ([longitude, latitude]) => [longitude, latitude] as Coordinate,
        ),
      }
      const geometry = geometryFactory.createPolygon([payload.coordinates])
      if (
        geometry.getType() !== 'Polygon' ||
        !geometry.isTypeOf('Polygon') ||
        !Array.isArray(geometry.getCoordinates())
      ) continue

      const id = `nmap-uploader:note:${payload.id}`
      const candidate = Object.freeze({
        getId: () => id,
        getGeometry: () => geometry,
      })
      targets.push({ payload, geometry, candidate })
    } catch {
      continue
    }
  }
}
```

Хранить также `pendingTargets: PolygonSnapTarget[]`, чтобы цели, полученные до capability activation, создавались в `activate()`.

- [ ] **Step 4: Implement nearest selection without geometry mutation**

В provider wrapper:

```ts
const map = getMap()
if (!map || targets.length === 0 || !isTracerHotspot(this)) return nativeCandidates

let nearest: { target: TracingTarget; distance: number } | null = null
for (const tracingTarget of targets) {
  const snap = findTargetSnap(
    coordinates,
    tracingTarget.payload.coordinates,
    map,
    this.attrs?.hotspotWidth as number,
  )
  if (snap && (!nearest || snap.distance < nearest.distance)) {
    nearest = { target: tracingTarget, distance: snap.distance }
  }
}
if (!nearest) return nativeCandidates
if (nativeCandidates.some((item) => item.getId() === nearest.target.candidate.getId())) {
  return nativeCandidates
}
return [...nativeCandidates, nearest.target.candidate]
```

Сравнение строго `<` сохраняет первую цель при равном расстоянии. Не вызывать `setCoordinates`, `splice` или создание проекции курсора.

Публичный метод:

```ts
setTargets(nextTargets) {
  pendingTargets = nextTargets.map((target) => ({
    id: target.id,
    coordinates: target.coordinates.map(
      ([longitude, latitude]) => [longitude, latitude] as Coordinate,
    ),
  }))
  refreshTargets(pendingTargets)
}
```

`disable()` и `destroy()` очищают `targets` и `pendingTargets`.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
pnpm test:run tests/unit/nmaps_native_tracing_adapter.test.ts
pnpm compile
pnpm compile:tests
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/nmaps_native_tracing_adapter.ts tests/unit/nmaps_native_tracing_adapter.test.ts
git commit -m "feat(tracing): выбирать ближайший полигон даты"
```

---

### Task 3: Автоматические цели в NotesTab и relay

**Files:**
- Modify: `components/NotesTab.tsx`
- Modify: `assets/styles/uploader.css`
- Modify: `entrypoints/background.ts`
- Modify: `entrypoints/panel-sidebar.content.tsx`
- Modify: `entrypoints/nmaps-location-main.content.ts`
- Modify: `tests/unit/notes_tab.test.tsx`
- Modify: `tests/unit/content_scripts/nmaps_location_main.content.test.ts`

**Interfaces:**
- Consumes: `createPolygonSnapTargets(pts)` and `tracingAdapter.setTargets(detail.snapTargets)`.
- Relay message field: `snapTargets`.

- [ ] **Step 1: Write the failing NotesTab test**

Заменить тест ручного выбора:

```ts
it('автоматически отправляет все полигоны выбранной даты без ручного выбора', async () => {
  // index содержит polygon-one, polygon-two и line.
  renderNotesTab()

  await waitFor(() =>
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DRAW_MAP_OBJECTS',
        snapTargets: [
          expect.objectContaining({ id: 'polygon-one' }),
          expect.objectContaining({ id: 'polygon-two' }),
        ],
      }),
    ),
  )

  expect(screen.queryByRole('button', { pressed: false })).toBeNull()
})
```

Добавить смену даты и ожидать новый массив без старых ID.

- [ ] **Step 2: Write the failing MAIN-world integration test**

В событии `nmaps:drawObjects` передать:

```ts
snapTargets: [
  { id: 'left', coordinates: [[0, 0], [100, 0], [100, 100], [0, 0]] },
  { id: 'right', coordinates: [[200, 0], [300, 0], [300, 100], [200, 0]] },
]
```

Проверить, что provider возле `[240, 6]` возвращает `nmap-uploader:note:right`; после `snapTargets: []` возвращает только штатные кандидаты.

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
pnpm test:run tests/unit/notes_tab.test.tsx
pnpm test:run tests/unit/content_scripts/nmaps_location_main.content.test.ts
```

Expected: FAIL — UI и relay используют `snapTarget`.

- [ ] **Step 4: Remove manual selection UI**

В `NotesTab.tsx`:

- удалить `activeSnapNoteId`, `activateSnapTarget` и effect сброса по дате;
- удалить `isSnapTarget` и `activateSnapTarget` из `NoteListItemProps`, `NoteItemContent`, `NoteListItemView`;
- обработчик строки заменить на `onClick={() => toggleExpand(expandId)}`;
- удалить `aria-pressed` и условный CSS-класс;
- удалить сброс active ID из `handleDeleteNote`;
- в списке передавать только `isExpanded`.

Удалить из CSS:

```css
.notes-list-item-btn--snap-target {
  /* весь существующий блок */
}
```

- [ ] **Step 5: Produce all current-date targets**

Imports:

```ts
import {
  createDrawMapObjectsDetail,
  createPolygonSnapTargets,
} from '@/lib/nmaps_draw_objects'
```

В dispatch effect:

```ts
const pts = points.filter((point) => point.date === selectedDate)
const detail = createDrawMapObjectsDetail(pts, createPolygonSnapTargets(pts))
```

Dependencies: `[points, selectedDate, isInitialized]`.

- [ ] **Step 6: Rename the relay field end to end**

В `entrypoints/background.ts`:

```ts
const relayMessage = {
  action: 'DRAW_MAP_OBJECTS',
  points: message.points,
  snapTargets: message.snapTargets ?? [],
}
```

В `entrypoints/panel-sidebar.content.tsx` dispatch detail:

```ts
snapTargets: message.snapTargets ?? [],
```

В MAIN world:

```ts
tracingAdapter.setTargets(detail.snapTargets)
```

Удалить все runtime-упоминания `snapTarget`. После изменения:

Run: `rg --pcre2 "snapTarget(?!s)" --glob '*.{ts,tsx}'`  
Expected: no matches.

- [ ] **Step 7: Run tests and verify GREEN**

Run:

```bash
pnpm test:run tests/unit/notes_tab.test.tsx
pnpm test:run tests/unit/content_scripts/nmaps_location_main.content.test.ts
pnpm test:run
pnpm compile
pnpm compile:tests
pnpm exec biome check components/NotesTab.tsx assets/styles/uploader.css entrypoints/background.ts entrypoints/panel-sidebar.content.tsx entrypoints/nmaps-location-main.content.ts lib/nmaps_draw_objects.ts lib/nmaps_native_tracing_adapter.ts
```

Expected: all tests and type checks pass; Biome has no new errors.

- [ ] **Step 8: Commit**

```bash
git add components/NotesTab.tsx assets/styles/uploader.css
git add entrypoints/background.ts entrypoints/panel-sidebar.content.tsx entrypoints/nmaps-location-main.content.ts
git add tests/unit/notes_tab.test.tsx tests/unit/content_scripts/nmaps_location_main.content.test.ts
git commit -m "feat(tracing): включить все полигоны выбранной даты"
```

---

### Task 4: Полная и живая проверка

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/verification/2026-10-09-all-note-polygons-native-tracing.md`

**Interfaces:**
- Produces: подтверждение автоматической трассировки двух полигонов без выбора.

- [ ] **Step 1: Update user documentation**

В README заменить инструкцию «выбрать полигон» на:

```markdown
Все валидные полигоны выбранной даты автоматически доступны трассировке. Начните создание полигонального объекта и отдельно включите штатную кнопку «Трассировка»; выбирать отдельную заметку не нужно.
```

- [ ] **Step 2: Run full automated verification**

Run:

```bash
pnpm test:run
pnpm compile
pnpm compile:tests
pnpm lint
pnpm build
git diff --check
```

Expected: exit code 0 для каждой команды; lint может вывести только существующие warnings.

- [ ] **Step 3: Run live acceptance**

Запустить `pnpm dev`, открыть дату с двумя полигонами и без кликов по строкам:

1. Включить создание растительности и штатную «Трассировка».
2. Навести на первый полигон — появляется штатная подсветка и строится его граница.
3. Навести на второй полигон — подсветка и трассировка переключаются на него.
4. В зоне пересечения выбирается ближайшая граница.
5. В результате остаются только исходные вершины.
6. Сменить дату — старые полигоны перестают участвовать.

- [ ] **Step 4: Record evidence**

В verification-файле записать commit SHA, версию НЯК, браузер и отдельный `PASS`/`FAIL` для шести шагов. Не отмечать функцию готовой при любом `FAIL`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git add -f docs/superpowers/verification/2026-10-09-all-note-polygons-native-tracing.md
git commit -m "docs(tracing): подтвердить автоматические цели даты"
```
