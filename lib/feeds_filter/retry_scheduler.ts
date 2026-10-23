import { STARTUP_RETRY_DELAYS_MS } from './lifecycle_config'

export interface RetrySchedulerOptions {
  onRetry: () => void
  onHeartbeatTick: () => void
  heartbeatIntervalMs?: number
}

export interface RetrySchedulerController {
  start: () => void
  stop: () => void
}

/**
 * Планировщик повторных попыток монтирования фильтра ленты при старте и интервального heartbeat.
 */
export const createRetryScheduler = ({
  onRetry,
  onHeartbeatTick,
  heartbeatIntervalMs = 1000,
}: RetrySchedulerOptions): RetrySchedulerController => {
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let startupTimeouts: ReturnType<typeof setTimeout>[] = []

  const start = (): void => {
    startupTimeouts = STARTUP_RETRY_DELAYS_MS.map((delay) => {
      return setTimeout(() => {
        onRetry()
      }, delay)
    })

    heartbeatTimer = setInterval(() => {
      onHeartbeatTick()
    }, heartbeatIntervalMs)
  }

  const stop = (): void => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }

    for (const timeoutId of startupTimeouts) {
      clearTimeout(timeoutId)
    }
    startupTimeouts = []
  }

  return {
    start,
    stop,
  }
}
