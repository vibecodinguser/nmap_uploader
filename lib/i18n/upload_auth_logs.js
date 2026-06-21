/* jshint esversion: 11, module: true */
/* exported hasUploadAuthErrorInLogs, sessionInvalidMarkers */

export const sessionInvalidMarkers = [
  'сессия недействительна',
  'Выйдите и войдите',
  'session is invalid',
  'Sign out and sign in',
]

const messageIncludesAuthErrorMarker = (lowerMessage, marker) => {
  const lowerMarker = marker.toLowerCase()
  return lowerMessage.includes(lowerMarker)
}

const logHasAuthErrorMarker = (message) => {
  const lowerMessage = message.toLowerCase()
  const includesMarker = messageIncludesAuthErrorMarker.bind(undefined, lowerMessage)
  return sessionInvalidMarkers.some(includesMarker)
}

// noinspection JSUnusedGlobalSymbols
export function hasUploadAuthErrorInLogs(messages) {
  return messages.some(logHasAuthErrorMarker)
}
