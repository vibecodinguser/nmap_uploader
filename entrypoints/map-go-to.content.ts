import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import {
  hideGoToTooltip,
  isElementDescendantToOrEquals,
  queryAllByDomId,
  runWhenAnyElementExists,
  showGoToTooltip,
} from '@/lib/go_to_dom';
import { buildGoToLink, getMapLocationFromUrl } from '@/lib/go_to_link';
import { GO_TO_REFRESH_ACTION } from '@/lib/go_to_notify';
import {
  createGoToServiceButton,
  GO_TO_BUTTON_HIDDEN_CLASS,
  GO_TO_SERVICE_BUTTON_ICON_SVG,
  GO_TO_SERVICE_BUTTON_ID,
} from '@/lib/go_to_service_button';
import {
  GO_TO_ITEMS_STORAGE_KEY,
  GO_TO_MENU_ENABLED_STORAGE_KEY,
  type GoToItem,
  getActiveGoToItems,
  getStoredGoToItems,
  getStoredGoToMenuEnabled,
} from '@/lib/go_to_settings';
import { GO_TO_SOURCES, getGoToSourceDisplayName, getGoToSourceIconUrl } from '@/lib/go_to_sources';
import {
  createSplitViewButton,
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY,
  GO_TO_SPLIT_BUTTON_HIDDEN_CLASS,
  GO_TO_SPLIT_BUTTON_ICON_SVG,
  GO_TO_SPLIT_BUTTON_ID,
  getStoredSplitButtonEnabled,
} from '@/lib/go_to_split_button';
import { isSplitViewOpen, teardownSplitView, toggleSplitView } from '@/lib/go_to_split_view';
import {
  ensureGoToStyles,
  GO_TO_BUTTON_HOVERED_CLASS,
  GO_TO_MENU_ITEM_HOVERED_CLASS,
  GO_TO_POPUP_VISIBLE_CLASS,
} from '@/lib/go_to_styles';
import {
  applyGoToTheme,
  observeGoToTheme,
  refreshGoToThemeFromStorage,
  syncGoToTheme,
} from '@/lib/go_to_theme';
import {
  removeAllGoToToolbarButtons,
  repairAllGoToToolbarIcons,
  shouldRemountGoToToolbar,
} from '@/lib/go_to_toolbar';
import { createTranslator, getStoredLocale, type TranslateFn } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n/locale';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale';

const BUTTON_ANCHOR_SELECTORS = [
  '.nk-map-region-view__button .nk-icon_id_ymaps',
  '.nk-map-region-view__button_id_ymaps',
  '.nk-icon_id_ymaps',
] as const;

const SERVICE_BUTTON_ID = GO_TO_SERVICE_BUTTON_ID;
const SPLIT_BUTTON_ID = GO_TO_SPLIT_BUTTON_ID;
const MENU_ID = 'goToLinksMenu';
const MENU_ITEMS_ID = 'linksItems';

const REGION_BUTTON_CLASSES = [
  'nk-map-region-view__button',
  'nk-map-region-view__button_id_goto',
] as const;

const createGoToMenuElement = (): HTMLElement => {
  const menu = document.createElement('div');
  menu.id = MENU_ID;
  menu.className = 'nmap-uploader-popup';

  const content = document.createElement('div');
  content.className = 'nmap-uploader-popup__content';

  const menuItems = document.createElement('div');
  menuItems.id = MENU_ITEMS_ID;
  menuItems.className = 'nmap-uploader-menu';
  menuItems.tabIndex = 0;
  menuItems.setAttribute('role', 'menu');

  content.appendChild(menuItems);
  menu.appendChild(content);
  applyGoToTheme(menu);
  return menu;
};

const getDocumentRootElement = (): HTMLElement => document.documentElement;

let contentLocale: Locale = 'ru';
let contentTranslator: TranslateFn = createTranslator(contentLocale);

const refreshContentLocale = async (): Promise<void> => {
  contentLocale = await getStoredLocale();
  contentTranslator = createTranslator(contentLocale);
  const splitButton = getSplitButton();
  if (splitButton) {
    const splitViewLabel = contentTranslator('map.splitView');
    splitButton.setAttribute('aria-label', splitViewLabel);
  }
};

const createMenuItemElement = (item: GoToItem, iconUrl: string): HTMLDivElement => {
  const menuItem = document.createElement('div');
  menuItem.id = `goToLink${item.name}`;
  menuItem.className = 'nmap-uploader-menu__item';
  menuItem.setAttribute('role', 'menuitem');
  menuItem.style.backgroundImage = `url("${iconUrl}")`;
  menuItem.textContent = getGoToSourceDisplayName(item.name, contentLocale);
  return menuItem;
};

const getServiceButton = (): HTMLElement | null => document.getElementById(SERVICE_BUTTON_ID);
const getSplitButton = (): HTMLButtonElement | null =>
  document.getElementById(SPLIT_BUTTON_ID) as HTMLButtonElement | null;
const getMenu = (): HTMLElement | null => document.getElementById(MENU_ID);
const getMenuItems = (): HTMLElement | null => document.getElementById(MENU_ITEMS_ID);

let waitForAnchorCleanup: (() => void) | undefined;
let refreshPromise: Promise<void> | undefined;
let isRefreshScheduled = false;

const resolveAnchor = (): Element | null => {
  let anchor: Element | null = null;
  for (const selector of BUTTON_ANCHOR_SELECTORS) {
    if (anchor === null) {
      const found = document.querySelector(selector);
      if (found instanceof Element) {
        anchor = found;
      }
    }
  }

  return anchor;
};

const getButtonInsertParent = (anchor: Element): HTMLElement | null => {
  const parent = anchor.parentElement;
  let insertParent: HTMLElement | null = null;
  if (parent instanceof HTMLElement) {
    insertParent = parent;
  }

  return insertParent;
};

const removeMenu = (): void => {
  const menu = getMenu();
  if (menu) {
    menu.remove();
  }
};

const hideGoToServiceButton = (): void => {
  const button = getServiceButton();
  if (button) {
    button.classList.add(GO_TO_BUTTON_HIDDEN_CLASS);
    button.setAttribute('aria-hidden', 'true');
    for (const className of REGION_BUTTON_CLASSES) {
      button.classList.remove(className);
    }
  }
};

const showGoToServiceButton = (): void => {
  const button = getServiceButton();
  if (button) {
    button.classList.remove(GO_TO_BUTTON_HIDDEN_CLASS);
    button.removeAttribute('aria-hidden');
    for (const className of REGION_BUTTON_CLASSES) {
      button.classList.add(className);
    }
  }
};

const hideSplitButton = (): void => {
  const splitButton = getSplitButton();
  if (splitButton) {
    splitButton.classList.add(GO_TO_SPLIT_BUTTON_HIDDEN_CLASS);
    splitButton.setAttribute('aria-hidden', 'true');
    for (const className of REGION_BUTTON_CLASSES) {
      splitButton.classList.remove(className);
    }
  }
};

const showSplitButton = (): void => {
  const splitButton = getSplitButton();
  if (splitButton) {
    splitButton.classList.remove(GO_TO_SPLIT_BUTTON_HIDDEN_CLASS);
    splitButton.removeAttribute('aria-hidden');
    for (const className of REGION_BUTTON_CLASSES) {
      splitButton.classList.add(className);
    }
  }
};

const removeSplitButton = (): void => {
  teardownSplitView();
  const splitButton = getSplitButton();
  if (splitButton) {
    splitButton.remove();
  }
};

const removeButtonAndMenu = (): void => {
  waitForAnchorCleanup?.();
  waitForAnchorCleanup = undefined;
  hideGoToTooltip();
  removeMenu();
  teardownSplitView();
  removeAllGoToToolbarButtons();
};

const hideGoToMenuOnly = (): void => {
  hideGoToTooltip();
  hideMenu();
  hideGoToServiceButton();
};

const hideButtonAndMenu = (): void => {
  if (waitForAnchorCleanup) {
    waitForAnchorCleanup();
  }
  waitForAnchorCleanup = undefined;
  hideGoToTooltip();
  hideMenu();
  if (isSplitViewOpen()) {
    teardownSplitView();
  }
  hideGoToServiceButton();
  hideSplitButton();
};

const renderMenuItems = (items: GoToItem[]): void => {
  const menuItems = getMenuItems();
  if (menuItems) {
    menuItems.replaceChildren();

    for (const item of getActiveGoToItems(items)) {
      const iconUrl = getGoToSourceIconUrl(item.name);
      const menuItem = createMenuItemElement(item, iconUrl);

      menuItem.addEventListener('mouseover', handleMenuItemMouseOver);
      menuItem.addEventListener('mouseout', handleMenuItemMouseOut);
      menuItem.addEventListener('click', handleMenuItemClick);
      menuItem.addEventListener('auxclick', handleMenuItemAuxClick);
      menuItems.appendChild(menuItem);
    }
  }
};

const ensureMenu = (): void => {
  const menu = getMenu();
  if (!menu) {
    const root = getDocumentRootElement();
    const createdMenu = createGoToMenuElement();
    root.appendChild(createdMenu);
  }
};

const buildMenu = async (): Promise<void> => {
  ensureMenu();
  const items = await getStoredGoToItems();
  renderMenuItems(items);
};

const isButtonMountedInToolbar = (button: HTMLElement, anchor: Element): boolean => {
  const goToServiceButton = getServiceButton();
  let isMounted = false;

  if (goToServiceButton) {
    if (button === goToServiceButton) {
      const insertParent = getButtonInsertParent(anchor);
      isMounted = insertParent?.nextElementSibling === button;
    } else {
      const toolbarSplitButton = getSplitButton();
      if (button === toolbarSplitButton) {
        isMounted = goToServiceButton.nextElementSibling === button;
      }
    }
  }

  return isMounted;
};

const bindSplitButtonEvents = (splitButton: HTMLButtonElement): void => {
  splitButton.addEventListener('click', handleSplitButtonClick);
  splitButton.addEventListener('mouseover', handleSplitButtonMouseOver);
  splitButton.addEventListener('mouseout', handleSplitButtonMouseOut);
};

const isSplitButtonSiblingOf = (
  splitButton: HTMLButtonElement,
  goToServiceButton: HTMLElement,
): boolean => splitButton.previousElementSibling === goToServiceButton;

const removeMisplacedSplitButton = (
  splitButton: HTMLButtonElement,
  goToServiceButton: HTMLElement,
): void => {
  const isCorrectlyPlaced = isSplitButtonSiblingOf(splitButton, goToServiceButton);
  if (!isCorrectlyPlaced) {
    splitButton.remove();
  }
};

const syncSplitButtonState = (splitEnabled: boolean): void => {
  if (splitEnabled) {
    const menuEnabledPromise = getStoredGoToMenuEnabled();
    menuEnabledPromise.then(handleMenuEnabledForSplitSync);
  } else {
    removeSplitButton();
  }
};

const getIsGoToMountedCorrectly = (
  goToServiceButton: HTMLElement | null,
  anchor: Element,
): boolean => {
  let isMountedCorrectly = true;
  if (goToServiceButton) {
    isMountedCorrectly = isButtonMountedInToolbar(goToServiceButton, anchor);
  }

  return isMountedCorrectly;
};

const getIsSplitSiblingCorrect = (
  goToServiceButton: HTMLElement | null,
  splitButtons: HTMLElement[],
): boolean => {
  let isSiblingCorrect = true;
  const firstSplitButton = splitButtons[0];
  if (goToServiceButton && firstSplitButton) {
    isSiblingCorrect = firstSplitButton.previousElementSibling === goToServiceButton;
  }

  return isSiblingCorrect;
};

const createAndBindSplitButton = (goToServiceButton: HTMLElement): void => {
  const splitViewLabel = contentTranslator('map.splitView');
  const splitViewButton = createSplitViewButton(splitViewLabel);
  goToServiceButton.insertAdjacentElement('afterend', splitViewButton);
  const createdSplitButton = getSplitButton();
  if (createdSplitButton) {
    bindSplitButtonEvents(createdSplitButton);
  }
};

const mountSplitButton = (): void => {
  const goToServiceButton = getServiceButton();
  if (goToServiceButton) {
    const existingSplitButton = getSplitButton();
    if (existingSplitButton) {
      removeMisplacedSplitButton(existingSplitButton, goToServiceButton);
    }

    if (getSplitButton() === null) {
      createAndBindSplitButton(goToServiceButton);
    }

    showSplitButton();
  }
};

const getGoToToolbarMountState = (
  anchor: Element,
): Parameters<typeof shouldRemountGoToToolbar>[0] => {
  const goToServiceButtons = queryAllByDomId(GO_TO_SERVICE_BUTTON_ID);
  const splitButtons = queryAllByDomId(GO_TO_SPLIT_BUTTON_ID);
  const goToServiceButton = goToServiceButtons[0] ?? null;

  return {
    goToCount: goToServiceButtons.length,
    splitCount: splitButtons.length,
    isGoToMountedCorrectly: getIsGoToMountedCorrectly(goToServiceButton, anchor),
    isSplitSiblingCorrect: getIsSplitSiblingCorrect(goToServiceButton, splitButtons),
  };
};

const repairToolbarIcons = (): void => {
  repairAllGoToToolbarIcons({
    [GO_TO_SERVICE_BUTTON_ID]: GO_TO_SERVICE_BUTTON_ICON_SVG,
    [GO_TO_SPLIT_BUTTON_ID]: GO_TO_SPLIT_BUTTON_ICON_SVG,
  });
};

const reportGoToMenuBuildError = (error: unknown): void => {
  console.warn('[nmap_uploader] go-to menu build failed:', error);
};

const startBuildMenu = (): void => {
  const buildMenuPromise = buildMenu();
  buildMenuPromise.catch(reportGoToMenuBuildError);
};

const reportContentLocaleRefreshError = (error: unknown): void => {
  console.warn('[nmap_uploader] content locale refresh failed:', error);
};

const startRefreshContentLocale = (): void => {
  const localeRefreshPromise = refreshContentLocale();
  localeRefreshPromise.catch(reportContentLocaleRefreshError);
};

const hideTooltipAfterDelay = (): void => {
  hideGoToTooltip();
};

const isToolbarButtonHoverTarget = (
  button: HTMLElement | null,
  eventTarget: EventTarget | null,
  buttonId: string,
): button is HTMLElement => button !== null && isElementDescendantToOrEquals(eventTarget, buttonId);

const mountToolbar = (anchor: Element, menuEnabled: boolean, splitButtonEnabled: boolean): void => {
  const parent = getButtonInsertParent(anchor);
  if (parent) {
    const toolbarMountState = getGoToToolbarMountState(anchor);
    if (shouldRemountGoToToolbar(toolbarMountState)) {
      removeAllGoToToolbarButtons();
    }

    const existingServiceButton = getServiceButton();

    if (!existingServiceButton) {
      const goToServiceButtonElement = createGoToServiceButton();
      parent.insertAdjacentElement('afterend', goToServiceButtonElement);
      const createdServiceButton = getServiceButton();
      if (createdServiceButton) {
        createdServiceButton.addEventListener('click', handleButtonClick);
        createdServiceButton.addEventListener('mouseover', handleButtonMouseOver);
        createdServiceButton.addEventListener('mouseout', handleButtonMouseOut);
      }
    }

    if (menuEnabled) {
      showGoToServiceButton();
      startBuildMenu();
    } else {
      hideGoToMenuOnly();
    }

    if (splitButtonEnabled) {
      mountSplitButton();
    } else {
      removeSplitButton();
    }

    repairToolbarIcons();
  }
};

const mountToolbarAtAnchor = (menuEnabled: boolean, splitButtonEnabled: boolean): void => {
  const anchor = resolveAnchor();
  if (anchor) {
    mountToolbar(anchor, menuEnabled, splitButtonEnabled);
  }
};

const handleMenuEnabledForSplitSync = (menuEnabled: boolean): void => {
  mountToolbarAtAnchor(menuEnabled, true);
};

const isGoToMenuItemTarget = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && target.id.startsWith('goToLink');

const applyVisibleGoToMenu = (menu: HTMLElement, button: HTMLElement): void => {
  syncGoToTheme();
  menu.classList.add(GO_TO_POPUP_VISIBLE_CLASS);
  const documentRoot = getDocumentRootElement();
  menu.style.bottom = `${documentRoot.clientHeight - button.getBoundingClientRect().top + 10}px`;
  menu.style.left = `${button.getBoundingClientRect().left}px`;
  documentRoot.addEventListener('click', hideMenu, true);
  hideGoToTooltip();
};

const showSplitButtonTooltip = (
  messageKey: 'map.mapLocationError' | 'map.nakarteCompareError',
): void => {
  const splitButton = getSplitButton();
  if (splitButton) {
    const tooltipMessage = contentTranslator(messageKey);
    showGoToTooltip(tooltipMessage, splitButton, 'top');
    window.setTimeout(hideTooltipAfterDelay, 3000);
  }
};

const hideMenu = (event?: Event): void => {
  if (event?.target && isElementDescendantToOrEquals(event.target, SERVICE_BUTTON_ID)) {
    event.stopPropagation();
  }

  const documentRoot = getDocumentRootElement();
  documentRoot.removeEventListener('click', hideMenu, true);
  getMenu()?.classList.remove(GO_TO_POPUP_VISIBLE_CLASS);
  hideGoToTooltip();
};

const showMenu = (): void => {
  const menu = getMenu();
  const button = getServiceButton();
  if (menu && button) {
    if (menu.classList.contains(GO_TO_POPUP_VISIBLE_CLASS)) {
      hideMenu();
    } else {
      const themeRefreshPromise = refreshGoToThemeFromStorage();
      themeRefreshPromise.then(function onGoToThemeRefreshComplete(): void {
        applyVisibleGoToMenu(menu, button);
      });
    }
  }
};

const openGoToLink = (sourceName: string, keepFocus: boolean): void => {
  const source = GO_TO_SOURCES[sourceName];
  const mapLocation = getMapLocationFromUrl(window.location.href);
  if (source && mapLocation) {
    const link = buildGoToLink(source, mapLocation);
    if (link) {
      window.open(link, '_blank');
      if (keepFocus) {
        window.focus();
      } else {
        hideMenu();
      }
    }
  }
};

const getGoToSourceNameFromMenuItemId = (menuItemId: string): string => {
  return menuItemId.replace('goToLink', '');
};

const handleMenuItemClick = (event: MouseEvent): void => {
  const target = event.currentTarget;
  if (isGoToMenuItemTarget(target)) {
    const sourceName = getGoToSourceNameFromMenuItemId(target.id);
    openGoToLink(sourceName, false);
  }
};

const handleMenuItemAuxClick = (event: MouseEvent): void => {
  if (event.button === 1) {
    const target = event.currentTarget;
    if (isGoToMenuItemTarget(target)) {
      event.preventDefault();
      const sourceName = getGoToSourceNameFromMenuItemId(target.id);
      openGoToLink(sourceName, true);
    }
  }
};

const handleButtonClick = (): void => {
  showMenu();
};

const handleSplitButtonClick = (event: MouseEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  hideMenu();

  if (isSplitViewOpen()) {
    toggleSplitView();
  } else {
    const mapLocation = getMapLocationFromUrl(window.location.href);
    if (mapLocation) {
      const splitOpened = toggleSplitView();
      if (!splitOpened) {
        showSplitButtonTooltip('map.nakarteCompareError');
      }
    } else {
      showSplitButtonTooltip('map.mapLocationError');
    }
  }
};

const handleSplitButtonMouseOver = (event: MouseEvent): void => {
  const splitButton = getSplitButton();
  if (isToolbarButtonHoverTarget(splitButton, event.target, SPLIT_BUTTON_ID)) {
    splitButton.classList.add(GO_TO_BUTTON_HOVERED_CLASS);
    const splitViewLabel = contentTranslator('map.splitView');
    showGoToTooltip(splitViewLabel, splitButton, 'top');
  }
};

const handleSplitButtonMouseOut = (event: MouseEvent): void => {
  const splitButton = getSplitButton();
  if (isToolbarButtonHoverTarget(splitButton, event.target, SPLIT_BUTTON_ID)) {
    splitButton.classList.remove(GO_TO_BUTTON_HOVERED_CLASS);
    hideGoToTooltip();
  }
};

const handleButtonMouseOver = (event: MouseEvent): void => {
  const button = getServiceButton();
  if (isToolbarButtonHoverTarget(button, event.target, SERVICE_BUTTON_ID)) {
    button.classList.add(GO_TO_BUTTON_HOVERED_CLASS);
    const externalGeoservicesLabel = contentTranslator('map.externalGeoservices');
    showGoToTooltip(externalGeoservicesLabel, button, 'top');
  }
};

const handleButtonMouseOut = (event: MouseEvent): void => {
  const button = getServiceButton();
  if (isToolbarButtonHoverTarget(button, event.target, SERVICE_BUTTON_ID)) {
    button.classList.remove(GO_TO_BUTTON_HOVERED_CLASS);
    hideGoToTooltip();
  }
};

const handleMenuItemMouseOver = (event: MouseEvent): void => {
  const target = event.currentTarget;
  if (isGoToMenuItemTarget(target)) {
    target.classList.add(GO_TO_MENU_ITEM_HOVERED_CLASS);
  }
};

const handleMenuItemMouseOut = (event: MouseEvent): void => {
  const target = event.currentTarget;
  if (isGoToMenuItemTarget(target)) {
    target.classList.remove(GO_TO_MENU_ITEM_HOVERED_CLASS);
  }
};

const refreshMenuItems = async (): Promise<void> => {
  const menuItems = getMenuItems();
  if (menuItems) {
    const items = await getStoredGoToItems();
    renderMenuItems(items);
  } else {
    await buildMenu();
  }
};

type GoToToolbarSettings = readonly [boolean, boolean];

const loadGoToToolbarSettings = (): Promise<GoToToolbarSettings> => {
  const menuEnabledPromise = getStoredGoToMenuEnabled();
  const splitButtonEnabledPromise = getStoredSplitButtonEnabled();
  return Promise.all([menuEnabledPromise, splitButtonEnabledPromise]);
};

const onToolbarSettingsLoadedForAnchor = (anchor: Element, settings: GoToToolbarSettings): void => {
  mountToolbar(anchor, settings[0], settings[1]);
};

const handleAnchorElementFound = (anchor: Element): void => {
  const toolbarSettingsPromise = loadGoToToolbarSettings();
  toolbarSettingsPromise.then(function onAnchorToolbarSettingsLoaded(
    settings: GoToToolbarSettings,
  ): void {
    onToolbarSettingsLoadedForAnchor(anchor, settings);
  });
};

const waitForAnchorAndMount = (): void => {
  waitForAnchorCleanup?.();
  waitForAnchorCleanup = runWhenAnyElementExists(BUTTON_ANCHOR_SELECTORS, handleAnchorElementFound);
};

const applyEnabledState = async (
  menuEnabled: boolean,
  splitButtonEnabled: boolean,
): Promise<void> => {
  if (menuEnabled || splitButtonEnabled) {
    const anchor = resolveAnchor();
    if (anchor) {
      mountToolbar(anchor, menuEnabled, splitButtonEnabled);
      if (menuEnabled) {
        await refreshMenuItems();
      }
    } else {
      waitForAnchorAndMount();
    }
  } else {
    hideButtonAndMenu();
  }
};

async function refreshGoToEnabledState(): Promise<void> {
  const toolbarSettingsPromise = loadGoToToolbarSettings();
  const [enabled, splitButtonEnabled] = await toolbarSettingsPromise;
  await applyEnabledState(enabled, splitButtonEnabled);
}

const isLocalStorageArea = (area: string): area is 'local' => area === 'local';

const hasGoToRefreshStorageChange = (changes: Record<string, { newValue?: unknown }>): boolean =>
  GO_TO_MENU_ENABLED_STORAGE_KEY in changes ||
  GO_TO_ITEMS_STORAGE_KEY in changes ||
  GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes;

const reportGoToRefreshError = (error: unknown): void => {
  console.warn('[nmap_uploader] go-to menu refresh failed:', error);
};

type GoToContentScriptTeardownContext = {
  cleanupThemeObserver: () => void;
  handleVisibilityChange: () => void;
  handlePageShow: (event: PageTransitionEvent) => void;
  storageOnChanged: typeof browser.storage.onChanged;
  runtimeOnMessage: typeof browser.runtime.onMessage;
  handleStorageChange: (changes: Record<string, { newValue?: unknown }>, area: string) => void;
  handleRuntimeMessage: (message: { action?: string }) => void;
};

let goToContentScriptTeardownContext: GoToContentScriptTeardownContext | undefined;

const teardownGoToContentScript = (): void => {
  const context = goToContentScriptTeardownContext;
  if (context) {
    context.cleanupThemeObserver();
    document.removeEventListener('visibilitychange', context.handleVisibilityChange);
    window.removeEventListener('pageshow', context.handlePageShow);
    context.storageOnChanged.removeListener(context.handleStorageChange);
    context.runtimeOnMessage.removeListener(context.handleRuntimeMessage);
    removeButtonAndMenu();
  }
};

const handleGoToContentScriptInvalidated = (): void => {
  teardownGoToContentScript();
};

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
  matches: ['https://n.maps.yandex.ru/*'],
  runAt: 'document_idle',

  main(ctx) {
    ensureGoToStyles();
    const cleanupThemeObserver = observeGoToTheme();
    startRefreshContentLocale();

    const runRefresh = async (): Promise<void> => {
      let shouldRunRefresh = true;

      if (refreshPromise) {
        isRefreshScheduled = true;
        await refreshPromise;
        shouldRunRefresh = isRefreshScheduled;
      }

      if (shouldRunRefresh) {
        isRefreshScheduled = false;
        refreshPromise = refreshGoToEnabledState();

        try {
          await refreshPromise;
        } finally {
          refreshPromise = undefined;
          if (isRefreshScheduled) {
            startRunRefresh();
          }
        }
      }
    };

    const startRunRefresh = (): void => {
      const refreshTask = runRefresh();
      refreshTask.catch(reportGoToRefreshError);
    };

    startRunRefresh();

    const scheduleRefresh = (): void => {
      isRefreshScheduled = true;
      startRunRefresh();
    };

    const handlePageResume = (): void => {
      repairToolbarIcons();
      scheduleRefresh();
    };

    const handleVisibilityChange = (): void => {
      if ('visible' === document.visibilityState) {
        handlePageResume();
      }
    };

    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) {
        handlePageResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    const handleLocaleRefreshScheduled = (): void => {
      scheduleRefresh();
    };

    const handleMenuEnabledStorageChange = (
      nextMenuEnabled: boolean,
      splitButtonEnabled: boolean,
    ): void => {
      mountToolbarAtAnchor(nextMenuEnabled, splitButtonEnabled);
    };

    const onMenuEnabledStorageLoaded = function onMenuEnabledStorageLoaded(
      nextMenuEnabled: boolean,
      splitButtonEnabled: boolean,
    ): void {
      handleMenuEnabledStorageChange(nextMenuEnabled, splitButtonEnabled);
    };

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ): void => {
      if (isLocalStorageArea(area)) {
        if (GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY in changes) {
          const nextSplitEnabled = changes[GO_TO_SPLIT_BUTTON_ENABLED_STORAGE_KEY]?.newValue;
          if (typeof nextSplitEnabled === 'boolean') {
            syncSplitButtonState(nextSplitEnabled);
          }
        }

        if (LOCALE_STORAGE_KEY in changes) {
          const localeRefreshPromise = refreshContentLocale();
          localeRefreshPromise.then(handleLocaleRefreshScheduled);
        }

        if (GO_TO_MENU_ENABLED_STORAGE_KEY in changes) {
          const nextMenuEnabled = changes[GO_TO_MENU_ENABLED_STORAGE_KEY]?.newValue;
          if (typeof nextMenuEnabled === 'boolean') {
            const splitButtonEnabledPromise = getStoredSplitButtonEnabled();
            splitButtonEnabledPromise.then(function onSplitButtonEnabledLoaded(
              splitButtonEnabled: boolean,
            ): void {
              onMenuEnabledStorageLoaded(nextMenuEnabled, splitButtonEnabled);
            });
          }
        }

        if (hasGoToRefreshStorageChange(changes)) {
          scheduleRefresh();
        }
      }
    };

    const onRuntimeToolbarSettingsLoaded = function onRuntimeToolbarSettingsLoaded(
      settings: GoToToolbarSettings,
    ): void {
      mountToolbarAtAnchor(settings[0], settings[1]);
    };

    const handleRuntimeMessage = (message: { action?: string }): void => {
      if (message?.action === GO_TO_REFRESH_ACTION) {
        const toolbarSettingsPromise = loadGoToToolbarSettings();
        toolbarSettingsPromise.then(onRuntimeToolbarSettingsLoaded);
        scheduleRefresh();
      }
    };

    const storageOnChanged = browser.storage.onChanged;
    const runtimeOnMessage = browser.runtime.onMessage;
    storageOnChanged.addListener(handleStorageChange);
    runtimeOnMessage.addListener(handleRuntimeMessage);

    goToContentScriptTeardownContext = {
      cleanupThemeObserver,
      handleVisibilityChange,
      handlePageShow,
      storageOnChanged,
      runtimeOnMessage,
      handleStorageChange,
      handleRuntimeMessage,
    };

    ctx.onInvalidated(handleGoToContentScriptInvalidated);
  },
});
