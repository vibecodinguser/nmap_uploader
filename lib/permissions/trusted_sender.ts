import { isTrustedPanelSender, type RuntimeMessageSender } from '@/lib/message_auth'

/**
 * Можно ли отвечать на запрос разрешений от этого отправителя.
 *
 * Просит только страница расширения (панель, отдельная вкладка) — сюда не
 * могут попасть заметки с карты или чужой сайт: скрипт ставится лишь на
 * `n.maps.yandex.ru`, но `runtime.sendMessage` из страницы карты пришёл бы
 * от её собственного контент-скрипта, а не от панели.
 */
export const isTrustedPermissionSender = (sender: RuntimeMessageSender): boolean =>
  isTrustedPanelSender(sender)
