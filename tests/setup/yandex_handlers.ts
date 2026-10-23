import { yandexAuthHandlers } from './yandex_auth_handlers'
import { yandexResourceHandlers } from './yandex_resource_handlers'
import { yandexTransferHandlers } from './yandex_transfer_handlers'

export * from './yandex_auth_handlers'
export * from './yandex_mock_state'
export * from './yandex_resource_handlers'
export * from './yandex_transfer_handlers'

export const yandexHandlers = [
  ...yandexAuthHandlers,
  ...yandexResourceHandlers,
  ...yandexTransferHandlers,
]
