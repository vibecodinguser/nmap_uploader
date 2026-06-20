/// <reference path="../shims.d.ts" />
/* jshint esversion: 11, module: true */
/* exported getStoredLocale, setStoredLocale, syncLocaleFromStorage */
// @ts-check

import { browser as wxtBrowser } from 'wxt/browser';
import { isLocale, LOCALE_STORAGE_KEY, localeFromUiLanguage } from './locale';
import { setRuntimeLocale } from './locale_state';

/** @type {import('wxt/browser').Browser} */
const browser = wxtBrowser;

// noinspection JSUnusedGlobalSymbols
export async function getStoredLocale() {
  const stored = await browser.storage.local.get(LOCALE_STORAGE_KEY);
  const value = stored[LOCALE_STORAGE_KEY];
  let locale;
  if (isLocale(value)) {
    locale = value;
  } else {
    const uiLanguage = browser.i18n.getUILanguage();
    locale = localeFromUiLanguage(uiLanguage);
    await browser.storage.local.set({ [LOCALE_STORAGE_KEY]: locale });
  }
  return locale;
}

// noinspection JSUnusedGlobalSymbols
export async function setStoredLocale(locale) {
  setRuntimeLocale(locale);
  await browser.storage.local.set({ [LOCALE_STORAGE_KEY]: locale });
}

// noinspection JSUnusedGlobalSymbols
export async function syncLocaleFromStorage() {
  const locale = await getStoredLocale();
  setRuntimeLocale(locale);
  return locale;
}
