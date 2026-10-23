// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { getCommitStateStatus, getEventCardStatus } from '@/lib/feeds_filter/card_status_detector'

describe('feeds_filter card_status_detector', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  describe('getCommitStateStatus', () => {
    it('определяет статус "red" для class="nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-commit-state-view_not-last nk-event-view__commit-state"', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-commit-state-view_not-last nk-event-view__commit-state"></span>
      `

      expect(getCommitStateStatus(card)).toBe('red')
      expect(getEventCardStatus(card)).toBe('red')
    })

    it('определяет статус "published" для иконки commit-published', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-published nk-commit-state-view nk-event-view__commit-state"></span>
      `

      expect(getCommitStateStatus(card)).toBe('published')
      expect(getEventCardStatus(card)).toBe('published')
    })

    it('определяет статус "green" для иконки commit-accepted / commit-approved', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-accepted nk-commit-state-view nk-event-view__commit-state"></span>
      `

      expect(getCommitStateStatus(card)).toBe('green')
      expect(getEventCardStatus(card)).toBe('green')
    })

    it('определяет статус "yellow" для иконки commit-pending / commit-moderation', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-pending nk-commit-state-view nk-event-view__commit-state"></span>
      `

      expect(getCommitStateStatus(card)).toBe('yellow')
      expect(getEventCardStatus(card)).toBe('yellow')
    })

    it('определяет статус по вложенной иконке внутри nk-event-view__commit-state', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <div class="nk-commit-state-view nk-event-view__commit-state">
          <span class="nk-icon nk-icon_id_commit-rejected"></span>
        </div>
      `

      expect(getCommitStateStatus(card)).toBe('red')
    })

    it('определяет статус по title или aria-label элемента состояния', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-commit-state-view nk-event-view__commit-state" title="Отклонено модератором"></span>
      `

      expect(getCommitStateStatus(card)).toBe('red')
    })

    it('возвращает null, если элемент состояния коммита отсутствует', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      expect(getCommitStateStatus(card)).toBeNull()
    })
  })

  describe('getEventCardStatus', () => {
    it('отдает приоритет состоянию коммита над текстом бейджа при их наличии', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-icon nk-icon_id_commit-rejected nk-icon_align_auto nk-commit-state-view nk-commit-state-view_not-last nk-event-view__commit-state"></span>
        <span class="nk-badge nk-badge_color_green nk-event-view__badge">Принята</span>
      `

      // Состояние коммита имеет высший приоритет
      expect(getEventCardStatus(card)).toBe('red')
    })

    it('определяет статус "green" по классу nk-badge_color_green', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML =
        '<span class="nk-badge nk-badge_color_green nk-event-view__badge">Принята</span>'

      expect(getEventCardStatus(card)).toBe('green')
    })

    it('определяет статус "yellow" по классу nk-badge_color_yellow', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML =
        '<span class="nk-badge nk-badge_color_yellow nk-event-view__badge">На проверке</span>'

      expect(getEventCardStatus(card)).toBe('yellow')
    })

    it('определяет статус "red" по классу nk-badge_color_red', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML =
        '<span class="nk-badge nk-badge_color_red nk-event-view__badge">Отклонена</span>'

      expect(getEventCardStatus(card)).toBe('red')
    })

    it('определяет статус по тексту бейджа при отсутствии цветового класса', () => {
      const cardGreen = document.createElement('div')
      cardGreen.innerHTML = '<span class="nk-badge nk-event-view__badge">Одобрено</span>'
      expect(getEventCardStatus(cardGreen)).toBe('green')

      const cardYellow = document.createElement('div')
      cardYellow.innerHTML = '<span class="nk-badge nk-event-view__badge">Ожидает модерации</span>'
      expect(getEventCardStatus(cardYellow)).toBe('yellow')

      const cardRed = document.createElement('div')
      cardRed.innerHTML = '<span class="nk-badge nk-event-view__badge">Отклонено модератором</span>'
      expect(getEventCardStatus(cardRed)).toBe('red')
    })

    it('возвращает "other", если бейдж отсутствует или статус неизвестен', () => {
      const cardWithoutBadge = document.createElement('div')
      expect(getEventCardStatus(cardWithoutBadge)).toBe('other')

      const cardUnknown = document.createElement('div')
      cardUnknown.innerHTML = '<span class="nk-badge nk-event-view__badge">Неизвестно</span>'
      expect(getEventCardStatus(cardUnknown)).toBe('other')
    })
  })
})
