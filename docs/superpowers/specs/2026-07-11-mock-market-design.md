# Mock Market — Deterministic Price-Event Simulator

**Date:** 2026-07-11
**Status:** Approved design, pending implementation plan

## Purpose

The AI Shopping Assistant case (solidgate-case.pdf) requires merchant/product data
without live scraping: "Mock the merchants, real the math. Build a deterministic
price-event simulator." This spec defines that mock service. It produces raw market
facts only — the landed-cost engine and agent judgment are separate consumers and
out of scope here.

## Decisions (all confirmed with the user)

| Decision     | Choice                                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Scope        | Full deterministic price-event simulator                                              |
| Interface    | Pure TS module in `src/mock-market/` + thin HTTP wrapper `/api/market/*`              |
| Time model   | Hybrid: wall clock default (1 real minute = 1 sim day), explicit `day` override       |
| Catalog      | Sneakers + 2 more categories (headphones, jackets), ~30 products, 3–6 offers each     |
| Boundary     | Raw offer data only; no landed-cost computation                                       |
| Traps        | Bait listings, fake "was" anchors, FX traps, stock scarcity + coupon churn — all four |
| Currencies   | EUR (home), GBP, USD, PLN                                                             |
| Determinism  | Pure noise functions of `(SEED, offerId, day)` — no state, no event log               |
| Ground truth | Public API is scraper-visible only; truth flags in a separate eval export             |

No new libraries or frameworks. Noise/hash functions are hand-rolled
(integer-hash style). Tests run with `bun test`.

## Architecture

```
src/mock-market/
  types.ts      — Product, Merchant, Offer, Quote, FxRate, GroundTruth
  noise.ts      — seeded integer hash → uniform [0,1), 1D value noise
  catalog.ts    — seed data: ~30 products, merchants, offers (messy titles, trap configs)
  fx.ts         — fxRate(currency, day): deterministic drift around realistic bases
  simulator.ts  — price, stock, coupon, promo/flash/trap mechanics
  index.ts      — public API + ground-truth eval export
src/server.ts   — adds /api/market/* JSON routes delegating to the module
```

The module is pure: no I/O, no globals mutated, every result a function of
`(SEED, day)`. The Worker's statelessness is irrelevant — any isolate at any
time recomputes the identical world.

### Time

- `EPOCH` — fixed constant (ms). `currentSimDay(now = Date.now())` =
  `max(0, floor((now − EPOCH) / 60_000))`.
- Every public function accepts optional `day`; omitted → `currentSimDay()`.
- `day` is clamped to `≥ 0`. History is available for any `day ≥ 0` window.

## Data model

- **Product** — canonical item: `id`, `category` (`sneakers` | `headphones` | `jackets`),
  `brand`, `model`, `attrs` (sizes/colors), `canonicalTitle`. ~30 products.
- **Merchant** — `id`, `name`, `country` (NL/DE/FR/UK/US/PL), `currency`
  (EUR/GBP/USD/PLN), shipping policy (flat fee, free threshold), `dutyClass`
  (import duties apply from non-EU), quality signals: `rating`, `accountAgeDays`,
  `returnPolicy`.
- **Offer** — one merchant listing one product: `id`, `merchantId`, `productId`,
  `listingTitle` (messy variant of the canonical title — abbreviations, SKU codes,
  noise words — fuzzy-matching fodder), price params (`basePrice`, `volatility`,
  promo cadence), stock model, coupon schedule, private trap config.
- **Quote** (offer × day) — scraper-visible snapshot: `sticker` price + `currency`,
  `wasPrice` (nullable; sometimes fake), `stock` count, `activeCoupons`
  (code, type, value, conditions, expiry day), `shippingCost`, merchant quality
  signals. **Never** includes trap flags.
- **FxRate** — `fxRate(currency, day)` → EUR per unit; deterministic ±drift around
  bases GBP 1.17, USD 0.92, PLN 0.23. EUR → 1.

## Price mechanics

```
sticker(offer, day) = basePrice
  × drift(seed, offer, day)        // ±8% smooth wander (value noise)
  × promo(seed, offer, day)        // scheduled promo windows, e.g. 10–25% off
  × flash(seed, offer, day)        // rare 1–2 day deep cuts
rounded to realistic price points (.99 / .90 endings where fitting)
```

- **Stock** decays deterministically from an initial level; decay accelerates
  inside promo/flash windows; restocks on a per-offer schedule.
- **Coupons** appear/expire on deterministic schedules; conditions include
  min-basket and category restrictions.
- **wasPrice** honest offers: recent pre-promo sticker. Fake-anchor offers:
  inflated value never actually charged in the 90-day history.

## Traps (all deterministic, seeded per offer)

1. **Bait listing** — implausibly low sticker, thin quality signals (low rating,
   young account), stock claims that never survive: publicly it is just a cheap
   offer with suspicious signals.
2. **Fake "was" anchor** — `wasPrice` far above the true 90-day range, making a
   normal price look like a strike.
3. **FX trap** — attractive foreign sticker (e.g. £59) that lands above the EUR
   alternative once FX + shipping + duties are computed by the consumer.
4. **Scarcity + coupon churn** — stock visibly dwindling during deal windows;
   coupons with tight expiry and conditions.

### Ground truth

`getGroundTruth(offerId)` (separate export, not routed over HTTP) returns
`{ isBait, hasFakeAnchor, true90dLow, ... }` for the eval harness. The public
API never leaks these — the agent must judge from scraper-visible signals.

## Public API (module)

```ts
currentSimDay(now?: number): number
searchProducts(query: string, day?: number): ProductSearchResult[]   // fuzzy over messy titles + canonical
getOffers(productId: string, day?: number): OfferWithQuote[]
getQuote(offerId: string, day?: number): Quote | undefined
getPriceHistory(offerId: string, fromDay: number, toDay: number): PricePoint[]
getFxRates(day?: number): Record<Currency, number>
getGroundTruth(offerId: string): GroundTruth | undefined             // eval only
```

## HTTP surface (`src/server.ts`)

```
GET /api/market/products?q=dunk[&day=N]        → search results
GET /api/market/products/:id/offers[?day=N]    → offers with quotes
GET /api/market/offers/:id/quote[?day=N]       → single quote
GET /api/market/offers/:id/history?from=A&to=B → price history
GET /api/market/fx[?day=N]                     → all rates
```

- JSON responses; unknown id → 404 with `{ error }`; malformed params → 400.
- No ground-truth endpoint.
- Same-origin only is not required (read-only mock data), but routes live behind
  the existing Worker fetch handler alongside `/api/realtime`.

## Error handling

- Module: unknown ids return `undefined` / empty arrays; invalid day values are
  clamped (`< 0 → 0`); `fromDay > toDay` → empty history.
- HTTP: 404 unknown id, 400 malformed query/params, everything else 200.

## Testing (`bun test`)

1. **Determinism** — same `(day)` inputs produce byte-identical outputs across
   repeated calls and module reloads.
2. **Trap invariants** — every configured FX-trap offer lands above its EUR
   competitor when naively converted; bait offers always carry ≥2 suspicious
   signals; fake anchors exceed the true 90-day high.
3. **Consistency** — `getPriceHistory` at day _d_ equals `getQuote(offerId, d)`
   sticker; quotes inside promo windows are below base.
4. **Time** — `currentSimDay` maps EPOCH→0, EPOCH+60s→1; `day` override wins.
5. **HTTP** — route handlers return expected shapes and status codes.

## Out of scope

- Landed-cost engine, product-matching logic, alerting, mandate/purchase logic,
  eval harness itself (consumes `getGroundTruth` but lives elsewhere).
- Any UI changes. The voice orb remains untouched.
