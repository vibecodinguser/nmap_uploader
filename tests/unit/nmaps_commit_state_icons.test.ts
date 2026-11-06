import { describe, expect, it } from 'vitest'
import {
  COMMIT_STATE_ICONS,
  MODERATOR_ICON,
  resolveCommitStateIcon,
} from '@/lib/nmaps_commit_state_icons'

describe('nmaps: иконки состояний коммита', () => {
  it('содержит SVG для всех четырёх состояний', () => {
    for (const icon of Object.values(COMMIT_STATE_ICONS)) {
      expect(icon.svgMarkup.startsWith('<svg')).toBe(true)
      expect(icon.svgMarkup).toContain('viewBox="0 0 22 22"')
    }
  })

  it('использует классы редактора в правильном порядке', () => {
    expect(COMMIT_STATE_ICONS.published.className).toBe(
      'nk-icon nk-icon_id_commit-published nk-icon_align_auto nk-commit-state-view nk-event-view__commit-state',
    )
  })

  it('содержит SVG для иконки модератора', () => {
    expect(MODERATOR_ICON.className).toContain('nk-icon_id_moderator')
    expect(MODERATOR_ICON.svgMarkup.startsWith('<svg')).toBe(true)
  })

  it('сопоставляет статус модерации с иконкой', () => {
    expect(resolveCommitStateIcon('published')).toBe('published')
    expect(resolveCommitStateIcon('approved')).toBe('green')
    expect(resolveCommitStateIcon('green')).toBe('green')
    expect(resolveCommitStateIcon('pending')).toBe('yellow')
    expect(resolveCommitStateIcon('rejected')).toBe('red')
    expect(resolveCommitStateIcon('red')).toBe('red')
  })

  it('по умолчанию показывает жёлтую иконку', () => {
    expect(resolveCommitStateIcon('')).toBe('yellow')
    expect(resolveCommitStateIcon('что-то новое')).toBe('yellow')
  })
})
