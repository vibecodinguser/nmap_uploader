/** @type {import('stylelint').Config} */
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
}
