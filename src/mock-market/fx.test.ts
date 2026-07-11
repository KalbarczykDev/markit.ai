import { describe, expect, test } from 'bun:test'

import { FX_BASES, fxRate } from './fx'
import type { Currency } from './types'

describe('fxRate', () => {
  test('EUR is always exactly 1', () => {
    expect(fxRate('EUR', 0)).toBe(1)
    expect(fxRate('EUR', 500)).toBe(1)
  })

  test('is deterministic', () => {
    expect(fxRate('GBP', 33)).toBe(fxRate('GBP', 33))
  })

  test('drifts within ±4% of the base rate', () => {
    const currencies: Currency[] = ['GBP', 'USD', 'PLN']
    for (const currency of currencies) {
      for (let day = 0; day < 365; day += 7) {
        const rate = fxRate(currency, day)
        expect(rate).toBeGreaterThanOrEqual(FX_BASES[currency] * 0.96)
        expect(rate).toBeLessThanOrEqual(FX_BASES[currency] * 1.04)
      }
    }
  })

  test('actually moves over time', () => {
    const rates = new Set<number>()
    for (let day = 0; day < 60; day++) rates.add(fxRate('GBP', day))
    expect(rates.size).toBeGreaterThan(10)
  })
})
