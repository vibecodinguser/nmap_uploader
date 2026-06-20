export type { Locale } from '@/lib/i18n/locale.types'
export type { InterpolationParams, MessageKey, Messages } from '@/lib/i18n/messages/types'

import type { InterpolationParams, MessageKey } from '@/lib/i18n/messages/types'

export type TranslateFn = (key: MessageKey, params?: InterpolationParams) => string
