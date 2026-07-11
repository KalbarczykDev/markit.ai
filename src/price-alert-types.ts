import type { D1Database, DurableObjectNamespace } from '@cloudflare/workers-types'

import type { AuthEnv } from './auth'

export type AlertIntervalUnit = 'seconds' | 'minutes'

export type PriceAlertSettings = {
  enabled: boolean
  telegramChatId: string
  intervalValue: number
  intervalUnit: AlertIntervalUnit
}

export type PriceAlertEnv = AuthEnv & {
  OPENAI_API_KEY?: string
  TELEGRAM_BOT_TOKEN?: string
  ALERT_SCHEDULER?: DurableObjectNamespace
}

export type ConfiguredPriceAlertEnv = PriceAlertEnv & {
  DB: D1Database
}

export const DEFAULT_PRICE_ALERT_SETTINGS: PriceAlertSettings = {
  enabled: false,
  telegramChatId: '',
  intervalValue: 15,
  intervalUnit: 'minutes',
}

export function intervalMilliseconds(settings: PriceAlertSettings): number {
  return settings.intervalValue * (settings.intervalUnit === 'seconds' ? 1_000 : 60_000)
}
