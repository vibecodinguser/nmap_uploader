import { describe, expect, it } from 'vitest'
import { shouldRemountGoToToolbar } from '@/lib/go_to_toolbar'

describe('shouldRemountGoToToolbar', () => {
  const mountedCorrectly = {
    goToCount: 1,
    splitCount: 1,
    isGoToMountedCorrectly: true,
    isSplitSiblingCorrect: true,
  }

  it('не пересоздаёт корректно смонтированную пару кнопок', () => {
    expect(shouldRemountGoToToolbar(mountedCorrectly)).toBe(false)
  })

  it('пересоздаёт кнопки при дубликатах go-to', () => {
    expect(
      shouldRemountGoToToolbar({
        ...mountedCorrectly,
        goToCount: 2,
      }),
    ).toBe(true)
  })

  it('пересоздаёт кнопки при дубликатах split-view', () => {
    expect(
      shouldRemountGoToToolbar({
        ...mountedCorrectly,
        splitCount: 2,
      }),
    ).toBe(true)
  })

  it('пересоздаёт кнопки при неверной позиции go-to', () => {
    expect(
      shouldRemountGoToToolbar({
        ...mountedCorrectly,
        isGoToMountedCorrectly: false,
      }),
    ).toBe(true)
  })

  it('пересоздаёт кнопки, если split-view не следует сразу за go-to', () => {
    expect(
      shouldRemountGoToToolbar({
        ...mountedCorrectly,
        isSplitSiblingCorrect: false,
      }),
    ).toBe(true)
  })
})
