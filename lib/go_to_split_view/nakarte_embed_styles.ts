import hideControlsCss from './nakarte_hide_controls.css?inline'

/**
 * Маркер встроенного режима на корневом `html` Nakarte.
 *
 * Стили листа поднимаются только под ним, поэтому тот же nakarte, открытый
 * отдельной вкладкой, не получает ни одного правила.
 */
export const NAKARTE_EMBED_CLASS = 'yamapper-nakarte-embed'

/** id элемента `<style>`: по нему стиль снимается при выгрузке расширения. */
export const NAKARTE_HIDE_CONTROLS_STYLE_ID = 'yamapper-nakarte-hide-controls'

export const NAKARTE_HIDE_CONTROLS_STYLES = hideControlsCss
