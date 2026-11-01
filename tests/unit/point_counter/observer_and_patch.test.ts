// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  attachCounterResetListeners,
  isMapDrawingSvgElement,
  PointCounterUi,
  patchCanvasForPointCounter,
  SvgPointCounterObserver,
} from '@/lib/point_counter'

type MockCanvasProto = {
  beginPath: ReturnType<typeof vi.fn>
  moveTo: ReturnType<typeof vi.fn>
  lineTo: ReturnType<typeof vi.fn>
  bezierCurveTo?: ReturnType<typeof vi.fn>
  quadraticCurveTo?: ReturnType<typeof vi.fn>
  arcTo?: ReturnType<typeof vi.fn>
  arc?: ReturnType<typeof vi.fn>
  stroke: ReturnType<typeof vi.fn>
  __nmapCounterPatched__?: boolean
  strokeStyle?: string
}

describe('point_counter svg_observer & canvas_patch', () => {
  let ui: PointCounterUi
  let getLastMapInteractionTime: () => number

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    getLastMapInteractionTime = () => Date.now()
    ui = new PointCounterUi(() => (key) => key)
    ui.ensureCreated()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  describe('SvgPointCounterObserver', () => {
    it('может запускаться и сбрасывать счетчик', () => {
      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })

      const cleanup = observer.start()
      expect(typeof cleanup).toBe('function')

      observer.resetCounter()
      expect(ui.isVisible()).toBe(false)

      cleanup()
    })

    it('пересчитывает вершины при последовательных (повторных) скруглениях контура', async () => {
      const showSpy = vi.spyOn(ui, 'show')
      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })
      const cleanup = observer.start()

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path1.setAttribute('d', 'M 0 0 L 10 0 L 10 10 L 0 10 Z')
      svg.appendChild(path1)
      document.documentElement.appendChild(svg)

      // Первое скругление
      path1.setAttribute('d', 'M 0 0 L 5 0 C 7 0 10 3 10 5 L 10 10 C 10 12 7 15 5 15 L 0 15 Z')

      await vi.waitFor(() => {
        expect(showSpy).toHaveBeenCalled()
      })

      // Повторное скругление (новый элемент пути)
      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path2.setAttribute('d', 'M 0 0 L 2 0 C 3 0 4 1 5 1 C 6 1 7 2 8 2 L 10 10 L 0 10 Z')
      svg.appendChild(path2)

      await vi.waitFor(() => {
        expect(showSpy).toHaveBeenCalled()
      })

      cleanup()
    })

    it('отображает счетчик при превышении лимита (например, 520 точек после скругления)', async () => {
      const showSpy = vi.spyOn(ui, 'show')
      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })
      const cleanup = observer.start()

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      // Создаем путь с 520 точками
      let d = 'M 0 0'
      for (let i = 1; i < 520; i++) {
        d += ` L ${i} ${i}`
      }
      path.setAttribute('d', d)
      svg.appendChild(path)
      document.documentElement.appendChild(svg)

      await vi.waitFor(() => {
        expect(showSpy).toHaveBeenCalledWith(519) // 520 сырых точек - 1 точка курсора
      })

      cleanup()
    })

    it('синхронизируется с системным баннером лимита вершин, когда он появляется в DOM', () => {
      const showRemainingSpy = vi.spyOn(ui, 'showRemaining')
      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })
      const cleanup = observer.start()

      const warningEl = document.createElement('div')
      warningEl.className = 'nk-toolbar__message'
      warningEl.textContent = 'Лимит — 500 вершин. Можно нарисовать ещё 11 вершин'
      document.body.appendChild(warningEl)

      observer.checkSystemBanner(true)
      expect(showRemainingSpy).toHaveBeenCalledWith(11)

      cleanup()
    })

    it('игнорирует SVG иконки тулбара и не показывает ложные 470 точек (30 вершин иконки)', () => {
      const showSpy = vi.spyOn(ui, 'show')
      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })
      const cleanup = observer.start()

      // Тулбар на карте с иконкой инструмента рисования (содержит 31 точку)
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      const button = document.createElement('button')
      button.className = 'nk-button nk-on-map-toolbar__item'
      const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')

      let d = 'M 0 0'
      for (let i = 1; i <= 30; i++) {
        d += ` L ${i} ${i}`
      }
      iconPath.setAttribute('d', d)
      iconSvg.appendChild(iconPath)
      button.appendChild(iconSvg)
      toolbar.appendChild(button)
      document.body.appendChild(toolbar)

      // Проверяем, что иконка отфильтрована и UI не вызывался с 30 точками
      expect(showSpy).not.toHaveBeenCalled()

      cleanup()
    })

    it('isMapDrawingSvgElement корректно отличает элементы карты от элементов интерфейса', () => {
      const mapContainer = document.createElement('div')
      mapContainer.className = 'ymaps-2-1-87-map'
      const mapSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const mapPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      mapSvg.appendChild(mapPath)
      mapContainer.appendChild(mapSvg)
      document.body.appendChild(mapContainer)

      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      const button = document.createElement('button')
      const btnSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const btnPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      btnSvg.appendChild(btnPath)
      button.appendChild(btnSvg)
      toolbar.appendChild(button)
      document.body.appendChild(toolbar)

      expect(isMapDrawingSvgElement(btnPath)).toBe(false)
      expect(isMapDrawingSvgElement(mapPath)).toBe(true)
    })
  })

  describe('patchCanvasForPointCounter', () => {
    it('патчит CanvasRenderingContext2D.prototype без повторного вызова', () => {
      const mockProto: MockCanvasProto = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      }

      const globalRecord = globalThis as unknown as Record<string, unknown>
      globalRecord.CanvasRenderingContext2D = () => {}
      ;(globalRecord.CanvasRenderingContext2D as { prototype: unknown }).prototype = mockProto

      patchCanvasForPointCounter({
        ui,
        getLastMapInteractionTime,
      })

      expect(mockProto.__nmapCounterPatched__).toBe(true)

      // Повторный вызов безопасен
      patchCanvasForPointCounter({
        ui,
        getLastMapInteractionTime,
      })
      expect(mockProto.__nmapCounterPatched__).toBe(true)
    })

    it('отображает нормализованные точки при активном рисовании на canvas', () => {
      const showSpy = vi.spyOn(ui, 'show')
      const mockProto: MockCanvasProto = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      }

      const globalRecord = globalThis as unknown as Record<string, unknown>
      globalRecord.CanvasRenderingContext2D = () => {}
      ;(globalRecord.CanvasRenderingContext2D as { prototype: unknown }).prototype = mockProto

      patchCanvasForPointCounter({
        ui,
        getLastMapInteractionTime,
      })

      const ctx = Object.create(mockProto) as MockCanvasProto
      ctx.strokeStyle = '#ff00ff'

      // Рисуем 3 сырые точки (1 fixed + cursor rubber-band)
      ctx.beginPath()
      ctx.moveTo(10, 20)
      ctx.lineTo(30, 40)
      ctx.lineTo(50, 60)
      ctx.stroke()

      vi.advanceTimersByTime(60)

      // Сырых точек 3, нормализованных с вычетом курсора = 2
      expect(showSpy).toHaveBeenCalledWith(2)
    })

    it('учитывает bezierCurveTo и arcTo при рисовании кривых и скруглений на canvas', () => {
      const showSpy = vi.spyOn(ui, 'show')
      const mockProto: MockCanvasProto = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        arcTo: vi.fn(),
        stroke: vi.fn(),
      }

      const globalRecord = globalThis as unknown as Record<string, unknown>
      globalRecord.CanvasRenderingContext2D = () => {}
      ;(globalRecord.CanvasRenderingContext2D as { prototype: unknown }).prototype = mockProto

      patchCanvasForPointCounter({
        ui,
        getLastMapInteractionTime,
      })

      const ctx = Object.create(mockProto) as MockCanvasProto
      ctx.strokeStyle = '#ff00ff'

      ctx.beginPath()
      ctx.moveTo(10, 20)
      ctx.bezierCurveTo?.(15, 25, 20, 30, 25, 35)
      ctx.arcTo?.(30, 40, 50, 60, 10)
      ctx.stroke()

      vi.advanceTimersByTime(60)

      // 1 moveTo + 1 bezierCurveTo + 1 arcTo = 3 сырые точки, нормализованных = 2
      expect(showSpy).toHaveBeenCalledWith(2)
    })

    it('скрывает счетчик при превышении допустимого размера геометрии (>1000 точек)', () => {
      const hideSpy = vi.spyOn(ui, 'hide')
      const mockProto: MockCanvasProto = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      }

      const globalRecord = globalThis as unknown as Record<string, unknown>
      globalRecord.CanvasRenderingContext2D = () => {}
      ;(globalRecord.CanvasRenderingContext2D as { prototype: unknown }).prototype = mockProto

      patchCanvasForPointCounter({
        ui,
        getLastMapInteractionTime,
      })

      const ctx = Object.create(mockProto) as MockCanvasProto
      ctx.strokeStyle = '#ff00ff'

      ctx.beginPath()
      ctx.moveTo(0, 0)
      for (let i = 1; i <= 1005; i++) {
        ctx.lineTo(i, i)
      }
      ctx.stroke()

      vi.advanceTimersByTime(60)

      expect(hideSpy).toHaveBeenCalled()
    })
  })

  describe('attachCounterResetListeners', () => {
    it('сбрасывает счетчик при клике на кнопки завершения/сохранения', () => {
      const onReset = vi.fn()
      const cleanup = attachCounterResetListeners(onReset)

      const btn = document.createElement('button')
      btn.textContent = 'Завершить'
      document.body.appendChild(btn)

      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      expect(onReset).toHaveBeenCalledTimes(1)

      cleanup()
    })

    it('сбрасывает счетчик по нажатию кнопки "Перерисовать" на тулбаре карты', () => {
      const onReset = vi.fn()
      const cleanup = attachCounterResetListeners(onReset)

      const redrawBtn = document.createElement('button')
      redrawBtn.className =
        'nk-button nk-button_theme_air nk-button_size_xl nk-on-map-toolbar__item'
      redrawBtn.setAttribute('title', 'Перерисовать')

      const textSpan = document.createElement('span')
      textSpan.textContent = 'Перерисовать'
      redrawBtn.appendChild(textSpan)
      document.body.appendChild(redrawBtn)

      // Клик по вложенному элементу иконки/текста кнопки
      textSpan.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      expect(onReset).toHaveBeenCalledTimes(1)

      // Проверяем также через pointerdown (захватывается capture-слушателем)
      textSpan.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(onReset).toHaveBeenCalledTimes(2)

      cleanup()
    })

    it('не сбрасывает счетчик при клике по обычной кнопке управления картой', () => {
      const onReset = vi.fn()
      const cleanup = attachCounterResetListeners(onReset)

      const mapBtn = document.createElement('button')
      mapBtn.className = 'ymaps-zoom-button'
      mapBtn.textContent = '+'
      document.body.appendChild(mapBtn)

      mapBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      expect(onReset).not.toHaveBeenCalled()

      cleanup()
    })

    it('не сбрасывает счетчик при двойном клике (замыкание контура или завершение линии)', () => {
      const onReset = vi.fn()
      const cleanup = attachCounterResetListeners(onReset)

      document.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      expect(onReset).not.toHaveBeenCalled()

      cleanup()
    })

    it('не сбрасывает счетчик при нажатии на инструмент "Скруглить все углы"', () => {
      const onReset = vi.fn()
      const cleanup = attachCounterResetListeners(onReset)

      const sidebar = document.createElement('div')
      sidebar.className = 'nk-sidebar-view'

      const roundBtn = document.createElement('button')
      roundBtn.className = 'nk-button'
      roundBtn.textContent = 'Скруглить все углы'
      sidebar.appendChild(roundBtn)
      document.body.appendChild(sidebar)

      roundBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      expect(onReset).not.toHaveBeenCalled()

      cleanup()
    })

    it('сбрасывает счетчик при нажатии на кнопку "Отменить" или "Отмена" в боковой панели (Cancel)', () => {
      const onReset = vi.fn()
      const cleanup = attachCounterResetListeners(onReset)

      const sidebar = document.createElement('div')
      sidebar.className = 'nk-sidebar-view'

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'nk-button'
      cancelBtn.textContent = 'Отмена'
      sidebar.appendChild(cancelBtn)
      document.body.appendChild(sidebar)

      cancelBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      expect(onReset).toHaveBeenCalledTimes(1)

      cleanup()
    })

    it('сбрасывает счетчик при клике на крестик закрытия карточки в боковой панели', () => {
      const onReset = vi.fn()
      const cleanup = attachCounterResetListeners(onReset)

      const sidebar = document.createElement('div')
      sidebar.className = 'nk-sidebar-view'

      const closeBtn = document.createElement('button')
      closeBtn.className = 'nk-button nk-close-button'
      const icon = document.createElement('span')
      icon.className = 'nk-icon nk-icon_id_close'
      closeBtn.appendChild(icon)
      sidebar.appendChild(closeBtn)
      document.body.appendChild(sidebar)

      icon.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      expect(onReset).toHaveBeenCalledTimes(1)

      cleanup()
    })

    it('сбрасывает счетчик по нажатию клавиши Escape / Esc', () => {
      const onReset = vi.fn()
      const cleanup = attachCounterResetListeners(onReset)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(onReset).toHaveBeenCalledTimes(1)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Esc', bubbles: true }))
      expect(onReset).toHaveBeenCalledTimes(2)

      cleanup()
    })

    it('скрывает тост, если после отмены превышения системный баннер исчез', () => {
      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })
      const cleanup = observer.start()

      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'

      const warning = document.createElement('div')
      warning.className = 'nk-toolbar__message-warning'
      warning.textContent = 'Лимит превышен на 5 вершин'
      toolbar.appendChild(warning)
      document.body.appendChild(toolbar)

      // Баннер есть -> тост отображает статус превышения
      expect(observer.checkSystemBanner(true)).toBe(true)
      expect(ui.isVisible()).toBe(true)

      // Пользователь нажал "Отменить" -> баннер удален Яндексом
      warning.remove()

      // При следующей проверке тост должен скрыться
      expect(observer.checkSystemBanner(true)).toBe(false)
      expect(ui.isVisible()).toBe(false)

      cleanup()
    })

    it('не активирует счетчик при выборе объекта/границы поселения вне режима георедактора', async () => {
      const showSpy = vi.spyOn(ui, 'show')

      // Страница карты с контейнером карты и сайдбаром (режим просмотра)
      const mapContainer = document.createElement('div')
      mapContainer.className = 'nk-map'
      document.body.appendChild(mapContainer)

      const sidebar = document.createElement('div')
      sidebar.className = 'nk-sidebar-view'
      document.body.appendChild(sidebar)

      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })
      const cleanup = observer.start()

      // Подсветка границы административного поселения на 250 вершин
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      mapContainer.appendChild(svg)

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      let pathData = 'M 0 0'
      for (let i = 1; i <= 250; i++) {
        pathData += ` L ${i} ${i % 10}`
      }
      path.setAttribute('d', pathData)
      svg.appendChild(path)

      await vi.waitFor(() => {
        expect(showSpy).not.toHaveBeenCalled()
        expect(ui.isVisible()).toBe(false)
      })

      cleanup()
    })

    it('активирует счетчик и отображает вершины, когда тулбар георедактора активен', async () => {
      const showSpy = vi.spyOn(ui, 'show')

      const mapContainer = document.createElement('div')
      mapContainer.className = 'nk-map'
      document.body.appendChild(mapContainer)

      // Добавляем активный тулбар георедактора на карте
      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      document.body.appendChild(toolbar)

      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })
      const cleanup = observer.start()

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      mapContainer.appendChild(svg)

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      let pathData = 'M 0 0'
      for (let i = 1; i <= 150; i++) {
        pathData += ` L ${i} ${i % 5}`
      }
      path.setAttribute('d', pathData)
      svg.appendChild(path)

      await vi.waitFor(() => {
        expect(showSpy).toHaveBeenCalledWith(150)
      })

      cleanup()
    })

    it('продолжает корректно считать вершины после появления системного тоста о лимите при дальнейшем рисовании', async () => {
      const showRemainingSpy = vi.spyOn(ui, 'showRemaining')

      const mapContainer = document.createElement('div')
      mapContainer.className = 'nk-map'
      document.body.appendChild(mapContainer)

      const toolbar = document.createElement('div')
      toolbar.className = 'nk-on-map-toolbar'
      document.body.appendChild(toolbar)

      const observer = new SvgPointCounterObserver({
        ui,
        getLastMapInteractionTime,
      })
      const cleanup = observer.start()

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      mapContainer.appendChild(svg)

      // Начальный контур (431 сырая точка = 430 поставленных)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      let pathData = 'M 0 0'
      for (let i = 1; i <= 430; i++) {
        pathData += ` L ${i} ${i % 5}`
      }
      path.setAttribute('d', pathData)
      svg.appendChild(path)

      await vi.waitFor(() => {
        expect(ui.isVisible()).toBe(true)
      })

      // При скруглении появляется системный тост Яндекса (.nk-notification): осталось 4 вершины
      const systemToast = document.createElement('div')
      systemToast.className = 'nk-notification nk-notification_theme_warning'
      systemToast.textContent = 'Лимит — 500 вершин. Можно нарисовать ещё 4 вершины'
      document.body.appendChild(systemToast)

      await vi.waitFor(() => {
        expect(showRemainingSpy).toHaveBeenLastCalledWith(4)
        expect(systemToast.getAttribute('data-nmap-hidden-system-banner')).toBe('true')
      })

      // Проходит 300мс, пользователь ставит еще одну точку (+1 в SVG), а системный тост всё еще в DOM со старым текстом
      vi.advanceTimersByTime(300)
      pathData += ' L 431 1'
      path.setAttribute('d', pathData)

      await vi.waitFor(() => {
        expect(showRemainingSpy).toHaveBeenLastCalledWith(3)
      })

      // Пользователь ставит еще одну точку -> должно остаться 2 вершины
      pathData += ' L 432 2'
      path.setAttribute('d', pathData)

      await vi.waitFor(() => {
        expect(showRemainingSpy).toHaveBeenLastCalledWith(2)
      })

      cleanup()
    })
  })
})
