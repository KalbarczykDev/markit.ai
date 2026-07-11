export type MockMarket = {
  code: string
  country: string
  currency: string
  rate: number
  taxRate: number
  taxIncluded: boolean
  shipping: number
  deliveryDays: [number, number]
}

export type MockProductTemplate = {
  name: string
  category: string
  keywords: string[]
  basePrice: number
  brand: string
  description: string
  specifications: Record<string, string>
}
