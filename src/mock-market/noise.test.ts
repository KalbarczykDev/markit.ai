import { describe, expect, test } from 'bun:test'

import { rand01, valueNoise } from './noise'

describe('rand01', () => {
  test('is deterministic for identical inputs', () => {
    expect(rand01('price', 'offer-1', 42)).toBe(rand01('price', 'offer-1', 42))
  })

  test('differs across keys, ids and days', () => {
    expect(rand01('a', 1)).not.toBe(rand01('b', 1))
    expect(rand01('a', 1)).not.toBe(rand01('a', 2))
    expect(rand01('a', 'x', 1)).not.toBe(rand01('a', 'y', 1))
  })

  test('stays in [0, 1) and looks roughly uniform', () => {
    let sum = 0
    for (let index = 0; index < 1000; index++) {
      const value = rand01('uniformity', index)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      sum += value
    }
    const mean = sum / 1000
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })
})

describe('valueNoise', () => {
  test('is deterministic and bounded to [-1, 1]', () => {
    for (let day = 0; day < 200; day++) {
      const value = valueNoise('drift:test', day, 7)
      expect(value).toBe(valueNoise('drift:test', day, 7))
      expect(Math.abs(value)).toBeLessThanOrEqual(1)
    }
  })

  test('moves smoothly between neighboring days', () => {
    for (let day = 0; day < 100; day++) {
      const step = Math.abs(valueNoise('smooth', day + 1, 10) - valueNoise('smooth', day, 10))
      expect(step).toBeLessThan(0.45)
    }
  })
})
