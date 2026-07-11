export type AnalysisVerdict = 'clear' | 'caution' | 'unverified'

export type ProductCheck = {
  id: 'price' | 'offer' | 'seller'
  label: string
  verdict: AnalysisVerdict
  note: string
}

export type ProductAnalysis = {
  status: 'complete' | 'failed'
  model: string
  summary?: string
  checks: ProductCheck[]
}

export type ProductCardData = {
  title: string
  url: string
  source: string
  price?: string
  priceValue?: number
  priceCurrency?: string
  discount?: string
  shipping?: string
  sellerReliability: {
    score: number
    label: 'limited' | 'moderate' | 'strong'
    basis: string[]
  }
  image?: string
  favicon?: string
  publishedDate?: string
  highlights: string[]
  mock?: boolean
  market?: { country: string; countryCode: string; currency: string }
  pricing?: {
    listPrice: number
    salePrice: number
    discountPercent: number
    taxRate: number
    estimatedTax: number
    taxIncluded: boolean
    shipping: number
    estimatedTotal: number
  }
  fulfillment?: {
    availability: 'in_stock' | 'out_of_stock' | 'preorder'
    stockCount: number
    dispatchDays: number
    deliveryDays: [number, number]
    tracked: boolean
    carrier: string
    pickupAvailable: boolean
  }
  returns?: {
    windowDays: number
    prepaid: boolean
    restockingFee: number
    condition: string
  }
  warranty?: { durationMonths: number; provider: string; coverage: string }
  seller?: { name: string; rating: number; reviewCount: number; authorized: boolean }
  specifications?: Record<string, string>
  searchTerms?: string[]
}
