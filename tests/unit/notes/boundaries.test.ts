/**
 * Границы слоёв заметок.
 *
 * Структура каталогов — не документация, а правило: без теста домен снова
 * начнёт тянуть Диск и `wxt/browser`, как это было, когда `lib/notes/index.ts`
 * реэкспортировал хранилище и слой карты подключал весь инфраструктурный граф
 * в MAIN-мир.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../../..')
const NOTES = join(ROOT, 'lib/notes')
const LAYER = join(ROOT, 'lib/notes_layer')

const sourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path))
      continue
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(path)
  }
  return files
}

const STARS_WITH_MULTILINE = /from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

const importsOf = (file: string): string[] => {
  const source = readFileSync(file, 'utf8')
  const specifiers: string[] = []
  for (const match of source.matchAll(STARS_WITH_MULTILINE)) {
    const specifier = match[1] ?? match[2]
    if (specifier) specifiers.push(specifier)
  }
  return specifiers
}

const isInside = (file: string, directory: string): boolean => {
  const path = relative(directory, file)
  return path !== '' && !path.startsWith('..') && !isAbsolute(path)
}

const externalOf = (file: string): string[] =>
  importsOf(file).filter((specifier) => !specifier.startsWith('.'))

/** Импорт ведёт внутрь `directory` — с учётом абсолютного алиаса `@/`. */
const targets = (file: string, specifier: string): string | null => {
  if (specifier.startsWith('@/')) return join(ROOT, specifier.slice(2))
  if (specifier.startsWith('.')) return resolve(file, '..', specifier)
  return null
}

const offendersOf = (directory: string, isForbidden: (specifier: string) => boolean): string[] =>
  sourceFiles(directory).flatMap((file) =>
    importsOf(file)
      .filter((specifier) => isForbidden(specifier))
      .map((specifier) => `${relative(ROOT, file)} → ${specifier}`),
  )

describe('границы заметок', () => {
  const model = join(NOTES, 'model')

  it('модель не знает про хранилище, React, карту и браузер', () => {
    const forbidden = [
      /^wxt(\/|$)/,
      /^react(-dom)?(\/|$)/,
      /^ymaps/,
      /^@\/lib\/yandex(\/|$)/,
      /^@\/lib\/nmaps(\/|$)/,
      /^@\/lib\/notes(\/|$)/,
      /^@\/components(\/|$)/,
      /^@\/hooks(\/|$)/,
      /^@\/entrypoints(\/|$)/,
    ]

    const offenders = sourceFiles(model).flatMap((file) =>
      importsOf(file)
        .filter((specifier) => forbidden.some((pattern) => pattern.test(specifier)))
        .map((specifier) => `${relative(ROOT, file)} → ${specifier}`),
    )

    expect(offenders).toEqual([])
  })

  it('модель импортирует извне только чистые утилиты', () => {
    const allowed = [/^@\/lib\/date_format$/]

    const offenders = sourceFiles(model)
      .flatMap((file) => externalOf(file).map((specifier) => ({ file, specifier })))
      .filter(({ specifier }) => !allowed.some((pattern) => pattern.test(specifier)))
      .map(({ file, specifier }) => `${relative(ROOT, file)} → ${specifier}`)

    expect(offenders).toEqual([])
  })

  it('протокол зависит только от модели', () => {
    const protocol = join(NOTES, 'protocol.ts')
    const offenders = importsOf(protocol)
      .filter((specifier) => {
        const target = targets(protocol, specifier)
        return !target || !isInside(target, model)
      })
      .map((specifier) => `lib/notes/protocol.ts → ${specifier}`)

    expect(offenders).toEqual([])
  })

  it('фасад отдаёт только модель и протокол', () => {
    const facade = join(NOTES, 'index.ts')
    expect(importsOf(facade).sort()).toEqual(['./model', './protocol'])
  })

  it('хранилище не тянет UI и слой карты', () => {
    const offenders = offendersOf(join(NOTES, 'storage'), (specifier) =>
      /^@\/(components|hooks|entrypoints)\//.test(specifier),
    )
    expect(offenders).toEqual([])
  })

  it('слой карты не тянет Диск и браузерное хранилище', () => {
    const forbidden = [/^wxt(\/|$)/, /^@\/lib\/yandex(\/|$)/, /^@\/lib\/notes\/storage(\/|$)/]
    expect(
      offendersOf(LAYER, (specifier) => forbidden.some((pattern) => pattern.test(specifier))),
    ).toEqual([])
  })
})
