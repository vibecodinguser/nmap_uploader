# Polygon Upload Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the side-panel “Polygons” tab with an always-visible map-toolbar button that opens the same upload workflow in a Yandex-style popup.

**Architecture:** Keep toolbar DOM integration in the existing content script, but move button and popup construction into focused library modules. Render the upload workflow in a dedicated extension iframe that reuses `PoligonTab`, authentication, upload, localization, occupied-date, and theme code. Simplify the side-panel React app so its main view renders notes directly.

**Tech Stack:** TypeScript 5.9, React 19, WXT 0.20, Vitest 4, Testing Library, happy-dom, browser extension APIs.

## Global Constraints

- The upload button is always visible and has no visibility setting.
- The button is immediately after `goToSplitButton` when split-view is enabled; when it is disabled, the upload button follows the go-to service button.
- The popup uses `nk-popup`, `nk-popup_visible`, `nk-popup_direction_right-bottom`, `nk-popup_theme_islands`, and `nk-popup_restrict-height`.
- The popup closes on a repeated button click, an outside click, or Escape.
- Closing removes the iframe and resets popup-local UI state.
- Existing file formats, conversion logic, authentication flow, and upload API must not change.
- Production code is written only after its corresponding test has failed for the expected reason.

---

### Task 1: Upload toolbar button primitive

**Files:**
- Create: `lib/polygon_upload_button.ts`
- Create: `tests/unit/polygon_upload_button.test.ts`
- Modify: `lib/i18n/messages/types.ts:127-132`
- Modify: `lib/i18n/messages/ru.ts:125-130`
- Modify: `lib/i18n/messages/en.ts:125-130`

**Interfaces:**
- Produces: `POLYGON_UPLOAD_BUTTON_ID`, `POLYGON_UPLOAD_BUTTON_ICON_SVG`, and `createPolygonUploadButton(ariaLabel?: string): HTMLButtonElement`.
- Consumes: `parseStaticSvg()` and existing go-to toolbar classes.

- [ ] **Step 1: Write the failing button tests**

```ts
// tests/unit/polygon_upload_button.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  createPolygonUploadButton,
  POLYGON_UPLOAD_BUTTON_ID,
} from '@/lib/polygon_upload_button'

describe('polygon upload toolbar button', () => {
  it('создаёт кнопку загрузки в стиле toolbar', () => {
    const button = createPolygonUploadButton('Загрузить полигоны')

    expect(button.id).toBe(POLYGON_UPLOAD_BUTTON_ID)
    expect(button.type).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Загрузить полигоны')
    expect(button.classList.contains('nk-map-region-view__button')).toBe(true)
    expect(button.querySelector('.nmap-uploader-goto-icon svg')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/unit/polygon_upload_button.test.ts`

Expected: FAIL because `@/lib/polygon_upload_button` does not exist.

- [ ] **Step 3: Add translated toolbar text**

Add `uploadPolygons: string` to `Messages['map']`, then add:

```ts
// lib/i18n/messages/ru.ts
uploadPolygons: 'Загрузить полигоны',

// lib/i18n/messages/en.ts
uploadPolygons: 'Upload polygons',
```

- [ ] **Step 4: Implement the button primitive**

```ts
// lib/polygon_upload_button.ts
import { parseStaticSvg } from '@/lib/parse_static_svg'

export const POLYGON_UPLOAD_BUTTON_ID = 'polygonUploadButton'
export const POLYGON_UPLOAD_BUTTON_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m0-12-4 4m4-4 4 4M5 14v5h14v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

export const createPolygonUploadButton = (ariaLabel = ''): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = POLYGON_UPLOAD_BUTTON_ID
  button.className =
    'nmap-uploader-goto-btn nmap-uploader-polygon-upload-btn nk-button nk-button_type_link nk-button_theme_air nk-button_size_xl nk-button_view_dark nk-map-region-view__button nk-map-region-view__button_id_goto'
  if (ariaLabel) button.setAttribute('aria-label', ariaLabel)

  const iconHost = document.createElement('span')
  iconHost.className = 'nk-icon nk-icon_align_auto nmap-uploader-goto-icon'
  iconHost.appendChild(parseStaticSvg(POLYGON_UPLOAD_BUTTON_ICON_SVG))
  button.appendChild(iconHost)
  return button
}
```

- [ ] **Step 5: Verify GREEN and localization types**

Run: `pnpm vitest run tests/unit/polygon_upload_button.test.ts tests/unit/i18n.test.ts && pnpm compile`

Expected: all selected tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add lib/polygon_upload_button.ts lib/i18n/messages tests/unit/polygon_upload_button.test.ts
git commit -m "feat: add polygon upload toolbar button"
```

---

### Task 2: Popup DOM lifecycle

**Files:**
- Create: `lib/polygon_upload_popup.ts`
- Create: `tests/unit/polygon_upload_popup.test.ts`
- Modify: `lib/go_to_styles.ts:10-188`

**Interfaces:**
- Produces: `POLYGON_UPLOAD_POPUP_ID`, `POLYGON_UPLOAD_IFRAME_CLASS`, `togglePolygonUploadPopup(button)`, `closePolygonUploadPopup()`, `teardownPolygonUploadPopup()`, and `isPolygonUploadPopupOpen()`.
- Consumes: `browser.runtime.getURL('/polygon-upload.html')`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
// tests/unit/polygon_upload_popup.test.ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import {
  closePolygonUploadPopup,
  isPolygonUploadPopupOpen,
  POLYGON_UPLOAD_POPUP_ID,
  teardownPolygonUploadPopup,
  togglePolygonUploadPopup,
} from '@/lib/polygon_upload_popup'

const mountButton = () => {
  const button = document.createElement('button')
  button.id = 'polygonUploadButton'
  document.body.appendChild(button)
  return button
}

afterEach(() => {
  teardownPolygonUploadPopup()
  document.body.replaceChildren()
})

describe('polygon upload popup', () => {
  it('открывает popup с iframe и классами редактора', () => {
    togglePolygonUploadPopup(mountButton())
    const popup = document.getElementById(POLYGON_UPLOAD_POPUP_ID)

    expect(popup?.classList.contains('nk-popup_visible')).toBe(true)
    expect(popup?.classList.contains('nk-popup_direction_right-bottom')).toBe(true)
    expect(popup?.classList.contains('nk-popup_theme_islands')).toBe(true)
    expect(popup?.classList.contains('nk-popup_restrict-height')).toBe(true)
    expect(popup?.querySelector('iframe')).not.toBeNull()
    expect(isPolygonUploadPopupOpen()).toBe(true)
  })

  it('закрывает popup повторным нажатием и удаляет iframe', () => {
    const button = mountButton()
    togglePolygonUploadPopup(button)
    togglePolygonUploadPopup(button)

    expect(document.getElementById(POLYGON_UPLOAD_POPUP_ID)).toBeNull()
    expect(isPolygonUploadPopupOpen()).toBe(false)
  })

  it('закрывает popup кликом снаружи и Escape', () => {
    const button = mountButton()
    togglePolygonUploadPopup(button)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(isPolygonUploadPopupOpen()).toBe(false)

    togglePolygonUploadPopup(button)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(isPolygonUploadPopupOpen()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/unit/polygon_upload_popup.test.ts`

Expected: FAIL because `@/lib/polygon_upload_popup` does not exist.

- [ ] **Step 3: Implement popup creation, positioning, and cleanup**

Implement `lib/polygon_upload_popup.ts` with module-local `popup` and `button` references. `togglePolygonUploadPopup()` creates:

```ts
const element = document.createElement('div')
element.id = POLYGON_UPLOAD_POPUP_ID
element.className =
  'nk-popup nk-popup_visible nk-popup_direction_right-bottom nk-popup_theme_islands nk-popup_restrict-height nmap-uploader-polygon-popup'

const content = document.createElement('div')
content.className = 'nk-popup__content nmap-uploader-polygon-popup__content'

const iframe = document.createElement('iframe')
iframe.className = POLYGON_UPLOAD_IFRAME_CLASS
iframe.src = browser.runtime.getURL('/polygon-upload.html')
iframe.title = button.getAttribute('aria-label') ?? ''
content.appendChild(iframe)
element.appendChild(content)
document.documentElement.appendChild(element)
```

Position it from `button.getBoundingClientRect()` using `bottom` and `left`, cap available height with `maxHeight`, and attach capture-phase outside-click plus document keydown listeners. The outside-click handler ignores events inside the popup or originating from the active button. `closePolygonUploadPopup()` removes listeners, removes the node, clears references, and sets `aria-expanded="false"`; open sets `aria-expanded="true"`. `teardownPolygonUploadPopup()` delegates to close.

- [ ] **Step 4: Add isolated host-page styles**

Append rules to `GO_TO_STYLES`:

```css
.nmap-uploader-polygon-popup {
  z-index: 11000;
  width: min(425px, calc(100vw - 24px));
  overflow: hidden;
  border-radius: 4px;
  background: var(--nmap-uploader-popup-bg, #fff);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.nmap-uploader-polygon-popup__content {
  width: 100%;
  height: min(560px, calc(100vh - 80px));
  max-height: inherit;
}

.nmap-uploader-polygon-popup__iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
```

- [ ] **Step 5: Verify GREEN**

Run: `pnpm vitest run tests/unit/polygon_upload_popup.test.ts && pnpm compile`

Expected: tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add lib/polygon_upload_popup.ts lib/go_to_styles.ts tests/unit/polygon_upload_popup.test.ts
git commit -m "feat: add polygon upload popup lifecycle"
```

---

### Task 3: Dedicated React upload page

**Files:**
- Create: `entrypoints/polygon-upload/index.html`
- Create: `entrypoints/polygon-upload/main.tsx`
- Create: `entrypoints/polygon-upload/App.tsx`
- Create: `assets/styles/polygon_upload_popup.css`
- Create: `tests/unit/polygon_upload_app.test.tsx`
- Modify: `wxt.config.ts:51-56`

**Interfaces:**
- Produces: web-accessible `/polygon-upload.html`.
- Consumes: `PoligonTab`, `useAuth`, `useFileUpload`, `OccupiedDatesProvider`, `LocaleProvider`, and `applyStoredDarkTheme`.

- [ ] **Step 1: Write the failing React app test**

Create `tests/unit/polygon_upload_app.test.tsx`, mock `PoligonTab`, `useAuth`, `useFileUpload`, and `OccupiedDatesProvider`, then assert:

```tsx
it('передаёт существующий upload workflow в PoligonTab', () => {
  render(<PolygonUploadApp />)

  expect(screen.getByTestId('polygon-upload-view')).toBeDefined()
  expect(poligonTabProps).toEqual(
    expect.objectContaining({
      isLoggedIn: true,
      isUploading: false,
      progress: 0,
      uploadStatus: null,
      onUpload: performUpload,
    }),
  )
})
```

Also invoke `poligonTabProps.onRequireAuth()` and assert `handleLogin` is called when `isLoggingIn` is false.

- [ ] **Step 2: Run the app test and verify RED**

Run: `pnpm vitest run tests/unit/polygon_upload_app.test.tsx`

Expected: FAIL because `@/entrypoints/polygon-upload/App` does not exist.

- [ ] **Step 3: Implement the popup React app**

```tsx
// entrypoints/polygon-upload/App.tsx
import { PoligonTab } from '@/components/PoligonTab'
import { useAuth } from '@/hooks/useAuth'
import { useFileUpload } from '@/hooks/useFileUpload'
import { OccupiedDatesProvider } from '@/hooks/useOccupiedDates'

export const PolygonUploadApp = () => {
  const { isLoggingIn, isLoggedIn, refreshUser, handleLogin } = useAuth()
  const { isUploading, progress, uploadStatus, performUpload } = useFileUpload({
    onAuthenticated: refreshUser,
  })

  const handleRequireAuth = async () => {
    if (!isLoggingIn) await handleLogin()
  }

  return (
    <main className="polygon-upload-popup-app" data-testid="polygon-upload-view">
      <OccupiedDatesProvider isLoggedIn={isLoggedIn}>
        <PoligonTab
          isUploading={isUploading}
          progress={progress}
          uploadStatus={uploadStatus}
          isLoggedIn={isLoggedIn}
          onRequireAuth={handleRequireAuth}
          onUpload={performUpload}
        />
      </OccupiedDatesProvider>
    </main>
  )
}
```

Do not render a header, tabs, notes, settings, or logout UI.

- [ ] **Step 4: Add entrypoint bootstrapping and popup-page styles**

`main.tsx` must mirror panel bootstrap: call `applyStoredDarkTheme(document.documentElement)`, wrap `PolygonUploadApp` in `StrictMode` and `LocaleProvider`, and render to `#root`. Import `uploader.css` and `polygon_upload_popup.css`.

Use this page-specific CSS:

```css
html,
body,
#root {
  min-height: 0;
  overflow: auto;
}

.polygon-upload-popup-app {
  min-height: 100%;
  padding: 16px;
}

.polygon-upload-popup-app .tab-panel,
.polygon-upload-popup-app .upload-form {
  min-height: 0;
}
```

- [ ] **Step 5: Expose the generated page to the host**

Add `polygon-upload.html` to the existing `web_accessible_resources[0].resources` array in `wxt.config.ts`.

- [ ] **Step 6: Verify GREEN and build discovery**

Run: `pnpm vitest run tests/unit/polygon_upload_app.test.tsx tests/unit/a11y/components.a11y.test.tsx && pnpm compile && pnpm build`

Expected: tests PASS, compile exits 0, build exits 0, and `.output/chrome-mv3/polygon-upload.html` exists.

- [ ] **Step 7: Commit**

```bash
git add entrypoints/polygon-upload assets/styles/polygon_upload_popup.css tests/unit/polygon_upload_app.test.tsx wxt.config.ts
git commit -m "feat: add polygon upload popup app"
```

---

### Task 4: Integrate the always-visible button into the map toolbar

**Files:**
- Modify: `lib/go_to_toolbar.ts`
- Modify: `entrypoints/map-go-to.content.ts`
- Modify: `tests/unit/content_scripts/map_go_to.content.test.ts`

**Interfaces:**
- Consumes: Task 1 button exports and Task 2 popup lifecycle.
- Produces: stable toolbar order and complete content-script cleanup.

- [ ] **Step 1: Extend failing content-script tests**

Add assertions that:

```ts
await vi.waitFor(() => {
  const upload = document.getElementById(POLYGON_UPLOAD_BUTTON_ID)
  expect(upload).not.toBeNull()
  expect(upload?.previousElementSibling?.id).toBe(GO_TO_SPLIT_BUTTON_ID)
})
```

Add a case with both menu and split settings disabled and assert the upload button still exists. Click the button and assert `POLYGON_UPLOAD_POPUP_ID` exists; click it again and assert it is gone. Remove the toolbar nodes, dispatch `GO_TO_REFRESH_ACTION`, and assert exactly one upload button is restored.

- [ ] **Step 2: Run the content-script tests and verify RED**

Run: `pnpm vitest run tests/unit/content_scripts/map_go_to.content.test.ts`

Expected: FAIL because no polygon upload button is mounted.

- [ ] **Step 3: Extend toolbar integrity helpers**

Add `uploadCount` and `isUploadSiblingCorrect` to `GoToToolbarMountState`; make `shouldRemountGoToToolbar()` remount for duplicate or misplaced upload buttons. Include `POLYGON_UPLOAD_BUTTON_ID` in `removeAllGoToToolbarButtons()`.

- [ ] **Step 4: Mount and bind the upload button**

In `map-go-to.content.ts`:

- import Task 1 and Task 2 exports;
- add `getPolygonUploadButton()`;
- refresh its translated aria-label in `refreshContentLocale()`;
- create it after the split button when present, otherwise after the service button;
- bind click to `togglePolygonUploadPopup(button)`;
- add hover tooltip using `map.uploadPolygons`;
- include its ID/SVG in `repairToolbarIcons()`;
- include count and sibling correctness in `getGoToToolbarMountState()`.

Change `applyEnabledState()` so toolbar mounting occurs whenever an anchor exists, even if menu and split settings are both false. The existing service button may remain hidden and split may remain removed, but upload remains visible.

- [ ] **Step 5: Wire cleanup and popup exclusivity**

Call `closePolygonUploadPopup()` before opening the go-to menu or split view. Call `teardownPolygonUploadPopup()` from `removeButtonAndMenu()` and content-script teardown. Removing or remounting the toolbar must never leave an orphan popup iframe.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm vitest run tests/unit/content_scripts/map_go_to.content.test.ts tests/unit/polygon_upload_button.test.ts tests/unit/polygon_upload_popup.test.ts && pnpm compile`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 7: Commit**

```bash
git add lib/go_to_toolbar.ts entrypoints/map-go-to.content.ts tests/unit/content_scripts/map_go_to.content.test.ts
git commit -m "feat: integrate polygon upload popup into toolbar"
```

---

### Task 5: Remove the polygons tab from the side panel

**Files:**
- Modify: `entrypoints/panel/App.tsx`
- Modify: `tests/unit/panel_app.test.tsx`

**Interfaces:**
- Produces: side-panel main view that immediately renders `NotesTab`.
- Preserves: header, settings navigation, `OccupiedDatesProvider`, point upload, theme, stroke, reload, split, and go-to settings.

- [ ] **Step 1: Change the panel test first**

Replace the current expectation with:

```tsx
it('сразу показывает заметки без вкладки полигонов', () => {
  render(<App />)

  expect(screen.getByTestId('notes-tab')).toBeDefined()
  expect(screen.queryByTestId('upload-tab')).toBeNull()
  expect(screen.queryByRole('tablist')).toBeNull()
})
```

Keep the existing `PoligonTab` and `TabBar` mocks for the RED run so the failure is limited to the old layout behavior.

- [ ] **Step 2: Run the panel test and verify RED**

Run: `pnpm vitest run tests/unit/panel_app.test.tsx`

Expected: FAIL because the upload tab still renders and notes are hidden.

- [ ] **Step 3: Simplify `App.tsx`**

Remove `TabBar`, `PoligonTab`, `useFileUpload`, `useMemo`, `MainTab`, `activeTab`, and upload-specific callbacks. Keep `useAuth` because the header and point upload still use authentication. In the main view render:

```tsx
{activeView === 'main' && (
  <NotesTab
    isUploading={isPointUploading}
    isLoggedIn={isLoggedIn}
    onRequireAuth={handleRequireAuth}
    onManualUpload={performManualUpload}
  />
)}
```

After `App` no longer imports the removed modules, delete their obsolete mocks from `panel_app.test.tsx`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm vitest run tests/unit/panel_app.test.tsx tests/unit/notes_tab.test.tsx tests/unit/a11y/components.a11y.test.tsx && pnpm compile`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/panel/App.tsx tests/unit/panel_app.test.tsx
git commit -m "refactor: show notes directly in side panel"
```

---

### Task 6: Full verification

**Files:**
- Modify only if verification exposes a regression in files changed by Tasks 1–5.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified distributable extension.

- [ ] **Step 1: Run static checks**

Run: `pnpm compile && pnpm compile:tests && pnpm lint && pnpm lint:css`

Expected: every command exits 0 with no newly introduced diagnostics.

- [ ] **Step 2: Run the complete automated suite**

Run: `pnpm test:run`

Expected: all non-live tests PASS. If the repository intentionally includes environment-gated smoke tests, their documented skips remain unchanged.

- [ ] **Step 3: Build both browser targets**

Run: `pnpm build && pnpm build:firefox`

Expected: both builds exit 0 and each output contains `polygon-upload.html`.

- [ ] **Step 4: Perform focused browser verification**

On `https://n.maps.yandex.ru/` verify:

1. The upload button is immediately right of split-view.
2. The button remains present when go-to and split-view settings are disabled.
3. The popup visually uses the editor style and stays within the viewport.
4. Date selection, file chooser, drag-and-drop, OAuth prompt, progress, success, and errors match the former polygons tab.
5. Re-click, outside click, and Escape close it.
6. Reopening starts with a fresh form.
7. The side panel opens directly on notes and settings still open and close.
8. Light and dark themes remain readable.

- [ ] **Step 5: Commit verification-only fixes if needed**

If verification required changes:

```bash
git add <only-the-files-fixed-during-verification>
git commit -m "fix: polish polygon upload popup"
```

If no changes were required, do not create an empty commit.
