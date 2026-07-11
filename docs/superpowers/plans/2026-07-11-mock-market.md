# Mock Market Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/mock-market/` — a deterministic price-event simulator for the AI Shopping Assistant case — plus thin `/api/market/*` HTTP routes on the existing Cloudflare Worker.

**Architecture:** Pure TypeScript module where every result is a function of a fixed `SEED` and a simulated day (1 real minute = 1 sim day, explicit `day` override everywhere). Seed catalog (~30 products, 8 merchants) expands deterministically into 90–180 offers with messy titles and seeded traps (bait, fake anchors, FX traps). No state, no storage, no I/O.

**Tech Stack:** TypeScript strict, Bun (`bun test` runner), oxfmt/oxlint gates, Cloudflare Worker fetch handler in `src/server.ts`.

**Spec:** `docs/superpowers/specs/2026-07-11-mock-market-design.md` — read it first.

## Global Constraints

- Use Bun for everything. Never npm/pnpm/yarn. Never run `tsc` — the type gate is `bun run lint:type-aware`.
- **Do NOT run `bun install`.** Installed bun is 1.3.14 while the project pins `bun@1.4.0`; an install rewrites `bun.lock` to an older lockfileVersion. Dependencies are already installed.
- Every shell must set: `export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH"` (vite build needs Node ≥22.15; bun lives in /opt/homebrew/bin).
- No new dependencies of any kind. Hash/noise functions are hand-rolled.
- Code style is enforced by oxfmt (`bun run fmt`): single quotes, no semicolons, trailing commas, sorted imports, 2-space indent. Run `bun run fmt` before every commit.
- Strict TypeScript. No `any`, no non-null assertions (`!`), no unsafe casts.
- The public API must never expose trap flags, `basePrice`, or `volatility` — scraper-visible data only. Ground truth is a separate export, never routed over HTTP.
- Conventional Commit messages. Commit only files belonging to the task.
- The UI (voice orb) is untouched. No route files, no components.

---

### Task 1: Seeded noise primitives (`noise.ts`)

**Files:**

- Create: `src/mock-market/noise.ts`
- Test: `src/mock-market/noise.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `rand01(...parts: ReadonlyArray<number | string>): number` (deterministic uniform `[0, 1)`), `valueNoise(key: string, day: number, periodDays: number): number` (smooth deterministic noise in `[-1, 1]`). All later tasks build on these two.

- [ ] **Step 1: Write the failing test**

```ts
// src/mock-market/noise.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/mock-market/noise.test.ts`
Expected: FAIL — `Cannot find module './noise'`

- [ ] **Step 3: Write the implementation**

```ts
// src/mock-market/noise.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/mock-market/noise.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Lint, format, commit**

```bash
bun run fmt && bun run lint:type-aware
git add src/mock-market/noise.ts src/mock-market/noise.test.ts
git commit -m "feat(mock-market): add seeded noise primitives"
```

---

### Task 2: Types and FX simulation (`types.ts`, `fx.ts`)

**Files:**

- Create: `src/mock-market/types.ts`
- Create: `src/mock-market/fx.ts`
- Test: `src/mock-market/fx.test.ts`

**Interfaces:**

- Consumes: `valueNoise` from Task 1.
- Produces: all domain types (below, verbatim — later tasks import them exactly), `FX_BASES: Record<Currency, number>`, `fxRate(currency: Currency, day: number): number` (EUR per unit of currency).

- [ ] **Step 1: Write the types file** (no test of its own — it is exercised by every later test)

```ts
// src/mock-market/types.ts
export type Currency = 'EUR' | 'GBP' | 'USD' | 'PLN'
export type Category = 'sneakers' | 'headphones' | 'jackets'
export type Country = 'NL' | 'DE' | 'FR' | 'UK' | 'US' | 'PL'
export type ReturnPolicy = 'free-30d' | 'paid-14d' | 'none'

export type Product = {
  id: string
  category: Category
  brand: string
  model: string
  canonicalTitle: string
  attrs: { sizes?: string[]; colors?: string[] }
  /** EUR reference price the offer builder derives merchant prices from. Not exposed as a quote. */
  msrp: number
}

export type Merchant = {
  id: string
  name: string
  country: Country
  currency: Currency
  shipping: { flatFee: number; freeThreshold: number | null }
  dutyClass: 'eu' | 'non-eu'
  rating: number
  accountAgeDays: number
  returnPolicy: ReturnPolicy
}

export type TrapConfig =
  | { kind: 'bait' }
  | { kind: 'fake-anchor'; factor: number }
  | { kind: 'fx-trap' }
  | null

/** Internal offer record. `basePrice`, `volatility`, `promoCadenceDays`, `stockInit` and `trap` never leave the module. */
export type Offer = {
  id: string
  merchantId: string
  productId: string
  listingTitle: string
  basePrice: number
  volatility: number
  promoCadenceDays: number
  stockInit: number
  trap: TrapConfig
}

export type PublicOffer = Pick<Offer, 'id' | 'merchantId' | 'productId' | 'listingTitle'>

export type Coupon = {
  code: string
  type: 'percent' | 'fixed'
  value: number
  minBasket: number | null
  expiresDay: number
}

export type Quote = {
  offerId: string
  productId: string
  merchantId: string
  day: number
  sticker: number
  currency: Currency
  wasPrice: number | null
  stock: number
  activeCoupons: Coupon[]
  shippingCost: number
  merchant: {
    name: string
    country: Country
    rating: number
    accountAgeDays: number
    returnPolicy: ReturnPolicy
  }
}

export type PricePoint = { day: number; sticker: number; stock: number }

export type OfferWithQuote = { offer: PublicOffer; quote: Quote }

export type ProductSearchResult = {
  product: Product
  score: number
  matchedTitles: string[]
  offerCount: number
  offersInStock: number
}

export type GroundTruth = {
  offerId: string
  isBait: boolean
  hasFakeAnchor: boolean
  isFxTrap: boolean
  true90dLow: number
  true90dHigh: number
}
```

- [ ] **Step 2: Write the failing FX test**

```ts
// src/mock-market/fx.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/mock-market/fx.test.ts`
Expected: FAIL — `Cannot find module './fx'`

- [ ] **Step 4: Write the FX implementation**

```ts
// src/mock-market/fx.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/mock-market/fx.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Lint, format, commit**

```bash
bun run fmt && bun run lint:type-aware
git add src/mock-market/types.ts src/mock-market/fx.ts src/mock-market/fx.test.ts
git commit -m "feat(mock-market): add domain types and deterministic fx rates"
```

---

### Task 3: Seed catalog with deterministic offer builder (`catalog.ts`)

**Files:**

- Create: `src/mock-market/catalog.ts`
- Test: `src/mock-market/catalog.test.ts`

**Interfaces:**

- Consumes: `rand01` (Task 1), `FX_BASES` (Task 2), types (Task 2).
- Produces: `PRODUCTS: Product[]` (30), `MERCHANTS: Merchant[]` (8), `OFFERS: Offer[]`, `OFFER_BY_ID: Map<string, Offer>`, `MERCHANT_BY_ID: Map<string, Merchant>`, `PRODUCT_BY_ID: Map<string, Product>`, `OFFERS_BY_PRODUCT: Map<string, Offer[]>`. Offer ids follow `` `${merchantId}--${productId}` ``.

Trap construction rules (tests depend on these exactly):

- Every product gets one guaranteed EUR-merchant offer (the "anchor"), then 2–3 more normal merchants → 3–4 normal offers.
- `fake-anchor` trap: second normal offer, when `rand01('trap-anchor', product.id) < 0.25`; factor `1.4 + rand01('anchor-factor', offerId) * 0.2`.
- `fx-trap`: extra offer at `uk-bargainbin` (GBP, non-eu, flat £9.99 shipping) when `rand01('trap-fx', product.id) < 0.35`; base price `roundBase((cheapestEurBase * 0.93) / FX_BASES.GBP)` — naively cheaper than the EUR anchor, lands above it after FX + shipping + 12% duty.
- `bait`: extra offer at `xx-dealblitz` (EUR, rating 2.9, 45-day-old account, no returns) when `rand01('trap-bait', product.id) < 0.3`; base price `roundBase(cheapestEurBase * 0.52)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/mock-market/catalog.test.ts
import { describe, expect, test } from 'bun:test'
import {
  MERCHANT_BY_ID,
  MERCHANTS,
  OFFERS,
  OFFERS_BY_PRODUCT,
  PRODUCT_BY_ID,
  PRODUCTS,
} from './catalog'
import { FX_BASES } from './fx'

describe('catalog', () => {
  test('has 30 products across three categories', () => {
    expect(PRODUCTS.length).toBe(30)
    const categories = new Set(PRODUCTS.map((product) => product.category))
    expect(categories).toEqual(new Set(['sneakers', 'headphones', 'jackets']))
  })

  test('every product has 3-6 offers with a EUR offer among them', () => {
    for (const product of PRODUCTS) {
      const offers = OFFERS_BY_PRODUCT.get(product.id) ?? []
      expect(offers.length).toBeGreaterThanOrEqual(3)
      expect(offers.length).toBeLessThanOrEqual(6)
      const currencies = offers.map((offer) => {
        const merchant = MERCHANT_BY_ID.get(offer.merchantId)
        expect(merchant).toBeDefined()
        return merchant?.currency
      })
      expect(currencies).toContain('EUR')
    }
  })

  test('offer ids are unique and follow merchantId--productId', () => {
    const ids = new Set(OFFERS.map((offer) => offer.id))
    expect(ids.size).toBe(OFFERS.length)
    for (const offer of OFFERS) {
      expect(offer.id).toBe(`${offer.merchantId}--${offer.productId}`)
      expect(PRODUCT_BY_ID.get(offer.productId)).toBeDefined()
    }
  })

  test('listing titles are messy variants, not the canonical title', () => {
    let differing = 0
    for (const offer of OFFERS) {
      const product = PRODUCT_BY_ID.get(offer.productId)
      if (offer.listingTitle !== product?.canonicalTitle) differing++
    }
    expect(differing).toBe(OFFERS.length)
  })

  test('all configured trap kinds occur in the catalog', () => {
    const kinds = new Set(OFFERS.map((offer) => offer.trap?.kind).filter(Boolean))
    expect(kinds).toEqual(new Set(['bait', 'fake-anchor', 'fx-trap']))
  })

  test('fx-trap offers are naively cheaper but land above the cheapest EUR base', () => {
    for (const offer of OFFERS.filter((candidate) => candidate.trap?.kind === 'fx-trap')) {
      const merchant = MERCHANT_BY_ID.get(offer.merchantId)
      expect(merchant?.currency).toBe('GBP')
      expect(merchant?.dutyClass).toBe('non-eu')
      const siblings = OFFERS_BY_PRODUCT.get(offer.productId) ?? []
      const eurBases = siblings
        .filter((sibling) => MERCHANT_BY_ID.get(sibling.merchantId)?.currency === 'EUR')
        .filter((sibling) => sibling.trap?.kind !== 'bait')
        .map((sibling) => sibling.basePrice)
      const cheapestEur = Math.min(...eurBases)
      const naive = offer.basePrice * FX_BASES.GBP
      const landed = naive * 1.12 + (merchant?.shipping.flatFee ?? 0) * FX_BASES.GBP
      expect(naive).toBeLessThan(cheapestEur)
      expect(landed).toBeGreaterThan(cheapestEur)
    }
  })

  test('bait offers sit on a merchant with at least two suspicious signals', () => {
    const baitOffers = OFFERS.filter((offer) => offer.trap?.kind === 'bait')
    expect(baitOffers.length).toBeGreaterThan(0)
    for (const offer of baitOffers) {
      const merchant = MERCHANT_BY_ID.get(offer.merchantId)
      expect(merchant).toBeDefined()
      if (!merchant) continue
      const signals = [
        merchant.rating < 3.5,
        merchant.accountAgeDays < 180,
        merchant.returnPolicy === 'none',
      ].filter(Boolean).length
      expect(signals).toBeGreaterThanOrEqual(2)
    }
  })

  test('merchant set covers all six countries and four currencies', () => {
    expect(new Set(MERCHANTS.map((merchant) => merchant.country))).toEqual(
      new Set(['NL', 'DE', 'FR', 'UK', 'US', 'PL']),
    )
    expect(new Set(MERCHANTS.map((merchant) => merchant.currency))).toEqual(
      new Set(['EUR', 'GBP', 'USD', 'PLN']),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/mock-market/catalog.test.ts`
Expected: FAIL — `Cannot find module './catalog'`

- [ ] **Step 3: Write the implementation**

```ts
// src/mock-market/catalog.ts
import { FX_BASES } from './fx'
import { rand01 } from './noise'
import type { Currency, Merchant, Offer, Product, TrapConfig } from './types'

const SNEAKER_SIZES = ['40', '41', '42', '43', '44', '45', '46']
const JACKET_SIZES = ['S', 'M', 'L', 'XL']

export const PRODUCTS: Product[] = [
  // — sneakers (12)
  {
    id: 'snk-dunk-low',
    category: 'sneakers',
    brand: 'Nike',
    model: 'Dunk Low Retro',
    canonicalTitle: 'Nike Dunk Low Retro White/Black',
    attrs: { sizes: SNEAKER_SIZES, colors: ['White/Black'] },
    msrp: 119.99,
  },
  {
    id: 'snk-af1',
    category: 'sneakers',
    brand: 'Nike',
    model: "Air Force 1 '07",
    canonicalTitle: "Nike Air Force 1 '07 Triple White",
    attrs: { sizes: SNEAKER_SIZES, colors: ['Triple White'] },
    msrp: 129.99,
  },
  {
    id: 'snk-aj1-mid',
    category: 'sneakers',
    brand: 'Jordan',
    model: 'Air Jordan 1 Mid',
    canonicalTitle: 'Air Jordan 1 Mid Chicago Toe',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Chicago Toe'] },
    msrp: 139.99,
  },
  {
    id: 'snk-nb-550',
    category: 'sneakers',
    brand: 'New Balance',
    model: '550',
    canonicalTitle: 'New Balance 550 White/Green',
    attrs: { sizes: SNEAKER_SIZES, colors: ['White/Green'] },
    msrp: 129.99,
  },
  {
    id: 'snk-nb-9060',
    category: 'sneakers',
    brand: 'New Balance',
    model: '9060',
    canonicalTitle: 'New Balance 9060 Sea Salt',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Sea Salt'] },
    msrp: 159.99,
  },
  {
    id: 'snk-samba',
    category: 'sneakers',
    brand: 'Adidas',
    model: 'Samba OG',
    canonicalTitle: 'Adidas Samba OG Cloud White',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Cloud White'] },
    msrp: 119.99,
  },
  {
    id: 'snk-gazelle',
    category: 'sneakers',
    brand: 'Adidas',
    model: 'Gazelle',
    canonicalTitle: 'Adidas Gazelle Indoor Blue',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Indoor Blue'] },
    msrp: 109.99,
  },
  {
    id: 'snk-speedcat',
    category: 'sneakers',
    brand: 'Puma',
    model: 'Speedcat OG',
    canonicalTitle: 'Puma Speedcat OG Black/White',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Black/White'] },
    msrp: 99.99,
  },
  {
    id: 'snk-gel1130',
    category: 'sneakers',
    brand: 'Asics',
    model: 'Gel-1130',
    canonicalTitle: 'Asics Gel-1130 Silver/Blue',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Silver/Blue'] },
    msrp: 109.99,
  },
  {
    id: 'snk-chuck70',
    category: 'sneakers',
    brand: 'Converse',
    model: 'Chuck 70 High',
    canonicalTitle: 'Converse Chuck 70 High Parchment',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Parchment'] },
    msrp: 94.99,
  },
  {
    id: 'snk-oldskool',
    category: 'sneakers',
    brand: 'Vans',
    model: 'Old Skool',
    canonicalTitle: 'Vans Old Skool Black/White',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Black/White'] },
    msrp: 79.99,
  },
  {
    id: 'snk-xt6',
    category: 'sneakers',
    brand: 'Salomon',
    model: 'XT-6',
    canonicalTitle: 'Salomon XT-6 Black Phantom',
    attrs: { sizes: SNEAKER_SIZES, colors: ['Black Phantom'] },
    msrp: 179.99,
  },
  // — headphones (9)
  {
    id: 'hp-xm5',
    category: 'headphones',
    brand: 'Sony',
    model: 'WH-1000XM5',
    canonicalTitle: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black',
    attrs: { colors: ['Black', 'Silver'] },
    msrp: 349.99,
  },
  {
    id: 'hp-qc45',
    category: 'headphones',
    brand: 'Bose',
    model: 'QuietComfort 45',
    canonicalTitle: 'Bose QuietComfort 45 Headphones Triple Black',
    attrs: { colors: ['Triple Black'] },
    msrp: 279.99,
  },
  {
    id: 'hp-airpods-pro2',
    category: 'headphones',
    brand: 'Apple',
    model: 'AirPods Pro 2',
    canonicalTitle: 'Apple AirPods Pro (2nd generation) USB-C',
    attrs: {},
    msrp: 279.99,
  },
  {
    id: 'hp-airpods-max',
    category: 'headphones',
    brand: 'Apple',
    model: 'AirPods Max',
    canonicalTitle: 'Apple AirPods Max Space Grey',
    attrs: { colors: ['Space Grey'] },
    msrp: 549.99,
  },
  {
    id: 'hp-momentum4',
    category: 'headphones',
    brand: 'Sennheiser',
    model: 'Momentum 4',
    canonicalTitle: 'Sennheiser Momentum 4 Wireless Black',
    attrs: { colors: ['Black'] },
    msrp: 299.99,
  },
  {
    id: 'hp-tour-m2',
    category: 'headphones',
    brand: 'JBL',
    model: 'Tour One M2',
    canonicalTitle: 'JBL Tour One M2 Noise Cancelling Headphones',
    attrs: { colors: ['Black'] },
    msrp: 179.99,
  },
  {
    id: 'hp-studio-pro',
    category: 'headphones',
    brand: 'Beats',
    model: 'Studio Pro',
    canonicalTitle: 'Beats Studio Pro Wireless Headphones Sandstone',
    attrs: { colors: ['Sandstone'] },
    msrp: 349.99,
  },
  {
    id: 'hp-major5',
    category: 'headphones',
    brand: 'Marshall',
    model: 'Major V',
    canonicalTitle: 'Marshall Major V Bluetooth Headphones Brown',
    attrs: { colors: ['Brown'] },
    msrp: 149.99,
  },
  {
    id: 'hp-q45',
    category: 'headphones',
    brand: 'Anker',
    model: 'Soundcore Space Q45',
    canonicalTitle: 'Anker Soundcore Space Q45 Adaptive ANC',
    attrs: { colors: ['Black'] },
    msrp: 129.99,
  },
  // — jackets (9)
  {
    id: 'jk-nuptse',
    category: 'jackets',
    brand: 'The North Face',
    model: '1996 Retro Nuptse',
    canonicalTitle: 'The North Face 1996 Retro Nuptse Jacket Black',
    attrs: { sizes: JACKET_SIZES, colors: ['Black'] },
    msrp: 330,
  },
  {
    id: 'jk-nano-puff',
    category: 'jackets',
    brand: 'Patagonia',
    model: 'Nano Puff',
    canonicalTitle: 'Patagonia Nano Puff Jacket Navy',
    attrs: { sizes: JACKET_SIZES, colors: ['Navy'] },
    msrp: 239.99,
  },
  {
    id: 'jk-detroit',
    category: 'jackets',
    brand: 'Carhartt WIP',
    model: 'Detroit Jacket',
    canonicalTitle: 'Carhartt WIP Detroit Jacket Hamilton Brown',
    attrs: { sizes: JACKET_SIZES, colors: ['Hamilton Brown'] },
    msrp: 219.99,
  },
  {
    id: 'jk-trucker',
    category: 'jackets',
    brand: "Levi's",
    model: 'Sherpa Trucker',
    canonicalTitle: "Levi's Sherpa Trucker Jacket Mid Wash",
    attrs: { sizes: JACKET_SIZES, colors: ['Mid Wash'] },
    msrp: 149.99,
  },
  {
    id: 'jk-puffect',
    category: 'jackets',
    brand: 'Columbia',
    model: 'Puffect II',
    canonicalTitle: 'Columbia Puffect II Hooded Jacket Black',
    attrs: { sizes: JACKET_SIZES, colors: ['Black'] },
    msrp: 129.99,
  },
  {
    id: 'jk-ultralight',
    category: 'jackets',
    brand: 'Uniqlo',
    model: 'Ultra Light Down',
    canonicalTitle: 'Uniqlo Ultra Light Down Jacket Olive',
    attrs: { sizes: JACKET_SIZES, colors: ['Olive'] },
    msrp: 79.99,
  },
  {
    id: 'jk-bedale',
    category: 'jackets',
    brand: 'Barbour',
    model: 'Bedale Wax',
    canonicalTitle: 'Barbour Bedale Wax Jacket Sage',
    attrs: { sizes: JACKET_SIZES, colors: ['Sage'] },
    msrp: 319,
  },
  {
    id: 'jk-rains-long',
    category: 'jackets',
    brand: 'Rains',
    model: 'Long Jacket',
    canonicalTitle: 'Rains Long Jacket Green',
    attrs: { sizes: JACKET_SIZES, colors: ['Green'] },
    msrp: 119,
  },
  {
    id: 'jk-atom-lt',
    category: 'jackets',
    brand: "Arc'teryx",
    model: 'Atom LT',
    canonicalTitle: "Arc'teryx Atom LT Hoody Black",
    attrs: { sizes: JACKET_SIZES, colors: ['Black'] },
    msrp: 260,
  },
]

export const MERCHANTS: Merchant[] = [
  {
    id: 'nl-sneakpeak',
    name: 'SneakPeak NL',
    country: 'NL',
    currency: 'EUR',
    shipping: { flatFee: 7.4, freeThreshold: 120 },
    dutyClass: 'eu',
    rating: 4.7,
    accountAgeDays: 3200,
    returnPolicy: 'free-30d',
  },
  {
    id: 'de-schuhwerk',
    name: 'Schuhwerk DE',
    country: 'DE',
    currency: 'EUR',
    shipping: { flatFee: 4.95, freeThreshold: 80 },
    dutyClass: 'eu',
    rating: 4.5,
    accountAgeDays: 2800,
    returnPolicy: 'free-30d',
  },
  {
    id: 'fr-lamode',
    name: 'LaMode FR',
    country: 'FR',
    currency: 'EUR',
    shipping: { flatFee: 6.9, freeThreshold: 100 },
    dutyClass: 'eu',
    rating: 4.2,
    accountAgeDays: 2100,
    returnPolicy: 'paid-14d',
  },
  {
    id: 'uk-kicksdirect',
    name: 'KicksDirect UK',
    country: 'UK',
    currency: 'GBP',
    shipping: { flatFee: 7.99, freeThreshold: 150 },
    dutyClass: 'non-eu',
    rating: 4.4,
    accountAgeDays: 2600,
    returnPolicy: 'paid-14d',
  },
  {
    id: 'us-stateside',
    name: 'Stateside US',
    country: 'US',
    currency: 'USD',
    shipping: { flatFee: 14.99, freeThreshold: null },
    dutyClass: 'non-eu',
    rating: 4.6,
    accountAgeDays: 3600,
    returnPolicy: 'paid-14d',
  },
  {
    id: 'pl-sportowy',
    name: 'Sportowy PL',
    country: 'PL',
    currency: 'PLN',
    shipping: { flatFee: 19.99, freeThreshold: 400 },
    dutyClass: 'eu',
    rating: 4.3,
    accountAgeDays: 1900,
    returnPolicy: 'free-30d',
  },
  {
    id: 'xx-dealblitz',
    name: 'DealBlitz Outlet',
    country: 'DE',
    currency: 'EUR',
    shipping: { flatFee: 0, freeThreshold: null },
    dutyClass: 'eu',
    rating: 2.9,
    accountAgeDays: 45,
    returnPolicy: 'none',
  },
  {
    id: 'uk-bargainbin',
    name: 'BargainBin UK',
    country: 'UK',
    currency: 'GBP',
    shipping: { flatFee: 9.99, freeThreshold: null },
    dutyClass: 'non-eu',
    rating: 3.4,
    accountAgeDays: 300,
    returnPolicy: 'paid-14d',
  },
]

const NORMAL_MERCHANTS = MERCHANTS.filter(
  (merchant) => merchant.id !== 'xx-dealblitz' && merchant.id !== 'uk-bargainbin',
)

const NOISE_WORDS = ['FAST SHIP', 'OG BOX', '2026', 'NEW', 'SALE %', 'ORIGINAL', 'EU STOCK']

function mangleTitle(product: Product, merchantId: string): string {
  const variant = Math.floor(rand01('title', product.id, merchantId) * 4)
  const sku = `#${String(1000 + Math.floor(rand01('sku', product.id, merchantId) * 9000))}`
  const noise =
    NOISE_WORDS[Math.floor(rand01('noise', product.id, merchantId) * NOISE_WORDS.length)] ?? 'NEW'
  const color = product.attrs.colors?.[0]
  switch (variant) {
    case 0:
      return `${product.brand.toUpperCase()} ${product.model} ${sku} ${noise}`
    case 1:
      return `${product.model} by ${product.brand} - ${noise}`
    case 2:
      return `${product.brand} ${product.model}${color ? ` '${color}'` : ''} ${noise} ${sku}`
    default:
      return `[${noise}] ${product.brand} ${product.model} original`
  }
}

function roundBase(value: number): number {
  return Math.max(0.99, Math.round(value) - 0.01)
}

function toMerchantCurrency(priceEur: number, currency: Currency): number {
  return priceEur / FX_BASES[currency]
}

function buildOffersFor(product: Product): Offer[] {
  const ranked = [...NORMAL_MERCHANTS].sort(
    (a, b) => rand01('assign', product.id, a.id) - rand01('assign', product.id, b.id),
  )
  const anchor = ranked.find((merchant) => merchant.currency === 'EUR')
  if (!anchor) throw new Error('catalog invariant: no EUR merchant available')
  const extraCount = 2 + Math.floor(rand01('offer-count', product.id) * 2)
  const chosen = [
    anchor,
    ...ranked.filter((merchant) => merchant.id !== anchor.id).slice(0, extraCount),
  ]

  const offers: Offer[] = []
  const eurBases: number[] = []
  for (const merchant of chosen) {
    const id = `${merchant.id}--${product.id}`
    const factor = 0.88 + rand01('price', id) * 0.18
    const basePrice = roundBase(toMerchantCurrency(product.msrp * factor, merchant.currency))
    const trap: TrapConfig =
      offers.length === 1 && rand01('trap-anchor', product.id) < 0.25
        ? { kind: 'fake-anchor', factor: 1.4 + rand01('anchor-factor', id) * 0.2 }
        : null
    if (merchant.currency === 'EUR') eurBases.push(basePrice)
    offers.push({
      id,
      merchantId: merchant.id,
      productId: product.id,
      listingTitle: mangleTitle(product, merchant.id),
      basePrice,
      volatility: 0.4 + rand01('volatility', id) * 0.6,
      promoCadenceDays: 14 + Math.floor(rand01('cadence', id) * 15),
      stockInit: 6 + Math.floor(rand01('stock', id) * 20),
      trap,
    })
  }

  const cheapestEurBase = Math.min(...eurBases)
  if (rand01('trap-fx', product.id) < 0.35) {
    offers.push({
      id: `uk-bargainbin--${product.id}`,
      merchantId: 'uk-bargainbin',
      productId: product.id,
      listingTitle: mangleTitle(product, 'uk-bargainbin'),
      basePrice: roundBase((cheapestEurBase * 0.93) / FX_BASES.GBP),
      volatility: 0.15,
      promoCadenceDays: 21,
      stockInit: 8,
      trap: { kind: 'fx-trap' },
    })
  }
  if (rand01('trap-bait', product.id) < 0.3) {
    offers.push({
      id: `xx-dealblitz--${product.id}`,
      merchantId: 'xx-dealblitz',
      productId: product.id,
      listingTitle: mangleTitle(product, 'xx-dealblitz'),
      basePrice: roundBase(cheapestEurBase * 0.52),
      volatility: 0.1,
      promoCadenceDays: 21,
      stockInit: 2,
      trap: { kind: 'bait' },
    })
  }
  return offers
}

export const OFFERS: Offer[] = PRODUCTS.flatMap(buildOffersFor)

export const PRODUCT_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]))
export const MERCHANT_BY_ID = new Map(MERCHANTS.map((merchant) => [merchant.id, merchant]))
export const OFFER_BY_ID = new Map(OFFERS.map((offer) => [offer.id, offer]))

export const OFFERS_BY_PRODUCT = new Map<string, Offer[]>()
for (const offer of OFFERS) {
  const list = OFFERS_BY_PRODUCT.get(offer.productId)
  if (list) list.push(offer)
  else OFFERS_BY_PRODUCT.set(offer.productId, [offer])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/mock-market/catalog.test.ts`
Expected: PASS (8 tests). If `all four trap kinds occur` fails because a trap kind never rolled, adjust the trap thresholds (`0.25` / `0.35` / `0.3`) upward slightly — they are seed-dependent constants, not magic.

- [ ] **Step 5: Lint, format, commit**

```bash
bun run fmt && bun run lint:type-aware
git add src/mock-market/catalog.ts src/mock-market/catalog.test.ts
git commit -m "feat(mock-market): add seed catalog with deterministic offers and traps"
```

---

### Task 4: Price, stock and coupon mechanics (`simulator.ts`)

**Files:**

- Create: `src/mock-market/simulator.ts`
- Test: `src/mock-market/simulator.test.ts`

**Interfaces:**

- Consumes: `rand01`, `valueNoise` (Task 1), types (Task 2), `OFFERS` from Task 3 (test only).
- Produces (Task 5 and 6 depend on these exact signatures):
  - `EPOCH: number`, `MS_PER_SIM_DAY: number` (60000)
  - `currentSimDay(now?: number): number`
  - `clampDay(day: number): number`
  - `priceAt(offer: Offer, day: number): number`
  - `wasPriceAt(offer: Offer, day: number): number | null`
  - `stockAt(offer: Offer, day: number): number`
  - `couponsAt(offer: Offer, day: number): Coupon[]`
  - `shippingCost(merchant: Merchant, sticker: number): number`
  - `promoDiscount(offer: Offer, day: number): number` (exported for tests)
  - `flashFactor(offer: Offer, day: number): number` (exported for tests)

- [ ] **Step 1: Write the failing test**

```ts
// src/mock-market/simulator.test.ts
import { describe, expect, test } from 'bun:test'
import { OFFERS } from './catalog'
import {
  clampDay,
  couponsAt,
  currentSimDay,
  EPOCH,
  flashFactor,
  MS_PER_SIM_DAY,
  priceAt,
  promoDiscount,
  stockAt,
  wasPriceAt,
} from './simulator'

const normalOffers = OFFERS.filter((offer) => offer.trap === null)
const firstNormal = normalOffers[0]

describe('time', () => {
  test('maps the epoch to day 0 and one minute to one day', () => {
    expect(MS_PER_SIM_DAY).toBe(60000)
    expect(currentSimDay(EPOCH)).toBe(0)
    expect(currentSimDay(EPOCH + 59999)).toBe(0)
    expect(currentSimDay(EPOCH + 60000)).toBe(1)
    expect(currentSimDay(EPOCH - 5000)).toBe(0)
  })

  test('clampDay floors and clamps to zero', () => {
    expect(clampDay(-3)).toBe(0)
    expect(clampDay(4.9)).toBe(4)
    expect(clampDay(Number.NaN)).toBe(0)
  })
})

describe('priceAt', () => {
  test('is deterministic', () => {
    for (const offer of OFFERS) {
      expect(priceAt(offer, 42)).toBe(priceAt(offer, 42))
    }
  })

  test('stays within plausible bounds around the base price', () => {
    for (const offer of normalOffers) {
      for (let day = 0; day < 120; day++) {
        const price = priceAt(offer, day)
        expect(price).toBeGreaterThan(offer.basePrice * 0.5)
        expect(price).toBeLessThan(offer.basePrice * 1.1)
      }
    }
  })

  test('promo days price below base price', () => {
    let checked = 0
    for (const offer of normalOffers) {
      for (let day = 0; day < 90; day++) {
        if (promoDiscount(offer, day) > 0) {
          expect(priceAt(offer, day)).toBeLessThan(offer.basePrice)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(50)
  })

  test('prices end in .99-style points', () => {
    if (!firstNormal) throw new Error('catalog has no normal offers')
    const cents = Math.round((priceAt(firstNormal, 7) % 1) * 100)
    expect(cents).toBe(99)
  })
})

describe('wasPriceAt', () => {
  test('fake-anchor offers always show an inflated was-price', () => {
    const anchored = OFFERS.filter((offer) => offer.trap?.kind === 'fake-anchor')
    expect(anchored.length).toBeGreaterThan(0)
    for (const offer of anchored) {
      const wasPrice = wasPriceAt(offer, 10)
      expect(wasPrice).not.toBeNull()
      if (wasPrice !== null) expect(wasPrice).toBeGreaterThan(offer.basePrice * 1.3)
    }
  })

  test('honest offers show a was-price only during discounts', () => {
    for (const offer of normalOffers.slice(0, 10)) {
      for (let day = 0; day < 60; day++) {
        const discounted = promoDiscount(offer, day) > 0 || flashFactor(offer, day) < 1
        const wasPrice = wasPriceAt(offer, day)
        if (discounted) {
          expect(wasPrice).not.toBeNull()
          if (wasPrice !== null) expect(wasPrice).toBeGreaterThan(priceAt(offer, day))
        } else {
          expect(wasPrice).toBeNull()
        }
      }
    }
  })
})

describe('stockAt', () => {
  test('never goes negative and only decreases within a restock cycle', () => {
    for (const offer of normalOffers.slice(0, 10)) {
      for (let day = 0; day < 59; day++) {
        const today = stockAt(offer, day)
        expect(today).toBeGreaterThanOrEqual(0)
        if (Math.floor(day / 30) === Math.floor((day + 1) / 30)) {
          expect(stockAt(offer, day + 1)).toBeLessThanOrEqual(today)
        }
      }
    }
  })

  test('bait offers always claim scarce stock', () => {
    for (const offer of OFFERS.filter((candidate) => candidate.trap?.kind === 'bait')) {
      for (let day = 0; day < 30; day++) {
        const stock = stockAt(offer, day)
        expect(stock).toBeGreaterThanOrEqual(1)
        expect(stock).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('couponsAt', () => {
  test('coupons appear, carry consistent expiry, and expire', () => {
    let seen = 0
    for (const offer of normalOffers) {
      for (let day = 0; day < 60; day++) {
        for (const coupon of couponsAt(offer, day)) {
          seen++
          expect(coupon.expiresDay).toBeGreaterThanOrEqual(day)
          expect(couponsAt(offer, coupon.expiresDay + 1)).toHaveLength(0)
          expect(coupon.value).toBeGreaterThan(0)
        }
      }
    }
    expect(seen).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/mock-market/simulator.test.ts`
Expected: FAIL — `Cannot find module './simulator'`

- [ ] **Step 3: Write the implementation**

```ts
// src/mock-market/simulator.ts
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
```

Note on the coupon-expiry assertion: a coupon's window `[start, start + length)` always ends before the next 20-day cycle can begin only when `start + length ≤ (cycle + 1) * 20 + 12`; with `start ≤ cycle*20+11` and `length ≤ 7` the window ends by `cycle*20+18`, and the next cycle's earliest coupon starts at `(cycle+1)*20`, so `couponsAt(expiresDay + 1)` is empty unless `expiresDay + 1` lands exactly on a new cycle whose coupon starts at offset 0. If that flake occurs for some offer, the test assertion `toHaveLength(0)` may fail legitimately — in that case relax the assertion to check that no coupon with the _same code_ is active at `expiresDay + 1`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/mock-market/simulator.test.ts`
Expected: PASS

- [ ] **Step 5: Lint, format, commit**

```bash
bun run fmt && bun run lint:type-aware
git add src/mock-market/simulator.ts src/mock-market/simulator.test.ts
git commit -m "feat(mock-market): add deterministic price, stock and coupon mechanics"
```

---

### Task 5: Public API and ground truth (`index.ts`)

**Files:**

- Create: `src/mock-market/index.ts`
- Test: `src/mock-market/index.test.ts`

**Interfaces:**

- Consumes: Tasks 1–4.
- Produces (the module's public surface — Task 6 imports from `'./mock-market'`):
  - `currentSimDay`, `EPOCH`, `MS_PER_SIM_DAY` (re-exports)
  - `searchProducts(query: string, day?: number): ProductSearchResult[]`
  - `getOffers(productId: string, day?: number): OfferWithQuote[]`
  - `getQuote(offerId: string, day?: number): Quote | undefined`
  - `getPriceHistory(offerId: string, fromDay: number, toDay: number): PricePoint[]`
  - `getFxRates(day?: number): Record<Currency, number>`
  - `getGroundTruth(offerId: string, day?: number): GroundTruth | undefined`
  - all types re-exported

- [ ] **Step 1: Write the failing test**

```ts
// src/mock-market/index.test.ts
import { describe, expect, test } from 'bun:test'
import { OFFERS } from './catalog'
import {
  getFxRates,
  getGroundTruth,
  getOffers,
  getPriceHistory,
  getQuote,
  searchProducts,
} from './index'

describe('searchProducts', () => {
  test('finds products through canonical and messy titles', () => {
    const results = searchProducts('nike dunk', 30)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.product.id).toBe('snk-dunk-low')
    expect(results[0]?.score).toBe(1)
    expect(results[0]?.offerCount).toBeGreaterThanOrEqual(3)
  })

  test('returns empty for blank or unmatched queries', () => {
    expect(searchProducts('', 0)).toHaveLength(0)
    expect(searchProducts('zzz qqq', 0)).toHaveLength(0)
  })
})

describe('getOffers / getQuote', () => {
  test('quotes are deterministic and structurally identical across calls', () => {
    const first = JSON.stringify(getOffers('snk-dunk-low', 42))
    const second = JSON.stringify(getOffers('snk-dunk-low', 42))
    expect(first).toBe(second)
  })

  test('unknown ids return empty/undefined', () => {
    expect(getOffers('nope', 1)).toHaveLength(0)
    expect(getQuote('nope', 1)).toBeUndefined()
    expect(getGroundTruth('nope', 1)).toBeUndefined()
    expect(getPriceHistory('nope', 0, 5)).toHaveLength(0)
  })

  test('public shapes never leak internals', () => {
    for (const entry of getOffers('snk-dunk-low', 10)) {
      expect(Object.keys(entry.offer).sort()).toEqual([
        'id',
        'listingTitle',
        'merchantId',
        'productId',
      ])
      const serialized = JSON.stringify(entry)
      expect(serialized).not.toContain('trap')
      expect(serialized).not.toContain('basePrice')
      expect(serialized).not.toContain('volatility')
      expect(serialized).not.toContain('isBait')
    }
  })

  test('negative day clamps to day zero', () => {
    const clamped = getQuote(OFFERS[0]?.id ?? '', -7)
    const zero = getQuote(OFFERS[0]?.id ?? '', 0)
    expect(clamped).toEqual(zero)
  })
})

describe('getPriceHistory', () => {
  test('matches getQuote day by day', () => {
    const offerId = OFFERS[0]?.id ?? ''
    const history = getPriceHistory(offerId, 5, 15)
    expect(history).toHaveLength(11)
    for (const point of history) {
      const quote = getQuote(offerId, point.day)
      expect(point.sticker).toBe(quote?.sticker ?? -1)
      expect(point.stock).toBe(quote?.stock ?? -1)
    }
  })

  test('inverted ranges are empty', () => {
    expect(getPriceHistory(OFFERS[0]?.id ?? '', 10, 5)).toHaveLength(0)
  })
})

describe('getFxRates', () => {
  test('returns all four currencies with EUR pinned to 1', () => {
    const rates = getFxRates(12)
    expect(rates.EUR).toBe(1)
    expect(Object.keys(rates).sort()).toEqual(['EUR', 'GBP', 'PLN', 'USD'])
  })
})

describe('ground truth invariants', () => {
  test('fake anchors always exceed the true 90-day high', () => {
    const anchored = OFFERS.filter((offer) => offer.trap?.kind === 'fake-anchor')
    expect(anchored.length).toBeGreaterThan(0)
    for (const offer of anchored) {
      const truth = getGroundTruth(offer.id, 100)
      const quote = getQuote(offer.id, 100)
      expect(truth?.hasFakeAnchor).toBe(true)
      expect(quote?.wasPrice ?? 0).toBeGreaterThan(truth?.true90dHigh ?? Infinity)
    }
  })

  test('trap flags round-trip for every trap kind', () => {
    for (const offer of OFFERS) {
      const truth = getGroundTruth(offer.id, 50)
      expect(truth?.isBait).toBe(offer.trap?.kind === 'bait')
      expect(truth?.hasFakeAnchor).toBe(offer.trap?.kind === 'fake-anchor')
      expect(truth?.isFxTrap).toBe(offer.trap?.kind === 'fx-trap')
    }
  })

  test('true 90-day low/high bracket every sampled price', () => {
    const offer = OFFERS[0]
    if (!offer) throw new Error('catalog empty')
    const truth = getGroundTruth(offer.id, 120)
    if (!truth) throw new Error('missing ground truth')
    for (let day = 31; day <= 120; day += 10) {
      const quote = getQuote(offer.id, day)
      if (!quote) throw new Error('missing quote')
      expect(quote.sticker).toBeGreaterThanOrEqual(truth.true90dLow)
      expect(quote.sticker).toBeLessThanOrEqual(truth.true90dHigh)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/mock-market/index.test.ts`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: Write the implementation**

```ts
// src/mock-market/index.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/mock-market/index.test.ts`
Expected: PASS. Note: the `searchProducts('nike dunk')` expectation of `score` 1 relies on 'nike' and 'dunk' both appearing in the canonical title `Nike Dunk Low Retro White/Black` — they do.

- [ ] **Step 5: Run the whole module suite**

Run: `bun test src/mock-market`
Expected: all files PASS

- [ ] **Step 6: Lint, format, commit**

```bash
bun run fmt && bun run lint:type-aware
git add src/mock-market/index.ts src/mock-market/index.test.ts
git commit -m "feat(mock-market): add public api and ground-truth eval export"
```

---

### Task 6: HTTP wrapper and Worker wiring (`http.ts`, `server.ts`, `package.json`)

**Files:**

- Create: `src/mock-market/http.ts`
- Modify: `src/server.ts` (import + 2 lines in `fetch`)
- Modify: `package.json` (add `"test": "bun test"` script)
- Test: `src/mock-market/http.test.ts`

**Interfaces:**

- Consumes: public API from Task 5.
- Produces: `marketApi(url: URL): Response | null` — returns `null` for non-`/api/market` paths, a `Response` otherwise. `src/server.ts` calls it before delegating to TanStack.

Design notes:

- The handler lives in `src/mock-market/http.ts` (not `server.ts`) so tests can import it without evaluating `@tanstack/react-start/server-entry`, which does not load under `bun test`. `server.ts` keeps only the wiring, per spec intent.
- History range is capped at 365 days per request to bound CPU on the Worker.
- The ground-truth export is intentionally NOT routed.

- [ ] **Step 1: Write the failing test**

```ts
// src/mock-market/http.test.ts
import { describe, expect, test } from 'bun:test'
import { OFFERS } from './catalog'
import { marketApi } from './http'

const offerId = OFFERS[0]?.id ?? ''

async function body(response: Response | null): Promise<unknown> {
  if (!response) throw new Error('expected a response')
  return response.json()
}

describe('marketApi', () => {
  test('ignores non-market paths', () => {
    expect(marketApi(new URL('https://x.test/api/realtime'))).toBeNull()
    expect(marketApi(new URL('https://x.test/'))).toBeNull()
  })

  test('GET /api/market/products requires q', async () => {
    const missing = marketApi(new URL('https://x.test/api/market/products'))
    expect(missing?.status).toBe(400)
    const found = marketApi(new URL('https://x.test/api/market/products?q=dunk&day=30'))
    expect(found?.status).toBe(200)
    const results = (await body(found)) as Array<{ product: { id: string } }>
    expect(results[0]?.product.id).toBe('snk-dunk-low')
  })

  test('GET /api/market/products/:id/offers returns quotes or 404', async () => {
    const ok = marketApi(new URL('https://x.test/api/market/products/snk-dunk-low/offers?day=10'))
    expect(ok?.status).toBe(200)
    const offers = (await body(ok)) as Array<{ quote: { sticker: number } }>
    expect(offers.length).toBeGreaterThanOrEqual(3)
    const missing = marketApi(new URL('https://x.test/api/market/products/nope/offers'))
    expect(missing?.status).toBe(404)
  })

  test('GET /api/market/offers/:id/quote returns a quote or 404', async () => {
    const ok = marketApi(new URL(`https://x.test/api/market/offers/${offerId}/quote?day=10`))
    expect(ok?.status).toBe(200)
    const quote = (await body(ok)) as { offerId: string; day: number }
    expect(quote.offerId).toBe(offerId)
    expect(quote.day).toBe(10)
    expect(marketApi(new URL('https://x.test/api/market/offers/nope/quote'))?.status).toBe(404)
  })

  test('GET /api/market/offers/:id/history validates the range', async () => {
    const ok = marketApi(
      new URL(`https://x.test/api/market/offers/${offerId}/history?from=0&to=10`),
    )
    expect(ok?.status).toBe(200)
    expect(((await body(ok)) as unknown[]).length).toBe(11)
    const badRange = marketApi(
      new URL(`https://x.test/api/market/offers/${offerId}/history?from=9&to=3`),
    )
    expect(badRange?.status).toBe(400)
    const tooWide = marketApi(
      new URL(`https://x.test/api/market/offers/${offerId}/history?from=0&to=999`),
    )
    expect(tooWide?.status).toBe(400)
    const missingParams = marketApi(new URL(`https://x.test/api/market/offers/${offerId}/history`))
    expect(missingParams?.status).toBe(400)
  })

  test('GET /api/market/fx returns all rates', async () => {
    const ok = marketApi(new URL('https://x.test/api/market/fx?day=5'))
    expect(ok?.status).toBe(200)
    const rates = (await body(ok)) as Record<string, number>
    expect(rates.EUR).toBe(1)
  })

  test('invalid day parameter is rejected', () => {
    expect(marketApi(new URL('https://x.test/api/market/fx?day=-1'))?.status).toBe(400)
    expect(marketApi(new URL('https://x.test/api/market/fx?day=abc'))?.status).toBe(400)
  })

  test('unknown market subpath is 404 and ground truth is not routed', () => {
    expect(marketApi(new URL('https://x.test/api/market/bogus'))?.status).toBe(404)
    expect(
      marketApi(new URL(`https://x.test/api/market/offers/${offerId}/ground-truth`))?.status,
    ).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/mock-market/http.test.ts`
Expected: FAIL — `Cannot find module './http'`

- [ ] **Step 3: Write the handler**

```ts
// src/mock-market/http.ts
import { getFxRates, getOffers, getPriceHistory, getQuote, searchProducts } from './index'

const MAX_HISTORY_DAYS = 365

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

type DayParam = { ok: true; day: number | undefined } | { ok: false }

function parseDay(params: URLSearchParams): DayParam {
  const raw = params.get('day')
  if (raw === null) return { ok: true, day: undefined }
  const day = Number(raw)
  if (!Number.isInteger(day) || day < 0) return { ok: false }
  return { ok: true, day }
}

export function marketApi(url: URL): Response | null {
  if (url.pathname !== '/api/market' && !url.pathname.startsWith('/api/market/')) return null
  const segments = url.pathname.split('/').filter(Boolean).slice(2)
  const dayParam = parseDay(url.searchParams)
  if (!dayParam.ok) return json({ error: 'day must be a non-negative integer' }, 400)
  const day = dayParam.day

  if (segments.length === 1 && segments[0] === 'products') {
    const query = url.searchParams.get('q')
    if (!query) return json({ error: 'missing q parameter' }, 400)
    return json(searchProducts(query, day))
  }

  if (segments.length === 3 && segments[0] === 'products' && segments[2] === 'offers') {
    const offers = getOffers(segments[1] ?? '', day)
    if (offers.length === 0) return json({ error: 'unknown product' }, 404)
    return json(offers)
  }

  if (segments.length === 3 && segments[0] === 'offers' && segments[2] === 'quote') {
    const quote = getQuote(segments[1] ?? '', day)
    return quote ? json(quote) : json({ error: 'unknown offer' }, 404)
  }

  if (segments.length === 3 && segments[0] === 'offers' && segments[2] === 'history') {
    const offerId = segments[1] ?? ''
    if (!getQuote(offerId, 0)) return json({ error: 'unknown offer' }, 404)
    const from = Number(url.searchParams.get('from'))
    const to = Number(url.searchParams.get('to'))
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
      return json({ error: 'from and to must be integers with 0 <= from <= to' }, 400)
    }
    if (to - from > MAX_HISTORY_DAYS) {
      return json({ error: `range must not exceed ${String(MAX_HISTORY_DAYS)} days` }, 400)
    }
    return json(getPriceHistory(offerId, from, to))
  }

  if (segments.length === 1 && segments[0] === 'fx') return json(getFxRates(day))

  return json({ error: 'not found' }, 404)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/mock-market/http.test.ts`
Expected: PASS

- [ ] **Step 5: Wire into the Worker**

In `src/server.ts`, add the import at the top (oxfmt will sort it):

```ts
import { marketApi } from './mock-market/http'
```

and change the default export's `fetch` to check market routes after `/api/realtime`:

```ts
export default {
  fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> | Response {
    const url = new URL(request.url)
    if (url.pathname === '/api/realtime') return realtimeSocket(request, env)
    const market = marketApi(url)
    if (market) return market
    return startFetch(request, env, context)
  },
}
```

- [ ] **Step 6: Add the test script**

In `package.json` `scripts`, after `"fmt:check"`, add:

```json
"test": "bun test",
```

- [ ] **Step 7: Full gate**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH"
bun run fmt && bun test && bun run verify
```

Expected: all tests pass; verify (fmt:check + type-aware lint + build) green.

- [ ] **Step 8: Commit**

```bash
git add src/mock-market/http.ts src/mock-market/http.test.ts src/server.ts package.json
git commit -m "feat(mock-market): expose /api/market http routes on the worker"
```

---

### Task 7: Live smoke test against the dev server

**Files:** none created — verification only.

- [ ] **Step 1: Start the dev server and probe the routes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH"
bun run dev &
sleep 5
curl -s 'http://localhost:3000/api/market/products?q=dunk&day=30' | head -c 400; echo
curl -s 'http://localhost:3000/api/market/products/snk-dunk-low/offers?day=30' | head -c 400; echo
curl -s 'http://localhost:3000/api/market/fx?day=5'; echo
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/market/offers/nope/quote'
kill %1
```

(Confirm the dev port from vite output; adjust if not 3000.)
Expected: JSON search results naming `snk-dunk-low`; offer list with quotes; fx object with `"EUR":1`; final line `404`.

- [ ] **Step 2: Confirm determinism over HTTP**

```bash
bun run dev &
sleep 5
curl -s 'http://localhost:3000/api/market/offers/nl-sneakpeak--snk-dunk-low/quote?day=42' > /tmp/a.json 2>/dev/null || true
curl -s 'http://localhost:3000/api/market/offers/nl-sneakpeak--snk-dunk-low/quote?day=42' > /tmp/b.json 2>/dev/null || true
diff /tmp/a.json /tmp/b.json && echo DETERMINISTIC
kill %1
```

If `nl-sneakpeak--snk-dunk-low` happens not to exist (merchant assignment is seed-dependent), pick any offer id from the Task 6 offers response instead.
Expected: `DETERMINISTIC`.

- [ ] **Step 3: Report**

No commit — report smoke-test output in the task summary.
