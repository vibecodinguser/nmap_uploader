/**
 * Переход по маршруту редактора Народной карты.
 *
 * Роутер редактора не реагирует на изменение hash извне: если поменять
 * `location.hash` (или вызвать `location.assign` с тем же документом), адрес
 * обновится, а вид останется прежним — ссылка выглядит нерабочей. Поэтому
 * после смены адреса страницу перезагружаем: полная загрузка открывает нужный
 * маршрут (`#!/objects/<id>` и его подразделы).
 *
 * Смена hash не запускает загрузку документа, так что `reload` даёт ровно одну
 * загрузку. Если адрес отличается не только hash, `assign` уже уводит на новую
 * страницу, и `reload` не выполнится.
 */
export const openNmapsRoute = (url: string): void => {
  if (typeof window === 'undefined') return
  if (window.location.href === url) return

  window.location.assign(url)
  if (typeof window.location.reload === 'function') {
    window.location.reload()
  }
}
