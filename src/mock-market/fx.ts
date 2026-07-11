import { valueNoise } from './noise'
import type { Currency } from './types'

export const FX_BASES: Record<Currency, number> = {
  EUR: 1,
  GBP: 1.17,
  USD: 0.92,
  PLN: 0.23,
}

export function fxRate(currency: Currency, day: number): number {
  if (currency === 'EUR') return 1
  const drift = valueNoise(`fx:${currency}`, Math.max(0, day), 14) * 0.04
  return Math.round(FX_BASES[currency] * (1 + drift) * 10000) / 10000
}
