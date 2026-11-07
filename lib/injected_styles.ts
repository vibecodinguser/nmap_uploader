/**
 * Единая точка вставки CSS в страницу Народной карты.
 *
 * Каждый модуль раньше сам создавал `<style>`, обновлял текст и удалял
 * элемент, и эти реализации расходились: где-то стиль не обновлялся при
 * повторном вызове, где-то не удалялся при выгрузке расширения. Здесь одно
 * поведение для всех: создать, при изменении текста — обновить, по запросу —
 * удалить.
 *
 * Стили всегда живут в `<style id="nmap-...">` с префиксом расширения,
 * чтобы не пересекаться с элементами хоста (см. ADR 0001).
 */
export const ensureInjectedStyle = (id: string, css: string): void => {
  if (typeof document === 'undefined') {
    return
  }

  const existing = document.getElementById(id)
  if (existing) {
    if (existing.textContent !== css) {
      existing.textContent = css
    }
    return
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  ;(document.head ?? document.documentElement).appendChild(style)
}

/** Удаляет ранее вставленный стиль; безопасен при повторном вызове. */
export const removeInjectedStyle = (id: string): void => {
  if (typeof document === 'undefined') {
    return
  }
  document.getElementById(id)?.remove()
}
