import { rand01, valueNoise } from './noise'
import type { Coupon, Merchant, Offer } from './types'

export const EPOCH = Date.UTC(2026, 6, 1)
export const MS_PER_SIM_DAY = 60000

export function currentSimDay(now = Date.now()): number {
  return Math.max(0, Math.floor((now - EPOCH) / MS_PER_SIM_DAY))
}

export function clampDay(day: number): number {
  return Number.isFinite(day) ? Math.max(0, Math.floor(day)) : 0
}

const PROMO_LENGTH_DAYS = 4
const RESTOCK_PERIOD_DAYS = 30
const COUPON_CYCLE_DAYS = 20

function skipsDiscounts(offer: Offer): boolean {
  return offer.trap?.kind === 'bait' || offer.trap?.kind === 'fx-trap'
}

export function promoDiscount(offer: Offer, day: number): number {
  if (skipsDiscounts(offer)) return 0
  const d = clampDay(day)
  const cycle = Math.floor(d / offer.promoCadenceDays)
  const span = Math.max(1, offer.promoCadenceDays - PROMO_LENGTH_DAYS)
  const start = Math.floor(rand01('promo-start', offer.id, cycle) * span)
  const offset = d - cycle * offer.promoCadenceDays
  if (offset < start || offset >= start + PROMO_LENGTH_DAYS) return 0
  return 0.1 + rand01('promo-depth', offer.id, cycle) * 0.15
}

export function flashFactor(offer: Offer, day: number): number {
  if (skipsDiscounts(offer)) return 1
  const d = clampDay(day)
  if (rand01('flash', offer.id, d) >= 0.02) return 1
  return 0.6 + rand01('flash-depth', offer.id, d) * 0.1
}

function driftFactor(offer: Offer, day: number): number {
  const span =
    offer.trap?.kind === 'fx-trap'
      ? 0.015
      : offer.trap?.kind === 'bait'
        ? 0.01
        : 0.08 * offer.volatility
  return 1 + valueNoise(`drift:${offer.id}`, day, 7) * span
}

function roundPrice(value: number): number {
  return Math.max(0.99, Math.round(value) - 0.01)
}

export function priceAt(offer: Offer, day: number): number {
  const d = clampDay(day)
  const raw =
    offer.basePrice * driftFactor(offer, d) * (1 - promoDiscount(offer, d)) * flashFactor(offer, d)
  return roundPrice(raw)
}

export function wasPriceAt(offer: Offer, day: number): number | null {
  const d = clampDay(day)
  if (offer.trap?.kind === 'fake-anchor') return roundPrice(offer.basePrice * offer.trap.factor)
  if (offer.trap?.kind === 'bait') return roundPrice(offer.basePrice * 2.1)
  if (promoDiscount(offer, d) === 0 && flashFactor(offer, d) === 1) return null
  return roundPrice(offer.basePrice * driftFactor(offer, d))
}

export function stockAt(offer: Offer, day: number): number {
  const d = clampDay(day)
  if (offer.trap?.kind === 'bait') return 1 + Math.floor(rand01('bait-stock', offer.id, d) * 2)
  const cycle = Math.floor(d / RESTOCK_PERIOD_DAYS)
  const start = Math.max(
    3,
    Math.round(offer.stockInit * (0.7 + rand01('restock', offer.id, cycle) * 0.6)),
  )
  let sold = 0
  for (let sim = cycle * RESTOCK_PERIOD_DAYS; sim <= d; sim++) {
    const discounted = promoDiscount(offer, sim) > 0 || flashFactor(offer, sim) < 1
    if (rand01('demand', offer.id, sim) < (discounted ? 0.65 : 0.25)) sold++
  }
  return Math.max(0, start - sold)
}

export function couponsAt(offer: Offer, day: number): Coupon[] {
  const d = clampDay(day)
  const cycle = Math.floor(d / COUPON_CYCLE_DAYS)
  if (rand01('coupon-exists', offer.id, cycle) >= 0.35) return []
  const start = cycle * COUPON_CYCLE_DAYS + Math.floor(rand01('coupon-start', offer.id, cycle) * 12)
  const length = 3 + Math.floor(rand01('coupon-length', offer.id, cycle) * 5)
  if (d < start || d >= start + length) return []
  const isPercent = rand01('coupon-type', offer.id, cycle) < 0.6
  const value = isPercent
    ? 5 + Math.floor(rand01('coupon-value', offer.id, cycle) * 11)
    : 5 + Math.floor(rand01('coupon-value', offer.id, cycle) * 16)
  const minBasket =
    rand01('coupon-basket', offer.id, cycle) < 0.4 ? Math.round(offer.basePrice * 1.2) : null
  return [
    {
      code: `${isPercent ? 'SAVE' : 'OFF'}${String(value)}W${String(cycle)}`,
      type: isPercent ? 'percent' : 'fixed',
      value,
      minBasket,
      expiresDay: start + length - 1,
    },
  ]
}

export function shippingCost(merchant: Merchant, sticker: number): number {
  const { flatFee, freeThreshold } = merchant.shipping
  if (freeThreshold !== null && sticker >= freeThreshold) return 0
  return flatFee
}
