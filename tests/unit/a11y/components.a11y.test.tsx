// @vitest-environment happy-dom

import { afterEach, describe, it, vi } from 'vitest'
import { Header } from '@/components/Header'
import { PointsTab } from '@/components/PointsTab'
import { PoligonTab } from '@/components/PoligonTab'
import { SettingsTab } from '@/components/SettingsTab'
import { TabBar } from '@/components/TabBar'
import { UploadStatusMessage } from '@/components/UploadStatusMessage'
import { expectNoA11yViolations, cleanupA11y, renderA11y } from '@/tests/setup/a11y'

const noop = () => {}

afterEach(() => {
  cleanupA11y()
  vi.restoreAllMocks()
})

const settingsTabProps = {
  themeMode: 'system' as const,
  onThemeModeChange: noop,
  onBack: noop,
  strokeColor: {
    inputValue: 'ff0000',
    effectiveColor: '#ff0000',
    validationError: null,
    applyStatus: 'idle' as const,
    isLoaded: true,
    isApplying: false,
    canApply: true,
    handleInputChange: noop,
    handleApply: async () => {},
  },
  reloadAfterUpload: {
    isEnabled: false,
    isLoaded: true,
    setIsEnabled: noop,
    canChange: true,
  },
  splitViewButton: {
    isEnabled: true,
    isLoaded: true,
    setIsEnabled: noop,
  },
  goToLinks: {
    isMenuEnabled: true,
    isLoaded: true,
    items: [
      { name: 'OpenStreetMap', active: true },
      { name: 'Nakarte', active: false },
    ],
    setIsMenuEnabled: noop,
    setItemActive: noop,
    moveItemUp: noop,
    moveItemDown: noop,
  },
}

describe('a11y: TabBar', () => {
  it('без нарушений доступности', async () => {
    const { container } = renderA11y(
      <TabBar
        tabs={[
          { id: 'upload', label: 'Полигоны' },
          { id: 'manual', label: 'Точки' },
        ]}
        activeId="upload"
        onChange={noop}
        ariaLabel="Режим ввода"
      />,
    )

    await expectNoA11yViolations(container)
  })
})

describe('a11y: Header', () => {
  it('без нарушений для гостя', async () => {
    const { container } = renderA11y(
      <Header
        user={null}
        avatarDataUrl={null}
        isLoggingIn={false}
        onLogin={noop}
        onLogout={noop}
      />,
    )

    await expectNoA11yViolations(container)
  })

  it('без нарушений для авторизованного пользователя', async () => {
    const { container } = renderA11y(
      <Header
        user={{
          id: '1',
          login: 'tester',
          display_name: 'Тестер',
          real_name: 'Тестер',
        }}
        avatarDataUrl="data:image/png;base64,iVBORw0KGgo="
        isLoggingIn={false}
        onLogin={noop}
        onLogout={noop}
      />,
    )

    await expectNoA11yViolations(container)
  })
})

describe('a11y: PoligonTab', () => {
  it('без нарушений в состоянии загрузки файла', async () => {
    const { container } = renderA11y(
      <PoligonTab
        isUploading={false}
        progress={0}
        uploadStatus={null}
        isLoggedIn={false}
        onRequireAuth={noop}
        onUpload={noop}
      />,
    )

    await expectNoA11yViolations(container)
  })
})

describe('a11y: PointsTab', () => {
  it('без нарушений на вкладке ручного ввода', async () => {
    const { container } = renderA11y(
      <PointsTab
        isUploading={false}
        uploadStatus={null}
        isLoggedIn={false}
        onRequireAuth={noop}
        onManualUpload={noop}
        onMultipointUpload={noop}
      />,
    )

    await expectNoA11yViolations(container)
  })
})

describe('a11y: SettingsTab', () => {
  it('без нарушений', async () => {
    const { container } = renderA11y(<SettingsTab {...settingsTabProps} />)

    await expectNoA11yViolations(container)
  })
})

describe('a11y: UploadStatusMessage', () => {
  it('без нарушений для статуса успеха', async () => {
    const { container } = renderA11y(
      <UploadStatusMessage status={{ level: 'success', message: 'Загружено' }} />,
    )

    await expectNoA11yViolations(container)
  })

  it('без нарушений для статуса ошибки', async () => {
    const { container } = renderA11y(
      <UploadStatusMessage status={{ level: 'error', message: 'Ошибка загрузки' }} />,
    )

    await expectNoA11yViolations(container)
  })
})
