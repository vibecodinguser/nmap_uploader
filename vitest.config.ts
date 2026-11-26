import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  /*
   * Vitest, в отличие от WXT, не читает `.env`. Smoke-тест берёт токен из
   * окружения, поэтому здесь подгружается только `YANDEX_TEST_TOKEN`.
   */
  const token = loadEnv(mode, import.meta.dirname, '').YANDEX_TEST_TOKEN?.trim()
  const liveEnv = token ? { YANDEX_TEST_TOKEN: token } : {}

  return {
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname),
      },
    },
    test: {
      /*
       * Два проекта, потому что у них разное окружение:
       *
       * * `unit` — всё, кроме smoke: MSW перехватывает сеть, браузерные API
       *   подменены фикстурой. Сюда же попадают integration и a11y.
       * * `smoke` — только `tests/smoke`: сетап с MSW намеренно не
       *   подключается, запросы идут в настоящий API Яндекса. Без токена
       *   тест помечается пропущенным, а не зелёным.
       *
       * `pnpm check` и `pnpm test:run` гоняют только `unit`: обычная проверка
       * не должна зависеть от сети и чужого аккаунта.
       */
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
            exclude: ['tests/smoke/**', '**/node_modules/**'],
            setupFiles: ['./tests/setup/vitest.setup.ts'],
            // Инжектируемые стили импортируются как `?inline`; без обработки
            // CSS Vitest подменяет их пустой строкой, и тесты стилей теряют
            // смысл. Паттерн не привязан к концу id: у `?inline`-импортов
            // есть query.
            css: { include: [/\.css(\?|$)/] },
            environment: 'node',
            testTimeout: 15_000,
            /*
             * happy-dom 21 по умолчанию не создаёт окно у iframe с внешним
             * `src`: `contentWindow` равен `null`, а в консоль летит ошибка
             * «Iframe page loading is disabled». Для тестов это плохо вдвойне —
             * код общается с фреймом через `contentWindow.postMessage`, и с
             * `null` любая проверка «сообщение не отправлено» проходит, даже
             * если логика сломана.
             *
             * `enableIframePageLoading` возвращает окно, а
             * `disableChildFrameNavigation` не даёт ему ходить в сеть: адрес
             * фрейма просто выставляется. Получается то же, что в браузере, —
             * кросс-доменное окно, у которого доступен только `postMessage`.
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
        },
        {
          extends: true,
          test: {
            name: 'smoke',
            include: ['tests/smoke/**/*.test.ts'],
            environment: 'node',
            env: liveEnv,
            // Живой API отвечает медленнее мока: даём запас на сеть и 429-паузы.
            testTimeout: 30_000,
          },
        },
      ],
    },
  }
})
