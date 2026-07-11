import type { DurableObjectState } from '@cloudflare/workers-types'
import { z } from 'zod'

import {
  intervalMilliseconds,
  type ConfiguredPriceAlertEnv,
  type PriceAlertSettings,
} from './price-alert-types'
import { getPriceAlertSettings } from './price-alerts'

const scheduleSchema = z.object({
  userId: z.string().min(1),
  settings: z.object({
    enabled: z.boolean(),
    telegramChatId: z.string(),
    intervalValue: z.number().int().positive(),
    intervalUnit: z.enum(['seconds', 'minutes']),
  }),
})

const searchResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['found', 'unavailable']),
      currentPrice: z.number().nonnegative().nullable(),
      currency: z.string().length(3).nullable(),
    }),
  ),
})

type ListingRow = {
  id: string
  title: string
  url: string
  price: string | null
  alert_price_value: number | null
  alert_currency: string | null
}

type PriceResult = z.infer<typeof searchResultSchema>['results'][number]

function initialPrice(price: string | null): { value: number; currency: string } | null {
  if (!price) return null
  const match = price.replaceAll(',', '').match(/(?:([A-Z]{3})\s*)?([$€£])?\s*(\d+(?:\.\d{1,2})?)/i)
  if (!match?.[3]) return null
  const symbolCurrency: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP' }
  const currency = match[1]?.toUpperCase() ?? (match[2] ? symbolCurrency[match[2]] : undefined)
  const value = Number(match[3])
  return currency && Number.isFinite(value) ? { value, currency } : null
}

function outputText(response: unknown): string | null {
  if (!response || typeof response !== 'object' || !('output' in response)) return null
  const output = (response as { output?: unknown }).output
  if (!Array.isArray(output)) return null
  for (const item of output) {
    if (!item || typeof item !== 'object' || !('content' in item)) continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
        return part.text
      }
    }
  }
  return null
}

async function researchPrices(
  listings: ListingRow[],
  apiKey: string,
): Promise<Map<string, PriceResult>> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': 'markit-price-alerts',
    },
    body: JSON.stringify({
      model: 'gpt-5.6-terra',
      tools: [{ type: 'web_search', search_context_size: 'low' }],
      tool_choice: 'required',
      input: [
        {
          role: 'system',
          content:
            'Check each supplied product URL using live web search. Return only a currently advertised item price, not shipping, coupons, installment amounts, list prices, or prices for another variant. Mark unavailable when current evidence is insufficient. Currency must be ISO 4217.',
        },
        {
          role: 'user',
          content: JSON.stringify(
            listings.map(({ id, title, url }) => ({ id, title, productUrl: url })),
          ),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'current_product_prices',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: { type: 'string', enum: ['found', 'unavailable'] },
                    currentPrice: { type: ['number', 'null'] },
                    currency: { type: ['string', 'null'] },
                  },
                  required: ['id', 'status', 'currentPrice', 'currency'],
                  additionalProperties: false,
                },
              },
            },
            required: ['results'],
            additionalProperties: false,
          },
        },
      },
    }),
  })
  if (!response.ok) throw new Error('Price research failed')
  const text = outputText(await response.json())
  if (!text) throw new Error('Price research returned no result')
  const parsed = searchResultSchema.parse(JSON.parse(text))
  return new Map(parsed.results.map((result) => [result.id, result]))
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function sendTelegram(token: string, chatId: string, message: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  })
  if (!response.ok) throw new Error('Telegram delivery failed')
}

async function checkSavedListings(
  env: ConfiguredPriceAlertEnv,
  userId: string,
  settings: PriceAlertSettings,
): Promise<void> {
  if (!env.OPENAI_API_KEY || !env.TELEGRAM_BOT_TOKEN) return
  const query = await env.DB.prepare(
    `SELECT id, title, url, price, alert_price_value, alert_currency
     FROM favorite_listing WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20`,
  )
    .bind(userId)
    .all<ListingRow>()
  if (!query.results.length) return

  const researched = await researchPrices(query.results, env.OPENAI_API_KEY)
  const updates: Array<{ id: string; price: number; currency: string }> = []
  const drops: string[] = []

  for (const listing of query.results) {
    const result = researched.get(listing.id)
    if (result?.status !== 'found' || result.currentPrice === null || !result.currency) continue
    const baseline =
      listing.alert_price_value !== null && listing.alert_currency
        ? { value: listing.alert_price_value, currency: listing.alert_currency }
        : initialPrice(listing.price)
    if (baseline && baseline.currency === result.currency && result.currentPrice < baseline.value) {
      drops.push(
        `<b>${escapeHtml(listing.title)}</b>\n${escapeHtml(baseline.currency)} ${baseline.value.toFixed(2)} → <b>${escapeHtml(result.currency)} ${result.currentPrice.toFixed(2)}</b>\n<a href="${escapeHtml(listing.url)}">View listing</a>`,
      )
    }
    updates.push({ id: listing.id, price: result.currentPrice, currency: result.currency })
  }

  if (drops.length) {
    await sendTelegram(
      env.TELEGRAM_BOT_TOKEN,
      settings.telegramChatId,
      `📉 <b>Markit price drop${drops.length === 1 ? '' : 's'}</b>\n\n${drops.join('\n\n').slice(0, 3_800)}`,
    )
  }
  await Promise.all(
    updates.map((update) =>
      env.DB.prepare(
        `UPDATE favorite_listing SET alert_price_value = ?, alert_currency = ?, alert_checked_at = ?
         WHERE id = ? AND user_id = ?`,
      )
        .bind(update.price, update.currency, Date.now(), update.id, userId)
        .run(),
    ),
  )
}

export class PriceAlertScheduler {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: ConfiguredPriceAlertEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== '/schedule' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 })
    }
    const { userId, settings } = scheduleSchema.parse(await request.json())
    if (!settings.enabled) {
      await this.state.storage.deleteAlarm()
      await this.state.storage.deleteAll()
      return Response.json({ scheduled: false })
    }
    await this.state.storage.put('userId', userId)
    await this.state.storage.put('interval', intervalMilliseconds(settings))
    await this.state.storage.setAlarm(Date.now() + intervalMilliseconds(settings))
    return Response.json({ scheduled: true })
  }

  async alarm(): Promise<void> {
    const userId = await this.state.storage.get<string>('userId')
    if (!userId) return
    try {
      const settings = await getPriceAlertSettings(this.env.DB, userId)
      if (!settings.enabled) {
        await this.state.storage.deleteAll()
        return
      }
      await checkSavedListings(this.env, userId, settings)
      await this.state.storage.put('interval', intervalMilliseconds(settings))
    } finally {
      const interval = await this.state.storage.get<number>('interval')
      if (interval) await this.state.storage.setAlarm(Date.now() + interval)
    }
  }
}
