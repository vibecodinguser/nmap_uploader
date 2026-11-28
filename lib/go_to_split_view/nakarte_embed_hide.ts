import { ensureInjectedStyle, removeInjectedStyle } from '@/lib/injected_styles'
import {
  NAKARTE_EMBED_CLASS,
  NAKARTE_HIDE_CONTROLS_STYLE_ID,
  NAKARTE_HIDE_CONTROLS_STYLES,
} from './nakarte_embed_styles'

/*
 * Скрытие контролов Nakarte в раздельном экране.
 *
 * Работает только внутри iframe: nakarte — кросс-доменный, и единственный
 * канал до его DOM — content script на `nakarte.me`. Родителю (`n.maps`)
 * стили не нужны, поэтому здесь всё локально для кадра.
 */

/** Ждёт появления корневого элемента, если скрипт пришёл раньше него. */
let pendingApply: (() => void) | null = null

const clearPendingApply = (): void => {
  if (!pendingApply) return
  document.removeEventListener('DOMContentLoaded', pendingApply)
  pendingApply = null
}

/**
 * Включает скрытие: маркер на `html` и лист стилей. Идемпотентно — повторный
 * вызов не плодит ни классов, ни `<style>`.
 */
export const enableNakarteControlsHiding = (): void => {
  if (typeof document === 'undefined') return

  ensureInjectedStyle(NAKARTE_HIDE_CONTROLS_STYLE_ID, NAKARTE_HIDE_CONTROLS_STYLES, {
    // Лист читает только классы Nakarte, `--nmap-*` ему не нужны: иначе на
    // странице оставался бы токен-слой без владельца.
    withTokens: false,
  })

  const root = document.documentElement
  if (root) {
    root.classList.add(NAKARTE_EMBED_CLASS)
    return
  }

  // На `document_start` корневой элемент уже создан, но если скрипт успел
  // раньше — дожидаемся разбора документа вместо исключения.
  pendingApply = () => {
    pendingApply = null
    document.documentElement?.classList.add(NAKARTE_EMBED_CLASS)
  }
  document.addEventListener('DOMContentLoaded', pendingApply, { once: true })
}

/** Снимает и маркер, и лист. Безопасен при повторном вызове и без включения. */
export const disableNakarteControlsHiding = (): void => {
  if (typeof document === 'undefined') return

  clearPendingApply()
  document.documentElement?.classList.remove(NAKARTE_EMBED_CLASS)
  removeInjectedStyle(NAKARTE_HIDE_CONTROLS_STYLE_ID)
}
