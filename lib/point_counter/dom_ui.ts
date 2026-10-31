/**
 * DOM-интерфейс плашки отображения оставшихся точек в редакторе Народной карты.
 */

import type { TranslateFn } from '@/lib/i18n'
import {
  type CounterStatus,
  getCounterStatus,
  getCounterThemeStyle,
} from '@/lib/point_counter/core'

export const UI_WRAPPER_ID = 'nmap-point-counter-wrapper'

export class PointCounterUi {
  private counterWrapper: HTMLElement | null = null
  private counterText: HTMLElement | null = null
  private lastRenderedKey: string | null = null

  constructor(private readonly getTranslator: () => TranslateFn) {}

  public ensureCreated(): void {
    if (document.getElementById(UI_WRAPPER_ID)) {
      this.counterWrapper = document.getElementById(UI_WRAPPER_ID)
      this.counterText = this.counterWrapper?.firstElementChild as HTMLElement | null
      return
    }

    const wrapper = document.createElement('div')
    wrapper.id = UI_WRAPPER_ID
    wrapper.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.5);
      color: var(--map-region__path--font-color, #fff);
      padding: 0 16px;
      border-radius: 19px;
      line-height: 38px;
      white-space: nowrap;
      font-family: "Yandex Sans Text", "YS Text", Arial, Helvetica, sans-serif;
      font-size: 13px;
      z-index: 9999;
      pointer-events: none;
      display: none;
      opacity: 0;
      box-shadow: 0 3px 0 0 rgba(0, 0, 0, 0.05);
      transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out, color 0.2s ease-in-out;
    `

    const text = document.createElement('span')
    text.textContent = this.getTranslator()('mapPointCounter.points', { count: 0 })
    wrapper.appendChild(text)

    document.body.appendChild(wrapper)
    this.counterWrapper = wrapper
    this.counterText = text
  }

  public show(count: number): void {
    this.ensureCreated()
    if (!this.counterWrapper || !this.counterText) return

    if (this.isBuildingCategory()) {
      this.hide()
      return
    }

    const status = getCounterStatus(count)
    this.renderStatus(status)
  }

  public showRemaining(remaining: number): void {
    this.ensureCreated()
    if (!this.counterWrapper || !this.counterText) return

    if (this.isBuildingCategory()) {
      this.hide()
      return
    }

    let status: CounterStatus
    if (remaining < 0) {
      status = { type: 'limitExceeded', count: Math.abs(remaining) }
    } else if (remaining === 0) {
      status = { type: 'limitReached' }
    } else {
      status = { type: 'remaining', count: remaining }
    }

    this.renderStatus(status)
  }

  private renderStatus(status: CounterStatus): void {
    if (!this.counterWrapper || !this.counterText) return

    const key = `${status.type}:${'count' in status ? status.count : ''}`
    if (this.lastRenderedKey === key && this.counterWrapper.style.display !== 'none') {
      return
    }
    this.lastRenderedKey = key

    let text: string
    let remainingForTheme: number

    switch (status.type) {
      case 'limitExceeded':
        text = this.getTranslator()('mapPointCounter.limitExceeded', {
          count: status.count,
        })
        remainingForTheme = 0
        break
      case 'limitReached':
        text = this.getTranslator()('mapPointCounter.limitReached')
        remainingForTheme = 0
        break
      case 'remaining':
        text = this.getTranslator()('mapPointCounter.pointsLeft', {
          count: status.count,
        })
        remainingForTheme = status.count
        break
    }

    this.counterText.textContent = text

    const theme = getCounterThemeStyle(remainingForTheme)
    this.counterWrapper.style.setProperty('background-color', theme.backgroundColor, 'important')
    this.counterText.style.setProperty('color', theme.color, 'important')

    if (this.counterWrapper.style.display === 'none') {
      this.counterWrapper.style.display = 'block'
      this.counterWrapper.style.opacity = '1'
    }
  }

  public hide(): void {
    this.lastRenderedKey = null
    if (this.counterWrapper && this.counterWrapper.style.display !== 'none') {
      this.counterWrapper.style.display = 'none'
    }
  }

  public isVisible(): boolean {
    return Boolean(this.counterWrapper && this.counterWrapper.style.display !== 'none')
  }

  public isBuildingCategory(): boolean {
    const activeElements = Array.from(
      document.querySelectorAll(
        '[class*="active"], [class*="selected"], [class*="checked"], [aria-selected="true"]',
      ),
    )

    for (const el of activeElements) {
      const text = el.textContent?.trim().toLowerCase() || ''
      if (text.length < 50 && /(^|[^а-яё])здани/i.test(text)) {
        return true
      }
    }

    if (/(^|[^а-яё])здани/i.test(document.title.toLowerCase())) {
      return true
    }

    return false
  }
}
