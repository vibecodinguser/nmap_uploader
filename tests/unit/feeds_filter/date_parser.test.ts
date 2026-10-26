// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import {
  getEventCardDateText,
  getEventCardDayAge,
  getLastCardWithDate,
  getLastCardWithDayAge,
  getTargetThresholdMs,
  parseEventCardDate,
  parseEventDateString,
} from '@/lib/user_feeds_filter'

describe('feeds_filter date parsing and threshold', () => {
  describe('parseEventDateString', () => {
    const fixedNow = new Date('2026-10-15T15:30:00.000Z').getTime()

    it('корректно парсит "только что"', () => {
      const parsed = parseEventDateString('только что', fixedNow)
      expect(parsed?.getTime()).toBe(fixedNow)
    })

    it('корректно парсит относительное время (минуты, часы, дни)', () => {
      const parsedMin = parseEventDateString('15 минут назад', fixedNow)
      expect(parsedMin?.getTime()).toBe(fixedNow - 15 * 60 * 1000)

      const parsedHours = parseEventDateString('3 часа назад', fixedNow)
      expect(parsedHours?.getTime()).toBe(fixedNow - 3 * 3600 * 1000)

      const parsedDays = parseEventDateString('2 дня назад', fixedNow)
      expect(parsedDays?.getTime()).toBe(fixedNow - 2 * 86400 * 1000)
    })

    it('корректно парсит "сегодня в 14:20"', () => {
      const parsed = parseEventDateString('сегодня в 14:20', fixedNow)
      expect(parsed).not.toBeNull()
      expect(parsed?.getHours()).toBe(14)
      expect(parsed?.getMinutes()).toBe(20)
    })

    it('корректно парсит "вчера в 18:00"', () => {
      const parsed = parseEventDateString('вчера в 18:00', fixedNow)
      expect(parsed).not.toBeNull()
      expect(parsed?.getHours()).toBe(18)
      expect(parsed?.getMinutes()).toBe(0)
      const diffHours = (fixedNow - (parsed?.getTime() || 0)) / 3600000
      expect(diffHours).toBeGreaterThan(15)
    })

    it('корректно парсит "позавчера в 10:00"', () => {
      const parsed = parseEventDateString('позавчера в 10:00', fixedNow)
      expect(parsed).not.toBeNull()
      expect(parsed?.getHours()).toBe(10)
      const diffDays = (fixedNow - (parsed?.getTime() || 0)) / 86400000
      expect(diffDays).toBeGreaterThanOrEqual(1.8)
    })

    it('корректно парсит даты с названиями месяцев и числовые форматы', () => {
      const parsedMonth = parseEventDateString('12 октября 2026 в 11:45', fixedNow)
      expect(parsedMonth?.getDate()).toBe(12)
      expect(parsedMonth?.getMonth()).toBe(9) // октябрь (0-indexed = 9)
      expect(parsedMonth?.getFullYear()).toBe(2026)
      expect(parsedMonth?.getHours()).toBe(11)
      expect(parsedMonth?.getMinutes()).toBe(45)

      const parsedNumeric = parseEventDateString('10.10.2026 09:15', fixedNow)
      expect(parsedNumeric?.getDate()).toBe(10)
      expect(parsedNumeric?.getMonth()).toBe(9)
      expect(parsedNumeric?.getFullYear()).toBe(2026)
    })

    it('парсит изолированное время без слова "сегодня" как сегодняшнее', () => {
      const parsedTime = parseEventDateString('14:20', fixedNow)
      expect(parsedTime).not.toBeNull()
      expect(parsedTime?.getHours()).toBe(14)
      expect(parsedTime?.getMinutes()).toBe(20)

      const parsedWithV = parseEventDateString('в 09:05', fixedNow)
      expect(parsedWithV).not.toBeNull()
      expect(parsedWithV?.getHours()).toBe(9)
      expect(parsedWithV?.getMinutes()).toBe(5)
    })

    it('не считает названия улиц и адреса датами (ул. 8 Марта, пер. 1 Мая)', () => {
      expect(parseEventDateString('ул. 8 Марта, 12')).toBeNull()
      expect(parseEventDateString('переулок 1 Мая, 5')).toBeNull()
      expect(parseEventDateString('проспект 60 лет Октября')).toBeNull()
    })

    it('возвращает null для некорректных или пустых строк', () => {
      expect(parseEventDateString('')).toBeNull()
      expect(parseEventDateString('какой-то текст без даты')).toBeNull()
    })
  })

  describe('parseEventCardDate', () => {
    const fixedNow = new Date('2026-10-15T15:30:00.000Z').getTime()

    it('извлекает дату из атрибута data-timestamp (в мс или секундах)', () => {
      const cardMs = document.createElement('div')
      cardMs.className = 'nk-event-view'
      cardMs.setAttribute('data-timestamp', String(fixedNow))
      expect(parseEventCardDate(cardMs)?.getTime()).toBe(fixedNow)

      const cardSec = document.createElement('div')
      cardSec.className = 'nk-event-view'
      cardSec.setAttribute('data-timestamp', String(Math.floor(fixedNow / 1000)))
      expect(parseEventCardDate(cardSec)?.getTime()).toBe(Math.floor(fixedNow / 1000) * 1000)
    })

    it('извлекает дату из тега <time datetime="...">', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = '<time datetime="2026-10-15T10:00:00Z">15 октября</time>'
      const parsed = parseEventCardDate(card, fixedNow)
      expect(parsed?.toISOString()).toBe('2026-10-15T10:00:00.000Z')
    })

    it('извлекает дату из элемента .nk-event-view__time', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = '<span class="nk-event-view__time">5 минут назад</span>'
      const parsed = parseEventCardDate(card, fixedNow)
      expect(parsed?.getTime()).toBe(fixedNow - 5 * 60 * 1000)
    })

    it('не сбивается на название улицы в заголовке события', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <div class="nk-event-view__header">Здание: ул. 8 Марта, 15</div>
        <div class="nk-event-view__time">14:20</div>
      `
      const parsed = parseEventCardDate(card, fixedNow)
      expect(parsed?.getHours()).toBe(14)
      expect(parsed?.getMinutes()).toBe(20)
    })

    it('извлекает дату из текстового содержимого карточки при отсутствии спец-элементов', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.textContent = 'Пользователь обновил здание сегодня в 12:00'
      const parsed = parseEventCardDate(card, fixedNow)
      expect(parsed?.getHours()).toBe(12)
    })
  })

  describe('getTargetThresholdMs', () => {
    it('рассчитывает календарный порог для 1 суток как 00:00:00 сегодняшнего дня', () => {
      const ref = new Date('2026-10-15T21:30:00.000').getTime()
      const threshold = getTargetThresholdMs(1, ref)

      const startOfToday = new Date(ref)
      startOfToday.setHours(0, 0, 0, 0)
      expect(threshold).toBe(startOfToday.getTime())
    })

    it('рассчитывает календарный порог для 3 суток как 00:00:00 позавчера (2 дня назад)', () => {
      const ref = new Date('2026-10-15T05:00:00.000').getTime()
      const threshold = getTargetThresholdMs(3, ref)

      const startOfToday = new Date(ref)
      startOfToday.setHours(0, 0, 0, 0)
      const twoDaysAgo = startOfToday.getTime() - 2 * 24 * 3600 * 1000
      expect(threshold).toBe(twoDaysAgo)
    })

    it('рассчитывает календарный порог для 7 суток как 00:00:00 за 6 дней до сегодня', () => {
      const ref = new Date('2026-10-15T12:00:00.000').getTime()
      const threshold = getTargetThresholdMs(7, ref)

      const startOfToday = new Date(ref)
      startOfToday.setHours(0, 0, 0, 0)
      const sixDaysAgo = startOfToday.getTime() - 6 * 24 * 3600 * 1000
      expect(threshold).toBe(sixDaysAgo)
    })
  })

  describe('getEventCardDayAge and getEventCardDateText with title and relative classes', () => {
    it('приоритетно извлекает дату и время из атрибута title у .nk-date-time.nk-date-time_mode_relative.nk-event-view__date', () => {
      const fixedNow = new Date('2026-10-26T20:00:00.000').getTime()
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-date-time nk-date-time_mode_relative nk-event-view__date" title="26.10.2026, 18:30:15">2 часа назад</span>
      `
      expect(getEventCardDateText(card)).toBe('26.10.2026, 18:30:15')
      expect(getEventCardDayAge(card, fixedNow)).toBe(0)

      // Для вчерашнего title
      const yesterdayCard = document.createElement('div')
      yesterdayCard.className = 'nk-event-view'
      yesterdayCard.innerHTML = `
        <span class="nk-date-time nk-date-time_mode_relative nk-event-view__date" title="25.10.2026, 23:50:00">вчера</span>
      `
      expect(getEventCardDateText(yesterdayCard)).toBe('25.10.2026, 23:50:00')
      expect(getEventCardDayAge(yesterdayCard, fixedNow)).toBe(1)
    })

    it('извлекает текст даты из .nk-date-time.nk-event-view__date при отсутствии title', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-date-time nk-date-time_mode_relative nk-event-view__date">вчера, 18:32</span>
      `
      expect(getEventCardDateText(card)).toBe('вчера, 18:32')
      expect(getEventCardDayAge(card)).toBe(1)
    })

    it('определяет давность 0 дней для событий за сегодня ("только что", минуты, часы назад, "сегодня", "HH:MM")', () => {
      const makeCard = (text: string) => {
        const card = document.createElement('div')
        card.className = 'nk-event-view'
        card.innerHTML = `<span class="nk-date-time nk-event-view__date">${text}</span>`
        return card
      }

      expect(getEventCardDayAge(makeCard('только что'))).toBe(0)
      expect(getEventCardDayAge(makeCard('15 минут назад'))).toBe(0)
      expect(getEventCardDayAge(makeCard('3 часа назад'))).toBe(0)
      expect(getEventCardDayAge(makeCard('сегодня, 14:20'))).toBe(0)
      expect(getEventCardDayAge(makeCard('14:20'))).toBe(0)
      expect(getEventCardDayAge(makeCard('в 09:05'))).toBe(0)
    })

    it('определяет давность 1 день для "вчера, хх:хх"', () => {
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `<span class="nk-date-time nk-event-view__date">вчера, 21:15</span>`
      expect(getEventCardDayAge(card)).toBe(1)
    })

    it('определяет давность 2 дня для "позавчера" и "2 дня назад"', () => {
      const cardPozavchera = document.createElement('div')
      cardPozavchera.innerHTML = `<span class="nk-date-time nk-event-view__date">позавчера, 10:00</span>`
      expect(getEventCardDayAge(cardPozavchera)).toBe(2)

      const card2Days = document.createElement('div')
      card2Days.innerHTML = `<span class="nk-date-time nk-event-view__date">2 дня назад</span>`
      expect(getEventCardDayAge(card2Days)).toBe(2)
    })

    it('определяет давность N дней для "N дня/дней назад", недель и месяцев', () => {
      const card3Days = document.createElement('div')
      card3Days.innerHTML = `<span class="nk-date-time nk-event-view__date">3 дня назад</span>`
      expect(getEventCardDayAge(card3Days)).toBe(3)

      const card10Days = document.createElement('div')
      card10Days.innerHTML = `<span class="nk-date-time nk-event-view__date">10 дней назад</span>`
      expect(getEventCardDayAge(card10Days)).toBe(10)

      // Недели (со скриншота пользователя: "3 недели назад")
      const card1Week = document.createElement('div')
      card1Week.innerHTML = `<span class="nk-date-time nk-event-view__date">неделю назад</span>`
      expect(getEventCardDayAge(card1Week)).toBe(7)

      const card3Weeks = document.createElement('div')
      card3Weeks.innerHTML = `<span class="nk-date-time nk-date-time_mode_relative nk-event-view__date">3 недели назад</span>`
      expect(getEventCardDayAge(card3Weeks)).toBe(21)

      const cardMonth = document.createElement('div')
      cardMonth.innerHTML = `<span class="nk-date-time nk-event-view__date">месяц назад</span>`
      expect(getEventCardDayAge(cardMonth)).toBe(30)
    })

    it('парсит дату со скриншота "8 октября 2026 23:24" в title и рассчитывает корректный dayAge', () => {
      const ref = new Date('2026-10-26T22:30:00.000').getTime()
      const card = document.createElement('div')
      card.className = 'nk-event-view'
      card.innerHTML = `
        <span class="nk-date-time nk-date-time_mode_relative nk-event-view__date" title="8 октября 2026 23:24">3 недели назад</span>
      `
      expect(getEventCardDateText(card)).toBe('8 октября 2026 23:24')
      expect(getEventCardDayAge(card, ref)).toBe(18)
    })
  })

  describe('getLastCardWithDayAge and getLastCardWithDate', () => {
    it('находит последнюю карточку с валидной давностью, игнорируя скелетоны', () => {
      const fixedNow = new Date('2026-10-15T15:30:00.000Z').getTime()

      const card1 = document.createElement('div')
      card1.className = 'nk-event-view'
      card1.innerHTML = '<span class="nk-date-time nk-event-view__date">сегодня, 12:00</span>'

      const skeletonCard = document.createElement('div')
      skeletonCard.className = 'nk-event-view nk-event-view_skeleton'

      const result = getLastCardWithDayAge([card1, skeletonCard], fixedNow)
      expect(result).not.toBeNull()
      expect(result?.card).toBe(card1)
      expect(result?.dayAge).toBe(0)

      const dateResult = getLastCardWithDate([card1, skeletonCard], fixedNow)
      expect(dateResult).not.toBeNull()
      expect(dateResult?.card).toBe(card1)
    })
  })
})
