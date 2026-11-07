// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  ensureInjectedStyle,
  ensureInjectedTokens,
  INJECTED_TOKENS_ID,
  removeInjectedStyle,
} from '@/lib/injected_styles'

const styleById = (id: string): HTMLStyleElement | null =>
  document.getElementById(id) as HTMLStyleElement | null

describe('injected_styles', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('вставляет <style> с указанным id и текстом', () => {
    ensureInjectedStyle('nmap-test', '.a { color: red; }')

    expect(styleById('nmap-test')?.textContent).toBe('.a { color: red; }')
  })

  it('не дублирует элемент при повторном вызове', () => {
    ensureInjectedStyle('nmap-test', '.a { color: red; }')
    ensureInjectedStyle('nmap-test', '.a { color: red; }')

    expect(document.querySelectorAll('#nmap-test')).toHaveLength(1)
  })

  it('обновляет текст, если CSS изменился', () => {
    ensureInjectedStyle('nmap-test', '.a { color: red; }')
    ensureInjectedStyle('nmap-test', '.a { color: blue; }')

    expect(styleById('nmap-test')?.textContent).toBe('.a { color: blue; }')
  })

  it('удаляет элемент и переживает повторное удаление', () => {
    ensureInjectedStyle('nmap-test', '.a { color: red; }')

    removeInjectedStyle('nmap-test')
    expect(styleById('nmap-test')).toBeNull()

    expect(() => removeInjectedStyle('nmap-test')).not.toThrow()
  })

  it('подключает токены вместе с любым листом', () => {
    ensureInjectedStyle('nmap-test', '.a { color: var(--nmap-accent); }')

    expect(styleById(INJECTED_TOKENS_ID)?.textContent).toContain('--nmap-accent')
  })

  it('подключает токены один раз', () => {
    ensureInjectedStyle('nmap-one', '.a { color: red; }')
    ensureInjectedStyle('nmap-two', '.b { color: blue; }')
    ensureInjectedTokens()

    expect(document.querySelectorAll(`#${INJECTED_TOKENS_ID}`)).toHaveLength(1)
  })

  it('токены не подключают сами себя рекурсивно', () => {
    ensureInjectedTokens()
    ensureInjectedTokens()

    expect(document.querySelectorAll(`#${INJECTED_TOKENS_ID}`)).toHaveLength(1)
  })
})
