export type ProductCardData = {
  title: string
  url: string
  source: string
  price?: string
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
