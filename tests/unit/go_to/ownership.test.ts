// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import {
  getOwnedElementById,
  isNmapOwned,
  markNmapOwned,
  NMAP_OWNED_ATTR,
  queryOwnedElementsById,
  removeOwnedElementsById,
} from '@/lib/go_to/ownership'

describe('go_to/ownership', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('находит наш узел, даже если чужой с тем же id стоит раньше', () => {
    const foreign = document.createElement('div')
    foreign.id = 'same-id'
    const owned = document.createElement('div')
    owned.id = 'same-id'
    markNmapOwned(owned)
    document.body.append(foreign, owned)

    expect(getOwnedElementById('same-id')).toBe(owned)
    expect(queryOwnedElementsById('same-id')).toEqual([owned])
  })

  it('не считает чужие узлы нашими', () => {
    const foreign = document.createElement('div')
    foreign.id = 'same-id'
    foreign.setAttribute(NMAP_OWNED_ATTR, 'false')
    document.body.appendChild(foreign)

    expect(isNmapOwned(foreign)).toBe(false)
    expect(getOwnedElementById('same-id')).toBeNull()
  })

  it('удаляет только наши узлы с заданным id', () => {
    const foreign = document.createElement('div')
    foreign.id = 'same-id'
    const owned = document.createElement('div')
    owned.id = 'same-id'
    markNmapOwned(owned)
    document.body.append(foreign, owned)

    removeOwnedElementsById('same-id')

    expect(foreign.isConnected).toBe(true)
    expect(owned.isConnected).toBe(false)
  })
})
