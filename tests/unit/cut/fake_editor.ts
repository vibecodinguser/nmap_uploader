/**
 * Редактор топологии НЯК в миниатюре.
 *
 * Повторяет то, на что опирается инструмент разреза (редактор 3.548.0):
 * активность с контрактом `start` / `onStart` / `onViewAttrsRequest` / `stop` /
 * `isStarted`, коллекция элементов для представления, связь контура с частями
 * и менеджер команд, через который идёт любая правка и её отмена.
 */
import { vi } from 'vitest'

export const RING: number[][] = [
  [41.42, 44.84],
  [41.421, 44.84],
  [41.421, 44.841],
  [41.42, 44.841],
  [41.42, 44.84],
]

export const OPEN_LINE: number[][] = [
  [41.42, 44.84],
  [41.421, 44.84],
  [41.422, 44.84],
  [41.423, 44.84],
]

export type FakeElement = {
  id: string
  coordinates: number[][]
}

export type FakeActivityParams = {
  categoryId?: string
  elementCategoryId?: string
  elementRoleId?: string
  elements?: FakeElement[]
  /** Редактор без обработчика правки: инструмент не должен включаться. */
  withoutChangeHandler?: boolean
  /** Редактор, у которого не нашлось менеджера команд. */
  withoutCommandManager?: boolean
  /** Фабрика объектов падает: вторую часть создать нельзя. */
  brokenFactory?: boolean
}

type Command = { apply: () => void; undo: () => void; redo: () => void }

class FakeGeometry {
  constructor(private coordinates: number[][]) {}

  getType(): string {
    return 'LineString'
  }

  getCoordinates(): number[][] {
    return this.coordinates
  }

  setCoordinates(coordinates: number[][]): this {
    this.coordinates = coordinates
    return this
  }

  isClosed(): boolean {
    const first = this.coordinates[0]
    const last = this.coordinates[this.coordinates.length - 1]
    return first[0] === last[0] && first[1] === last[1]
  }
}

class FakeGeoObject {
  constructor(
    private readonly id: string,
    private readonly categoryId: string,
    private readonly geometry: FakeGeometry,
  ) {}

  getId(): string {
    return this.id
  }

  getCategoryId(): string {
    return this.categoryId
  }

  getGeometry(): FakeGeometry {
    return this.geometry
  }
}

/** Коллекция объектов редактора: не принимает второй объект с тем же id. */
class FakeCollection {
  private items: FakeGeoObject[] = []

  constructor(private readonly onAdd?: (item: FakeGeoObject) => void) {}

  get(): FakeGeoObject[] {
    return this.items
  }

  findById(id: string): FakeGeoObject | undefined {
    return this.items.find((item) => item.getId() === id)
  }

  add(item: FakeGeoObject): this {
    if (this.findById(item.getId())) return this
    this.items.push(item)
    this.onAdd?.(item)
    return this
  }

  remove(item: FakeGeoObject): this {
    this.items = this.items.filter((candidate) => candidate !== item)
    return this
  }
}

/** Связь «контур → части»: запоминает добавленные части для сохранения. */
class FakeRelation {
  private readonly added = new FakeCollection()

  addGeoObject(item: FakeGeoObject): void {
    this.added.add(item)
  }

  removeGeoObject(item: FakeGeoObject): void {
    this.added.remove(item)
  }

  getAddedGeoObjects(): FakeCollection {
    return this.added
  }
}

/** Менеджер команд редактора: история с отменой и повтором. */
export class FakeCommandManager {
  private history: Command[] = []
  private position = 0

  apply(command: Command): void {
    this.history.splice(this.position, this.history.length - this.position, command)
    this.position += 1
    command.apply()
  }

  canUndo(): boolean {
    return this.position > 0
  }

  undo(): void {
    if (!this.canUndo()) return
    this.position -= 1
    this.history[this.position].undo()
  }

  canRedo(): boolean {
    return this.position < this.history.length
  }

  redo(): void {
    if (!this.canRedo()) return
    this.history[this.position].redo()
    this.position += 1
  }
}

/**
 * Карта-заглушка с разметкой как у `ymaps.Map`.
 *
 * Все клики по карте, линиям и вершинам браузер отдаёт одному элементу —
 * панели событий; меню вершины и элементы управления лежат в контейнере рядом
 * с ней. Событие `click` самой карты на линиях не срабатывает, поэтому его у
 * заглушки нет вовсе.
 *
 * Проекция: градусы в «пиксели» с шагом 1e6; страница совпадает с картой.
 */
const createFakeMap = () => {
  const container = document.createElement('div')
  const surface = document.createElement('ymaps')
  surface.className = 'ymaps-2-1-79-events-pane ymaps-2-1-79-user-selection-none'
  const vertexMenu = document.createElement('ymaps')
  vertexMenu.className = 'ymaps-2-1-79-islets_editor-vertex-menu'
  container.append(surface, vertexMenu)
  document.body.appendChild(container)

  const map = {
    getZoom: () => 16,
    options: {
      get: (name: string) =>
        name === 'projection'
          ? { toGlobalPixels: (coords: number[]) => [coords[0] * 1e6, coords[1] * 1e6] }
          : undefined,
    },
    container: { getElement: () => container },
    converter: { pageToGlobal: (page: number[]) => [page[0], page[1]] },
  }
  return { map, surface, vertexMenu }
}

export const createFakeActivity = ({
  categoryId = 'vegetation_fc',
  elementCategoryId = 'vegetation_el',
  elementRoleId = 'part',
  elements = [{ id: 'el-1', coordinates: OPEN_LINE }],
  withoutChangeHandler = false,
  withoutCommandManager = false,
  brokenFactory = false,
}: FakeActivityParams = {}) => {
  const { map, surface, vertexMenu } = createFakeMap()

  const commands = new FakeCommandManager()
  const relation = new FakeRelation()

  // Как в редакторе: за геометрией каждой добавленной части начинают следить
  // ограничения (лимит вершин), а снимать слежку при удалении он не умеет.
  const watched = new Set<FakeGeometry>()
  const collection = new FakeCollection((item) => watched.add(item.getGeometry()))
  const geometryRestrictionsManager = {
    stopWatching: (geometry: FakeGeometry) => {
      watched.delete(geometry)
    },
  }

  const addElement = (element: FakeElement): void => {
    collection.add(
      new FakeGeoObject(element.id, elementCategoryId, new FakeGeometry(element.coordinates)),
    )
  }
  elements.forEach(addElement)

  // Как в редакторе: правка координат — команда в менеджере, а не прямая запись.
  const onChangeElementCoords = vi.fn((element: FakeGeoObject, coordinates: number[][]) => {
    const geometry = element.getGeometry()
    const previous = geometry.getCoordinates()
    commands.apply({
      apply: () => {
        geometry.setCoordinates(coordinates)
      },
      undo: () => {
        geometry.setCoordinates(previous)
      },
      redo: () => {
        geometry.setCoordinates(coordinates)
      },
    })
  })

  const geoObject = {
    getCategoryId: () => categoryId,
    getId: () => 'contour-1',
    getSlavesByRole: (role: string) => (role === elementRoleId ? relation : null),
  }

  let createdCount = 0
  const geoObjectFactory = {
    createGeoObject: (params: { categoryId: string; geometry: FakeGeometry }) => {
      if (brokenFactory) throw new Error('factory is broken')
      createdCount += 1
      return new FakeGeoObject(`new-${createdCount}`, params.categoryId, params.geometry)
    },
  }

  const geometryFactory = {
    createPolyline: (coordinates: number[][]) => new FakeGeometry(coordinates),
  }

  const viewAttrs = {
    map,
    geoObject,
    elementRoleId,
    elementCategoryId,
    elements: collection,
    geoObjectFactory,
    geometryFactory,
    geometryRestrictionsManager,
    onChangeElementCoords: withoutChangeHandler ? undefined : onChangeElementCoords,
  }

  class FakeActivity {
    public params = { geoObject, elementRoleId }
    public started = false
    /** Имя поля в бандле минифицировано: инструмент не должен на него опираться. */
    public $KN = withoutCommandManager ? null : commands

    start() {
      this.started = true
      return this
    }

    onStart() {
      return true
    }

    stop() {
      this.started = false
      return this
    }

    onStop() {}

    isStarted() {
      return this.started
    }

    onViewAttrsRequest() {
      return viewAttrs
    }
  }

  return {
    activity: new FakeActivity(),
    commands,
    onChangeElementCoords,
    addElement,
    /** Что видит пользователь: части контура и их координаты. */
    drawnParts: (): Record<string, number[][]> =>
      Object.fromEntries(
        collection.get().map((item) => [item.getId(), item.getGeometry().getCoordinates()]),
      ),
    /** Что уйдёт на сервер как новые части контура. */
    partsToCreate: (): Array<{ id: string; categoryId: string }> =>
      relation
        .getAddedGeoObjects()
        .get()
        .map((item) => ({ id: item.getId(), categoryId: item.getCategoryId() })),
    /** За сколькими геометриями редактор следит на предмет ограничений. */
    watchedGeometries: (): number => watched.size,
    map,
    /** Элемент, которому браузер отдаёт клики по карте, линиям и вершинам. */
    mapSurface: surface,
    /** Меню вершины: лежит поверх карты, но картой не является. */
    vertexMenu,
  }
}
