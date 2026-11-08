/**
 * Приоритет источников подсчёта вершин.
 *
 * Число вершин должно появляться только там, где оно осмысленно:
 * - при редактировании полигона или линии — по модели редактора (`multipart_editor.ts`);
 * - при рисовании новой геометрии — по canvas (резиновая нить).
 *
 * Простое перемещение карты перерисовывает контуры объекта теми же «редакторными» цветами,
 * поэтому canvas-подсчёт разрешён только когда редактор действительно что-то рисует.
 */

let modelCounterActive = false
let counterSuppressed = false
let editorHooksReady = false

const editingEditors = new Set<object>()
const drawingEditors = new Set<object>()

/** Помечает, что счётчик сейчас ведёт модель редактора. */
export const setModelCounterActive = (active: boolean): void => {
  modelCounterActive = active
}

/** Возвращает true, пока число вершин считает модель редактора. */
export const isModelCounterActive = (): boolean => modelCounterActive

/** Помечает, что счётчик нужно скрыть полностью (объект из отрезков, точка и т.п.). */
export const setCounterSuppressed = (suppressed: boolean): void => {
  counterSuppressed = suppressed
}

/** Возвращает true, когда счётчик скрыт по решению модели редактора. */
export const isCounterSuppressed = (): boolean => counterSuppressed

/** Отмечает, что перехват редакторов геометрии установлен. */
export const setEditorHooksReady = (ready: boolean): void => {
  editorHooksReady = ready
  if (!ready) {
    editingEditors.clear()
    drawingEditors.clear()
  }
}

/** Учитывает редактор, который сейчас в режиме редактирования. */
export const markGeometryEditorEditing = (editor: object, editing: boolean): void => {
  if (editing) {
    editingEditors.add(editor)
    return
  }
  editingEditors.delete(editor)
  drawingEditors.delete(editor)
}

/** Учитывает редактор, который сейчас активно рисует геометрию. */
export const markGeometryEditorDrawing = (editor: object, drawing: boolean): void => {
  if (drawing) {
    drawingEditors.add(editor)
    return
  }
  drawingEditors.delete(editor)
}

/** Возвращает true, если хотя бы один редактор геометрии сейчас активен. */
export const isAnyGeometryEditorEditing = (): boolean => editingEditors.size > 0

/** Возвращает true, если хотя бы один редактор сейчас рисует геометрию. */
export const isAnyGeometryEditorDrawing = (): boolean => drawingEditors.size > 0

/**
 * Разрешён ли подсчёт по canvas/SVG.
 *
 * Пока перехват редакторов не установлен, оставляем прежнее поведение. После установки
 * считаем только во время активного рисования: перерисовка карты при панорамировании
 * не должна давать число.
 */
export const isCanvasCounterAllowed = (): boolean => !editorHooksReady || drawingEditors.size > 0

/**
 * Возвращает true, когда внешние источники не должны показывать своё значение:
 * считает модель, счётчик скрыт, либо никто ничего не рисует.
 */
export const isExternalCounterDisabled = (): boolean =>
  modelCounterActive || counterSuppressed || !isCanvasCounterAllowed()

/** Сбрасывает состояние (используется в тестах и при выгрузке расширения). */
export const resetCounterSource = (): void => {
  modelCounterActive = false
  counterSuppressed = false
  editorHooksReady = false
  editingEditors.clear()
  drawingEditors.clear()
}
