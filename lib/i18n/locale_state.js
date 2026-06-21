/* jshint esversion: 11, module: true */
/* exported getRuntimeLocale, setRuntimeLocale */

import { DEFAULT_LOCALE } from './locale'

let runtimeLocale = DEFAULT_LOCALE

// noinspection JSUnusedGlobalSymbols
export function getRuntimeLocale() {
  return runtimeLocale
}

// noinspection JSUnusedGlobalSymbols
export function setRuntimeLocale(locale) {
  runtimeLocale = locale
}
