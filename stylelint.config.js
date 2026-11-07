/* jshint esversion: 11, module: true */
/** @type {import('stylelint').Config} */
// noinspection JSUnusedGlobalSymbols
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/.output/**', '**/.wxt/**', '**/node_modules/**'],
  rules: {
    'import-notation': 'string',

    // BEM: block-name, block-name__element, block-name--modifier
    'selector-class-pattern': [
      '^([a-z][a-z0-9]*(-[a-z0-9]+)*)(__([a-z][a-z0-9]*(-[a-z0-9]+)*))?(--([a-z][a-z0-9]*(-[a-z0-9]+)*))?$',
      {
        message: 'Ожидается kebab-case или BEM (block__element, block--modifier)',
      },
    ],

    // id полей форм: point_latitude, multipoint_date
    'selector-id-pattern': '^[a-z][a-z0-9_]*$',

    // Design tokens — полные hex/rgba для читаемости палитры
    'color-hex-length': null,
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'alpha-value-notation': null,

    // Safari: префикс для backdrop-filter
    'property-no-vendor-prefix': [
      true,
      {
        ignoreProperties: ['-webkit-backdrop-filter'],
      },
    ],

    // font-family: системные имена с заглавными буквами
    'value-keyword-case': [
      'lower',
      {
        ignoreKeywords: [
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Inter',
          'Arial',
          'Helvetica',
          'sans-serif',
          'system-ui',
        ],
      },
    ],

    // Специфичность: дублирует biome, типичный паттерн для UI-компонентов
    'no-descending-specificity': null,

    'keyframes-name-pattern': [
      '^[a-z][a-zA-Z0-9]*$',
      {
        message: 'Имя @keyframes — camelCase или kebab-case',
      },
    ],

    'declaration-empty-line-before': null,
    'rule-empty-line-before': null,

    // word-break: break-word — fallback для старых движков
    'declaration-property-value-keyword-no-deprecated': null,

    'media-feature-range-notation': 'context',
  },
  overrides: [
    {
      // CSS, который content scripts инжектируют в страницу Народной карты.
      // Отличия от assets/styles: id и классы с префиксом расширения,
      // модификаторы через `_` (как у нативных `nk-*`) и хостовые классы,
      // которые переименовать нельзя.
      files: ['lib/**/*.css'],
      rules: {
        'selector-id-pattern': [
          '^nmap-[a-z0-9-]+$',
          {
            message: 'id инжектируемых стилей — nmap-<kebab-case>',
          },
        ],
        'selector-class-pattern': [
          '^[a-z][a-z0-9]*([_-]{1,2}[a-z0-9]+)*$',
          {
            message: 'Ожидается kebab-case или BEM; модификаторы нативных nk-* — через `_`',
          },
        ],
        'keyframes-name-pattern': [
          '^[a-z][a-zA-Z0-9-]*$',
          {
            message: 'Имя @keyframes — camelCase или kebab-case',
          },
        ],
        // Переменные хоста (`--control_theme_islands--*`, `--tabs-bar__*`)
        // переименовать нельзя, а читать и переопределять их приходится.
        'custom-property-pattern': null,
        // Защита от стилей хоста: longhand после shorthand оставлен намеренно,
        // чтобы правило переживало чужие `background`/`flex` выше по каскаду.
        'declaration-block-no-redundant-longhand-properties': null,
      },
    },
  ],
}
