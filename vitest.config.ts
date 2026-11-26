import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  /*
   * Vitest, в отличие от WXT, не читает `.env`. Smoke-тест берёт токен из
   * окружения и без него молча пропускается, поэтому здесь подгружается
   * только `YANDEX_TEST_TOKEN` — остальные переменные тестам не нужны.
   */
  const token = loadEnv(mode, import.meta.dirname, '').YANDEX_TEST_TOKEN
  return {
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname),
      },
    },
    test: {
      env: token ? { YANDEX_TEST_TOKEN: token } : {},
      // Инжектируемые стили импортируются как `?inline`; без обработки CSS
      // Vitest подменяет их пустой строкой, и тесты стилей теряют смысл.
      // Паттерн не привязан к концу id: у `?inline`-импортов есть query.
      css: { include: [/\.css(\?|$)/] },
      environment: 'node',
      setupFiles: ['./tests/setup/vitest.setup.ts'],
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      testTimeout: 15_000,
      /*
       * happy-dom 21 по умолчанию не создаёт окно у iframe с внешним `src`:
       * `contentWindow` равен `null`, а в консоль летит ошибка «Iframe page
       * loading is disabled». Для тестов это плохо вдвойне — код общается с
       * фреймом через `contentWindow.postMessage`, и с `null` любая проверка
       * «сообщение не отправлено» проходит, даже если логика сломана.
       *
       * `enableIframePageLoading` возвращает окно, а `disableChildFrameNavigation`
       * не даёт ему ходить в сеть: адрес фрейма просто выставляется. Получается
       * то же, что в браузере, — кросс-доменное окно, у которого доступен только
       * `postMessage`.
       */
      environmentOptions: {
        happyDOM: {
          settings: {
            enableIframePageLoading: true,
            navigation: { disableChildFrameNavigation: true },
          },
        },
      },
    },
  }
})
