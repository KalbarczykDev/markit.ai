export type AnalysisVerdict = 'clear' | 'caution' | 'unverified'

export type ProductCheck = {
  id: 'price' | 'offer' | 'seller'
  label: string
  verdict: AnalysisVerdict
  note: string
}

export type ProductDecision =
  | 'ask_user'
  | 'reject'
  | 'present_match'
  | 'wait_and_monitor'
  | 'propose_alternatives'

export type ProductAnalysis = {
  status: 'complete' | 'failed'
  model: string
  decision?: ProductDecision
  decisionReason?: string
  summary?: string
  allInCost?: { value: number | null; currency: string | null; reliable: boolean }
  missingInformation?: string[]
  sources?: { title: string; url: string }[]
  checks: ProductCheck[]
}

export type ProductViewMode = 'list' | 'grid' | 'table'
export type ProductSortMode = 'relevance' | 'price_asc' | 'price_desc' | 'reliability_desc'

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
}
