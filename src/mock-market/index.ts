import { MERCHANT_BY_ID, OFFER_BY_ID, OFFERS_BY_PRODUCT, PRODUCTS } from './catalog'
import { fxRate } from './fx'
import {
  clampDay,
  couponsAt,
  currentSimDay,
  priceAt,
  shippingCost,
  stockAt,
  wasPriceAt,
} from './simulator'
import type {
  Currency,
  GroundTruth,
  Offer,
  OfferWithQuote,
  PricePoint,
  ProductSearchResult,
  Quote,
} from './types'

export { currentSimDay, EPOCH, MS_PER_SIM_DAY } from './simulator'
export type * from './types'

function toQuote(offer: Offer, day: number): Quote {
  const merchant = MERCHANT_BY_ID.get(offer.merchantId)
  if (!merchant) throw new Error(`catalog invariant: unknown merchant ${offer.merchantId}`)
  const sticker = priceAt(offer, day)
  return {
    offerId: offer.id,
    productId: offer.productId,
    merchantId: offer.merchantId,
    day,
    sticker,
    currency: merchant.currency,
    wasPrice: wasPriceAt(offer, day),
    stock: stockAt(offer, day),
    activeCoupons: couponsAt(offer, day),
    shippingCost: shippingCost(merchant, sticker),
    merchant: {
      name: merchant.name,
      country: merchant.country,
      rating: merchant.rating,
      accountAgeDays: merchant.accountAgeDays,
      returnPolicy: merchant.returnPolicy,
    },
  }
}

export function getQuote(offerId: string, day = currentSimDay()): Quote | undefined {
  const offer = OFFER_BY_ID.get(offerId)
  if (!offer) return undefined
  return toQuote(offer, clampDay(day))
}

export function getOffers(productId: string, day = currentSimDay()): OfferWithQuote[] {
  const offers = OFFERS_BY_PRODUCT.get(productId) ?? []
  const d = clampDay(day)
  return offers.map((offer) => ({
    offer: {
      id: offer.id,
      merchantId: offer.merchantId,
      productId: offer.productId,
      listingTitle: offer.listingTitle,
    },
    quote: toQuote(offer, d),
  }))
}

export function getPriceHistory(offerId: string, fromDay: number, toDay: number): PricePoint[] {
  const offer = OFFER_BY_ID.get(offerId)
  if (!offer) return []
  const from = clampDay(fromDay)
  const to = clampDay(toDay)
  if (from > to) return []
  const points: PricePoint[] = []
  for (let day = from; day <= to; day++) {
    points.push({ day, sticker: priceAt(offer, day), stock: stockAt(offer, day) })
  }
  return points
}

export function getFxRates(day = currentSimDay()): Record<Currency, number> {
  const d = clampDay(day)
  return { EUR: 1, GBP: fxRate('GBP', d), USD: fxRate('USD', d), PLN: fxRate('PLN', d) }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
}

export function searchProducts(query: string, day = currentSimDay()): ProductSearchResult[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []
  const d = clampDay(day)
  const results: ProductSearchResult[] = []
  for (const product of PRODUCTS) {
    const offers = OFFERS_BY_PRODUCT.get(product.id) ?? []
    const titles = [product.canonicalTitle, ...offers.map((offer) => offer.listingTitle)]
    const lowered = titles.map((title) => title.toLowerCase())
    const matched = tokens.filter((token) => lowered.some((title) => title.includes(token)))
    if (matched.length === 0) continue
    results.push({
      product,
      score: matched.length / tokens.length,
      matchedTitles: titles.filter((title, index) =>
        tokens.some((token) => lowered[index]?.includes(token)),
      ),
      offerCount: offers.length,
      offersInStock: offers.filter((offer) => stockAt(offer, d) > 0).length,
    })
  }
  return results.sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
}

export function getGroundTruth(offerId: string, day = currentSimDay()): GroundTruth | undefined {
  const offer = OFFER_BY_ID.get(offerId)
  if (!offer) return undefined
  const to = clampDay(day)
  const from = Math.max(0, to - 89)
  let low = Infinity
  let high = -Infinity
  for (let d = from; d <= to; d++) {
    const price = priceAt(offer, d)
    low = Math.min(low, price)
    high = Math.max(high, price)
  }
  return {
    offerId: offer.id,
    isBait: offer.trap?.kind === 'bait',
    hasFakeAnchor: offer.trap?.kind === 'fake-anchor',
    isFxTrap: offer.trap?.kind === 'fx-trap',
    true90dLow: low,
    true90dHigh: high,
  }
}
