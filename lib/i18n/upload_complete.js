/* jshint esversion: 11, module: true */
/* exported getUploadCompletePrefixes, isUploadCompleteMessage */

import { createTranslator } from '@/lib/i18n/translate'

const getUploadCompletePrefix = (locale) => {
  const translate = createTranslator(locale)
  const summary = translate('upload.uploadCompleteSummary')
  const parts = summary.split(':')
  return parts[0] ?? ''
}

// noinspection JSUnusedGlobalSymbols
export function getUploadCompletePrefixes(locale) {
  return [getUploadCompletePrefix(locale), getUploadCompletePrefix('ru')]
}

const messageMatchesUploadCompletePrefix = (message, prefix) => {
  const expectedPrefix = `${prefix}:`
  return Boolean(prefix) && message.startsWith(expectedPrefix)
}

// noinspection JSUnusedGlobalSymbols
export function isUploadCompleteMessage(message, locale) {
  const prefixes = getUploadCompletePrefixes(locale)
  const matcher = messageMatchesUploadCompletePrefix.bind(undefined, message)
  return prefixes.some(matcher)
}
