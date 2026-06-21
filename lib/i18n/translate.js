/* jshint esversion: 11, module: true */
/* exported createTranslator, getGoToSourceDisplayName */

import { enMessages } from './messages/en'
import { ruMessages } from './messages/ru'

const messagesByLocale = {
  ru: ruMessages,
  en: enMessages,
}

const readMessageField = (section, fieldName) => {
  let field
  if (Object.hasOwn(section, fieldName)) {
    const value = Reflect.get(section, fieldName)
    if (typeof value === 'string') {
      field = value
    }
  }
  return field
}

const getNestedMessage = (messages, key) => {
  const dotIndex = key.indexOf('.')
  const sectionName = key.slice(0, dotIndex)
  const fieldName = key.slice(dotIndex + 1)
  if (!Object.hasOwn(messages, sectionName)) {
    throw new Error(`Missing i18n message: ${key}`)
  }
  const section = Reflect.get(messages, sectionName)
  if (typeof section !== 'object' || section === null) {
    throw new Error(`Missing i18n message: ${key}`)
  }
  const field = readMessageField(section, fieldName)
  if (field === undefined) {
    throw new Error(`Missing i18n message: ${key}`)
  }
  return field
}

const replaceInterpolationParam = (params, _match, key) => {
  const value = params[key]
  let replacement
  if (value === undefined) {
    replacement = `{${key}}`
  } else {
    replacement = String(value)
  }
  return replacement
}

const interpolate = (template, params) => {
  let result = template
  if (params) {
    const replacer = replaceInterpolationParam.bind(undefined, params)
    result = template.replace(/\{(\w+)}/g, replacer)
  }
  return result
}

const translateWithMessages = (messages, key, params) => {
  const message = getNestedMessage(messages, key)
  return interpolate(message, params)
}

function translateRuMessages(key, params) {
  return translateWithMessages(ruMessages, key, params)
}

function translateEnMessages(key, params) {
  return translateWithMessages(enMessages, key, params)
}

const translatorsByLocale = {
  ru: translateRuMessages,
  en: translateEnMessages,
}

// noinspection JSUnusedGlobalSymbols
export function createTranslator(locale) {
  return translatorsByLocale[locale]
}

// noinspection JSUnusedGlobalSymbols
export function getGoToSourceDisplayName(name, locale) {
  const sourceNames = messagesByLocale[locale].goToSources
  const localized = readMessageField(sourceNames, name)
  return localized ?? name
}
