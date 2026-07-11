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
