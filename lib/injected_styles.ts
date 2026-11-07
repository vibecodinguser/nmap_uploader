import tokensCss from './injected_tokens.css?inline'

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
export const INJECTED_TOKENS_ID = 'nmap-injected-tokens'

/** Токен-лист как есть — нужен тестам, чтобы сверять объявленные переменные. */
export const INJECTED_TOKENS_CSS = tokensCss

/**
 * Общий слой токенов (`--nmap-*`). Инжектируется один раз на страницу и
 * идемпотентно, поэтому листы могут ссылаться на переменные, не объявляя их
 * у себя и не дублируя значения.
 */
export const ensureInjectedTokens = (): void => {
  ensureInjectedStyle(INJECTED_TOKENS_ID, tokensCss)
}

export const ensureInjectedStyle = (id: string, css: string): void => {
  if (typeof document === 'undefined') {
    return
  }

  // Токены нужны любому листу, поэтому подключаются здесь, а не в каждом
  // вызывающем модуле: забыть их невозможно.
  if (id !== INJECTED_TOKENS_ID) {
    ensureInjectedTokens()
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
