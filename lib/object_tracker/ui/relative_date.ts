/**
 * Относительная дата в формате нативной ленты редактора.
 *
 * Нативные карточки показывают «50 минут назад», «час назад», «вчера»,
 * а для старых событий — «12 января 2022».
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Склонение существительного по числу. */
const plural = (value: number, one: string, few: string, many: string): string => {
  const mod10 = value % 10
  const mod100 = value % 100

  if (mod10 === 1 && mod100 !== 11) {
    return one
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few
  }
  return many
}

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** «12 января 2022» — для событий старше недели. */
export const formatAbsoluteDate = (date: Date): string =>
  `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`

/**
 * Приводит ISO-дату коммита к относительной подписи.
 *
 * `now` передаётся для тестов; по умолчанию берётся текущее время.
 */
export const formatRelativeDate = (iso: string, now: number = Date.now()): string => {
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    return iso
  }

  const diff = now - timestamp

  if (diff < 0) {
    return 'только что'
  }

  const dayStartNow = startOfDay(new Date(now))
  const dayStartEvent = startOfDay(new Date(timestamp))
  const daysDiff = Math.round((dayStartNow - dayStartEvent) / DAY)

  // Вчерашние события показываем как «вчера», даже если прошло меньше суток.
  if (daysDiff === 1) {
    return 'вчера'
  }
  if (daysDiff > 1 && daysDiff < 7) {
    return `${daysDiff} ${plural(daysDiff, 'день', 'дня', 'дней')} назад`
  }
  if (daysDiff >= 7) {
    return formatAbsoluteDate(new Date(timestamp))
  }

  if (diff < MINUTE) {
    return 'только что'
  }

  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE)
    if (minutes === 1) {
      return 'минуту назад'
    }
    return `${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')} назад`
  }

  const hours = Math.floor(diff / HOUR)
  if (hours === 1) {
    return 'час назад'
  }
  return `${hours} ${plural(hours, 'час', 'часа', 'часов')} назад`
}
