const SEED = 0x5eed_caf3

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function rand01(...parts: ReadonlyArray<number | string>): number {
  let hash = SEED
  for (const part of parts) {
    const value = typeof part === 'string' ? hashString(part) : part >>> 0
    hash = (hash ^ Math.imul(value, 0x85ebca6b)) >>> 0
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0
  }
  hash ^= hash >>> 16
  return (hash >>> 0) / 0x1_0000_0000
}

export function valueNoise(key: string, day: number, periodDays: number): number {
  const cell = Math.floor(day / periodDays)
  const t = (day - cell * periodDays) / periodDays
  const left = rand01(key, cell) * 2 - 1
  const right = rand01(key, cell + 1) * 2 - 1
  const smooth = t * t * (3 - 2 * t)
  return left + (right - left) * smooth
}
