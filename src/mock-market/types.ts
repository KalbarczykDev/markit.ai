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
