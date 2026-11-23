import { defineConfig } from 'vitepress'

// Сайт справки. Хостится на GitHub Pages как project page:
// https://<user>.github.io/yamapper/ — отсюда base.
export default defineConfig({
  lang: 'ru-RU',
  title: 'Yamapper',
  description: 'Загрузчик геоданных в Блокнот картографа Народной карты — справка',
  base: '/yamapper/',

  // Доки — только на русском; English-темы не заводим.
  cleanUrls: true,
  lastUpdated: true,

  // В корне репозитория esbuild 0.28 (override против Dependabot), а esbuild
  // не умеет понижать деструктуризацию `const { a } = useData()` до
  // витроессовского build.target. VitePress собирает статический сайт и
  // нативные ESM-браузеры деструктуризацию поддержмвают, поэтому target —
  // esnext. На сборку расширения это не влияет: там свой wxt.config.ts.
  vite: {
    esbuild: { target: 'esnext' },
    build: { target: 'esnext' },
  },

  head: [
    ['link', { rel: 'icon', href: '/yamapper/favicon.png' }],
    ['meta', { name: 'theme-color', content: '#1b1b20' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Справка', link: '/guide/' },
      { text: 'Разработчикам', link: '/dev/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Начало работы',
          items: [
            { text: 'Установка', link: '/guide/' },
            { text: 'Первая загрузка', link: '/guide/first-upload' },
          ],
        },
        {
          text: 'Форматы и геометрии',
          items: [
            { text: 'Поддерживаемые форматы', link: '/guide/formats' },
            { text: 'Геометрии и конвертация', link: '/guide/geometries' },
          ],
        },
        {
          text: 'Возможности',
          items: [
            { text: 'Заметки', link: '/guide/notes' },
            { text: 'Раздельный вид', link: '/guide/split-view' },
            { text: 'НСПД', link: '/guide/nspd' },
          ],
        },
      ],
      '/dev/': [
        {
          text: 'Разработчикам',
          items: [
            { text: 'Обзор', link: '/dev/' },
            { text: 'Сборка и проверки', link: '/dev/build' },
            { text: 'Архитектура', link: '/dev/architecture' },
          ],
        },
      ],
    },

    outline: { level: [2, 3], label: 'Содержание' },

    docFooter: { prev: 'Назад', next: 'Вперёд' },

    lastUpdated: {
      text: 'Обновлено',
      formatOptions: { dateStyle: 'long', timeStyle: 'short' },
    },

    darkModeSwitchLabel: 'Тема',
    returnToTopLabel: 'Наверх',
    sidebarMenuLabel: 'Меню',

    // Локальный поиск вместо Algolia DocSearch: нет зависимости от внешнего
    // сервиса и от @docsearch-пакетов с несовместимым peer-диапазоном React.
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск' },
          modal: {
            noResultsText: 'Ничего не найдено для',
            resetButtonTitle: 'Сбросить',
            footer: {
              selectText: 'выбрать',
              navigateText: 'перейти',
              closeText: 'закрыть',
            },
          },
        },
      },
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/vibecodinguser/yamapper' }],

    footer: {
      message: 'Справка по расширению Yamapper',
      copyright: 'Блокнот картографа Народной карты',
    },
  },
})
