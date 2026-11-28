import {
  NOTES_PERMISSION_CLICKED_MESSAGE,
  NOTES_PERMISSION_DENIED_MESSAGE,
  NOTES_PERMISSION_GRANTED_MESSAGE,
  NOTES_PERMISSION_HOVER_MESSAGE,
  NOTES_PERMISSION_READY_MESSAGE,
} from '@/lib/notes_permission/protocol'
import { requestYandexAccess } from '@/lib/yandex/disk_settings'

/**
 * Прозрачная страница над кнопкой заметок.
 *
 * Она существует ради одного: получить жест пользователя там, где его можно
 * потратить на `permissions.request`. Клик приходит сюда, а не в кнопку
 * тулбара, поэтому диалог браузера открывается сразу по нажатию кнопки
 * заметок (ADR 0022, поправка).
 *
 * Ответ уходит в content script через `postMessage` родительского окна:
 * страница расширения не может сама открыть панель или подсветить кнопку.
 */

const TARGET_ID = 'notes-permission-target'

const postToParent = (action: string, payload: Record<string, unknown> = {}): void => {
  window.parent.postMessage({ action, ...payload }, '*')
}

// Первое, что делает страница: говорит контент-скрипту, что она жива. Без
// этого сообщения невидимый оверлей считался бы битым и был бы снят.
postToParent(NOTES_PERMISSION_READY_MESSAGE)

const target = document.createElement('button')
target.type = 'button'
target.id = TARGET_ID
// Оверлей не должен попадать в порядок табуляции: нативная кнопка остаётся
// единственным элементом управления, доступным с клавиатуры.
target.tabIndex = -1
target.setAttribute('aria-hidden', 'true')
document.body.appendChild(target)

target.addEventListener('mouseenter', () => {
  postToParent(NOTES_PERMISSION_HOVER_MESSAGE, { hovered: true })
})

target.addEventListener('mouseleave', () => {
  postToParent(NOTES_PERMISSION_HOVER_MESSAGE, { hovered: false })
})

target.addEventListener('click', () => {
  // Отметка о клике уходит сразу: выдача разрешений приходит в контент-скрипт
  // двумя путями (это сообщение и рассылка фона), и панель должна открыться
  // ровно тогда, когда её открыл пользователь, а не при выдаче из настроек.
  postToParent(NOTES_PERMISSION_CLICKED_MESSAGE)
  void (async () => {
    // `requestYandexAccess` сначала проверяет выдачу и просит разрешения,
    // только если их нет. Запрос идёт прямо в обработчике клика: вне жеста
    // браузер отклоняет `permissions.request` без диалога.
    const granted = await requestYandexAccess()
    postToParent(granted ? NOTES_PERMISSION_GRANTED_MESSAGE : NOTES_PERMISSION_DENIED_MESSAGE)
  })()
})
