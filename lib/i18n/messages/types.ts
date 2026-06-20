export interface InterpolationParams {
  [paramName: string]: string | number
}

export type Messages = {
  locale: {
    label: string
    ru: string
    en: string
  }
  common: {
    back: string
    apply: string
    upload: string
    uploading: string
    sending: string
    settings: string
    version: string
    list: string
    accessDenied: string
    unknownError: string
    invalidDateFormat: string
  }
  header: {
    logout: string
    login: string
    loggingIn: string
    loginAria: string
  }
  tabs: {
    polygons: string
    points: string
    inputModeAria: string
    openSettingsAria: string
    backToUploadAria: string
  }
  points: {
    manualEntry: string
    batchUpload: string
    modeAria: string
    manualSectionAria: string
    batchSectionAria: string
    descriptionPlaceholder: string
    descriptionAria: string
    latitude: string
    longitude: string
    manualHint: string
    batchHint: string
    coordinatesMissing: string
    coordinatesOutOfRange: string
    pointUploadError: string
    pointsUploadError: string
    preparingPoint: string
    noFilesSelected: string
    onlyTxtAllowed: string
    noPointsInFiles: string
    pointsNotFound: string
    pointsCount: string
  }
  dateField: {
    label: string
    placeholder: string
    openCalendarAria: string
    calendarAria: string
    loadingDates: string
    occupiedLegend: string
  }
  upload: {
    dropzoneAria: string
    dropzoneTitle: string
    dropzoneSubtitleLine1: string
    dropzoneSubtitleLine2: string
    chooseFile: string
    progressAria: string
    uploadError: string
    unsupportedFormat: string
    processing: string
    converted: string
    uploadComplete: string
    uploadCompleteSummary: string
    noDataToUpload: string
    authRequired: string
    checkingDiskAccess: string
    checkingFolders: string
    foldersReady: string
    diskAccessError: string
    loadingIndex: string
    indexLoaded: string
    indexCreated: string
    indexLoadError: string
    uploadingToNotebook: string
    indexUploaded: string
    saveError: string
    authDiskRequired: string
    sessionExpired: string
  }
  settings: {
    title: string
    appearance: string
    themeAria: string
    themeDark: string
    themeLight: string
    themeSystem: string
    splitViewButton: string
    splitViewAria: string
    goToButton: string
    showButtonAria: string
    activeCount: string
    goToHint: string
    goToListAria: string
    showInMenuAria: string
    moveUpAria: string
    moveDownAria: string
    reloadAfterUpload: string
    reloadAfterUploadAria: string
    strokeColor: string
    pickStrokeColorAria: string
    strokeColorApplied: string
    strokeColorApplyError: string
    strokeColorValidation: string
    languageAria: string
  }
  auth: {
    authError: string
    authCancelled: string
    folderReadError: string
    uploadError: string
  }
  map: {
    splitView: string
    externalGeoservices: string
    mapLocationError: string
    nakarteCompareError: string
  }
  goToSources: {
    Rosreestr: string
  }
  background: {
    mapPageLoadTimeout: string
    openMapFailed: string
    openMapAndRetry: string
    openPanelFailed: string
    tabNotFound: string
  }
}

export type MessageKey = {
  [K in keyof Messages]: {
    [P in keyof Messages[K]]: `${K & string}.${P & string}`
  }[keyof Messages[K]]
}[keyof Messages]
