import 'vitest'
import type { AxeMatchers } from 'vitest-axe/matchers'

declare module 'vitest' {
  // noinspection JSUnusedGlobalSymbols
  interface Matchers extends AxeMatchers {}
}
