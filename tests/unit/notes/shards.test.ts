import { describe, expect, it } from 'vitest'
import {
  parseShard,
  removeShardGeometry,
  setShardGeometry,
  shardIdForDate,
} from '@/lib/notes/model/shards'

describe('shardIdForDate', () => {
  it('выводит ключ шарда из даты заметки', () => {
    expect(shardIdForDate('14-11-2026')).toBe('2026-11')
  })

  it('возвращает null для нечитаемой даты', () => {
    expect(shardIdForDate('')).toBeNull()
    expect(shardIdForDate('14/11/2026')).toBe('2026-11')
    expect(shardIdForDate('32-13-2026')).toBeNull()
  })

  it('отбрасывает годы вне разумного диапазона', () => {
    expect(shardIdForDate('01-01-1900')).toBeNull()
    expect(shardIdForDate('01-01-2200')).toBeNull()
  })
})

describe('parseShard', () => {
  it('читает записи, отбрасывая нерисуемые', () => {
    const shard = parseShard({
      notes: {
        ok: { kind: 'Point', coords: [37, 55] },
        bad: { kind: 'Point', coords: 'нет' },
      },
    })

    expect(Object.keys(shard?.notes ?? {})).toEqual(['ok'])
  })

  it('возвращает null без объекта notes', () => {
    expect(parseShard({})).toBeNull()
    expect(parseShard('строка')).toBeNull()
  })
})

describe('setShardGeometry / removeShardGeometry', () => {
  it('добавляет и убирает геометрию, не трогая соседей', () => {
    const empty = parseShard({ notes: {} })!
    const withOne = setShardGeometry(empty, 'a', { kind: 'Point', coords: [37, 55] })
    const withTwo = setShardGeometry(withOne, 'b', { kind: 'Point', coords: [38, 56] })

    expect(Object.keys(withTwo.notes).sort()).toEqual(['a', 'b'])
    expect(Object.keys(removeShardGeometry(withTwo, 'a').notes)).toEqual(['b'])
  })

  it('не переписывает шард при удалении отсутствующей записи', () => {
    const shard = parseShard({ notes: {} })!
    expect(removeShardGeometry(shard, 'missing')).toBe(shard)
  })
})
