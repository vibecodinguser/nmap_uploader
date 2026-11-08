/**
 * Общие типы и идентификаторы панели трекера объектов.
 */

import type { ObjectCommit, TrackedObject } from '../types'

export const TRACKER_TAB_ID = 'nmap-uploader-object-tracker-tab'
export const TRACKER_PANEL_ID = 'nmap-uploader-object-tracker-panel'
export const TRACKER_STYLES_ID = 'nmap-uploader-object-tracker-styles'

export const MODES_SELECTION_CLASS = 'nmap-ot-modes__selection'

export type TrackerViewMode = 'feed' | 'objects'

export interface TrackerViewModel {
  mode: TrackerViewMode
  objects: TrackedObject[]
  commitsByObject: Record<string, ObjectCommit[]>
  /** id коммитов, которые пользователь ещё не видел. */
  newCommitIds: ReadonlySet<string>
  errors: Record<string, string>
  isLoading: boolean
  hasToken: boolean
  intervalMinutes: number
}

export interface PanelCallbacks {
  onAddObject: (objectId: string) => void
  onRemoveObject: (objectId: string) => void
  onModeChange: (mode: TrackerViewMode) => void
  onRefresh: () => void
  onMarkAllRead: () => void
}
