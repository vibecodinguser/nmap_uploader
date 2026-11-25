// @vitest-environment happy-dom

import { afterEach, describe, it, vi } from 'vitest'
import { Header } from '@/components/Header'
import { NoteList as NoteListBase } from '@/components/notes_panel/NoteList'
import { NoteProperties } from '@/components/notes_panel/NoteProperties'
import { PoligonTab } from '@/components/PoligonTab'
import { SettingsTab } from '@/components/SettingsTab'
import { TabBar } from '@/components/TabBar'
import { UploadStatusMessage } from '@/components/UploadStatusMessage'
import type { Note } from '@/lib/notes/model/types'
import { cleanupA11y, expectNoA11yViolations, renderA11y } from '@/tests/setup/a11y'
import { listProps, type NoteListProps } from '@/tests/unit/notes_panel/list_props'

const noop = () => {}

afterEach(() => {
  cleanupA11y()
  vi.restoreAllMocks()
})

const settingsTabProps = {
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
  notesButton: {
    isEnabled: true,
    isLoaded: true,
    setIsEnabled: noop,
    permissionDenied: false,
  },
  nspdButton: {
    isEnabled: false,
    isLoaded: true,
    setIsEnabled: noop,
    permissionDenied: null,
  },
  pointCounter: {
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

/**
 * Обёртка со значениями группировки по умолчанию.
 *
 * Почти все проверки списка — про строку заметки и её действия; группы нужны
 * только в отдельных тестах, и там они передаются явно.
 */
const NoteList = (props: Partial<NoteListProps>) => <NoteListBase {...listProps(props)} />

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
          displayName: 'Тестер',
          realName: 'Тестер',
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

describe('a11y: SettingsTab', () => {
  it('без нарушений', async () => {
    const { container } = renderA11y(<SettingsTab {...settingsTabProps} />)

    await expectNoA11yViolations(container)
  })

  it('без нарушений при отказе в доступе к НСПД', async () => {
    const { container } = renderA11y(
      <SettingsTab
        {...settingsTabProps}
        nspdButton={{ ...settingsTabProps.nspdButton, permissionDenied: 'nspd' }}
      />,
    )

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

const sampleNote: Note = {
  id: 'note-1',
  kind: 'Point',
  name: '14.11.2026 Точка',
  description: 'Описание',
  date: '14-11-2026',
  icon: null,
  showLabel: false,
  style: { color: '#1a8cff', fillColor: null, hatch: null, opacity: 1, strokeWidth: 3 },
  groupId: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z',
}

describe('a11y: список заметок', () => {
  it('без нарушений для списка', async () => {
    const { container } = renderA11y(
      <NoteList notes={[sampleNote]} hiddenIds={[]} selectedId={null} onSelect={noop} />,
    )

    await expectNoA11yViolations(container)
  })
})

describe('a11y: свойства заметки', () => {
  it('без нарушений в дефолтном состоянии', async () => {
    const { container } = renderA11y(
      <NoteProperties
        note={sampleNote}
        fallbackName="14.11.2026 Точка"
        onPatch={noop}
        onBack={noop}
        groups={[]}
        onMoveToGroup={() => {}}
      />,
    )

    await expectNoA11yViolations(container)
  })
})
