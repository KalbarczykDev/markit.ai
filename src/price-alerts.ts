import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'

import { createAuth } from './auth'
import {
  DEFAULT_PRICE_ALERT_SETTINGS,
  type PriceAlertEnv,
  type PriceAlertSettings,
} from './price-alert-types'

const settingsSchema = z
  .object({
    enabled: z.boolean(),
    telegramChatId: z.string().trim().max(20),
    intervalValue: z.number().int().min(1).max(10_080),
    intervalUnit: z.enum(['seconds', 'minutes']),
  })
  .superRefine((settings, context) => {
    if (settings.enabled && !/^-?\d{5,20}$/.test(settings.telegramChatId)) {
      context.addIssue({
        code: 'custom',
        path: ['telegramChatId'],
        message: 'Enter a numeric Telegram chat ID.',
      })
    }
    if (settings.intervalUnit === 'seconds' && settings.intervalValue < 30) {
      context.addIssue({
        code: 'custom',
        path: ['intervalValue'],
        message: 'Second-based checks must be at least 30 seconds apart.',
      })
    }
  })

async function ensurePriceAlertSchema(database: D1Database): Promise<void> {
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS price_alert_setting (
        user_id text PRIMARY KEY NOT NULL,
        enabled integer DEFAULT 0 NOT NULL,
        telegram_chat_id text NOT NULL,
        interval_value integer DEFAULT 15 NOT NULL,
        interval_unit text DEFAULT 'minutes' NOT NULL CHECK (interval_unit IN ('seconds', 'minutes')),
        created_at integer NOT NULL,
        updated_at integer NOT NULL,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
      )`,
    )
    .run()
  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS price_alert_listing_state (
        listing_id text PRIMARY KEY NOT NULL,
        user_id text NOT NULL,
        price_value real NOT NULL,
        currency text NOT NULL,
        checked_at integer NOT NULL,
        FOREIGN KEY (listing_id) REFERENCES favorite_listing(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
      )`,
    )
    .run()
  await database
    .prepare(
      `CREATE INDEX IF NOT EXISTS price_alert_listing_state_user_idx
       ON price_alert_listing_state(user_id)`,
    )
    .run()
}

export async function getPriceAlertSettings(
  database: D1Database,
  userId: string,
): Promise<PriceAlertSettings> {
  const row = await database
    .prepare(
      `SELECT enabled, telegram_chat_id, interval_value, interval_unit
       FROM price_alert_setting WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{
      enabled: number
      telegram_chat_id: string
      interval_value: number
      interval_unit: 'seconds' | 'minutes'
    }>()

  if (!row) return DEFAULT_PRICE_ALERT_SETTINGS
  return {
    enabled: row.enabled === 1,
    telegramChatId: row.telegram_chat_id,
    intervalValue: row.interval_value,
    intervalUnit: row.interval_unit,
  }
}

async function savePriceAlertSettings(
  database: D1Database,
  userId: string,
  settings: PriceAlertSettings,
): Promise<void> {
  const now = Date.now()
  await database
    .prepare(
      `INSERT INTO price_alert_setting
        (user_id, enabled, telegram_chat_id, interval_value, interval_unit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         enabled = excluded.enabled,
         telegram_chat_id = excluded.telegram_chat_id,
         interval_value = excluded.interval_value,
         interval_unit = excluded.interval_unit,
         updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      settings.enabled ? 1 : 0,
      settings.telegramChatId,
      settings.intervalValue,
      settings.intervalUnit,
      now,
      now,
    )
    .run()
}

async function updateSchedule(env: PriceAlertEnv, userId: string, settings: PriceAlertSettings) {
  if (!env.ALERT_SCHEDULER) {
    if (settings.enabled) throw new Error('Price alert scheduling is not configured.')
    return
  }
  const scheduler = env.ALERT_SCHEDULER.get(env.ALERT_SCHEDULER.idFromName(userId))
  const response = await scheduler.fetch('https://price-alerts.internal/schedule', {
    method: 'POST',
    body: JSON.stringify({ userId, settings }),
  })
  if (!response.ok) throw new Error('Price alert scheduling could not be updated.')
}

export async function handlePriceAlertsRequest(request: Request, env: PriceAlertEnv) {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return Response.json({ message: 'Method not allowed.' }, { status: 405 })
  }
  if (!env.DB)
    return Response.json({ message: 'Price alerts are not configured.' }, { status: 503 })

  const auth = createAuth(request, env)
  const session = auth ? await auth.api.getSession({ headers: request.headers }) : null
  if (!session?.user) {
    return Response.json({ message: 'Log in to manage price alerts.' }, { status: 401 })
  }

  await ensurePriceAlertSchema(env.DB)

  if (request.method === 'GET') {
    return Response.json({ settings: await getPriceAlertSettings(env.DB, session.user.id) })
  }
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ message: 'Origin not allowed.' }, { status: 403 })
  }

  try {
    const settings = settingsSchema.parse(await request.json())
    if (settings.enabled && (!env.OPENAI_API_KEY || !env.TELEGRAM_BOT_TOKEN)) {
      return Response.json({ message: 'Price alert delivery is not configured.' }, { status: 503 })
    }
    await updateSchedule(env, session.user.id, settings)
    await savePriceAlertSettings(env.DB, session.user.id, settings)
    return Response.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Price alert settings are invalid.'
    return Response.json({ message }, { status: 400 })
  }
}
