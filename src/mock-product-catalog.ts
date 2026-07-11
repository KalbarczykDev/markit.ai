import type { MockMarket, MockProductTemplate } from './mock-catalog-types'
import { MOCK_MARKETS } from './mock-markets'
import { MOCK_TEMPLATES } from './mock-templates'
import type { ProductCardData } from './product-types'

type MockSearchInput = {
  query: string
  country?: string
  currency?: string
  minPrice?: number
  maxPrice?: number
  maxResults?: number
}

const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB',
  usa: 'US',
  polska: 'PL',
  poland: 'PL',
  germany: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  canada: 'CA',
  australia: 'AU',
  japan: 'JP',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  austria: 'AT',
  belgium: 'BE',
  switzerland: 'CH',
  czechia: 'CZ',
  hungary: 'HU',
  ireland: 'IE',
  netherlands: 'NL',
  portugal: 'PT',
  romania: 'RO',
  slovakia: 'SK',
  'united kingdom': 'GB',
  'united states': 'US',
  'new zealand': 'NZ',
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: ['JPY', 'HUF'].includes(currency) ? 0 : 2,
  }).format(value)
}

function roundMoney(value: number, currency: string): number {
  return Number(value.toFixed(['JPY', 'HUF'].includes(currency) ? 0 : 2))
}

function buildProduct(
  template: MockProductTemplate,
  market: MockMarket,
  templateIndex: number,
): ProductCardData {
  const listPrice = roundMoney(
    template.basePrice * market.rate * (1 + (templateIndex % 3) * 0.025),
    market.currency,
  )
  const discountPercent = [0, 10, 15, 20, 25][templateIndex % 5]
  const price = roundMoney(listPrice * (1 - discountPercent / 100), market.currency)
  const shippingAmount = price >= 150 * market.rate ? 0 : market.shipping
  const taxAmount = roundMoney(price * market.taxRate, market.currency)
  const total = roundMoney(
    price + shippingAmount + (market.taxIncluded ? 0 : taxAmount),
    market.currency,
  )
  const stock = 4 + ((templateIndex * 17 + market.code.charCodeAt(0)) % 43)
  const sellerScore = 76 + ((templateIndex * 7 + market.code.charCodeAt(1)) % 20)
  const seller = `${template.brand} ${market.country} Store`
  const taxText = market.taxIncluded
    ? `${money(taxAmount, market.currency)} ${Math.round(market.taxRate * 100)}% tax included in price`
    : `${money(taxAmount, market.currency)} estimated ${Math.round(market.taxRate * 10000) / 100}% tax added at checkout`
  const shippingText =
    shippingAmount === 0
      ? 'Free tracked shipping'
      : `${money(shippingAmount, market.currency)} tracked shipping`

  return {
    title: `${template.brand} ${template.name}`,
    url: `https://example.com/markit-mock/${market.code.toLowerCase()}/${templateIndex + 1}`,
    source: 'Markit mock catalog',
    price: money(price, market.currency),
    priceValue: price,
    priceCurrency: market.currency,
    discount: discountPercent
      ? `${discountPercent}% off; mock list price ${money(listPrice, market.currency)}`
      : 'No promotional discount',
    shipping: `${shippingText}; estimated delivery ${market.deliveryDays[0]}–${market.deliveryDays[1]} business days`,
    sellerReliability: {
      score: sellerScore,
      label: sellerScore >= 75 ? 'strong' : sellerScore >= 50 ? 'moderate' : 'limited',
      basis: [
        'Mock verified seller profile',
        'Tracked fulfillment',
        '30-day returns',
        'Two-year warranty',
      ],
    },
    publishedDate: '2026-07-11T00:00:00.000Z',
    highlights: [
      `${template.description} Mock offer for ${market.country}; ${stock} units marked in stock.`,
      `${shippingText}. Dispatches in one business day; delivery estimate ${market.deliveryDays[0]}–${market.deliveryDays[1]} business days with tracking.`,
      `${taxText}. Estimated checkout total ${money(total, market.currency)}; no mock import duty for domestic delivery.`,
      `Sold by ${seller}; 30-day prepaid returns in original condition and a two-year limited manufacturer warranty.`,
    ],
    mock: true,
    market: { country: market.country, countryCode: market.code, currency: market.currency },
    pricing: {
      listPrice,
      salePrice: price,
      discountPercent,
      taxRate: market.taxRate,
      estimatedTax: taxAmount,
      taxIncluded: market.taxIncluded,
      shipping: shippingAmount,
      estimatedTotal: total,
    },
    fulfillment: {
      availability: 'in_stock',
      stockCount: stock,
      dispatchDays: 1,
      deliveryDays: market.deliveryDays,
      tracked: true,
      carrier: ['DHL', 'DPD', 'UPS'][templateIndex % 3],
      pickupAvailable: templateIndex % 3 === 0,
    },
    returns: {
      windowDays: 30,
      prepaid: true,
      restockingFee: 0,
      condition: 'Original condition with included accessories',
    },
    warranty: {
      durationMonths: 24,
      provider: 'Manufacturer',
      coverage: 'Parts and labor for manufacturing defects',
    },
    seller: {
      name: seller,
      rating: Number((4.3 + (sellerScore % 7) / 10).toFixed(1)),
      reviewCount: 850 + templateIndex * 137,
      authorized: true,
    },
    specifications: { category: template.category, ...template.specifications },
    searchTerms: [template.category, template.brand, template.name, ...template.keywords],
  }
}

export const MOCK_PRODUCT_CATALOG: ProductCardData[] = MOCK_MARKETS.flatMap((market) =>
  MOCK_TEMPLATES.map((template, index) => buildProduct(template, market, index)),
)

function countryCode(country: string | undefined): string | undefined {
  if (!country) return undefined
  const normalized = country.trim()
  return normalized.length === 2
    ? normalized.toUpperCase()
    : COUNTRY_ALIASES[normalized.toLowerCase()]
}

function queryTokens(query: string): string[] {
  return (
    query
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length > 1) ?? []
  )
}

export function searchMockProducts(input: MockSearchInput): ProductCardData[] {
  const code = countryCode(input.country)
  const tokens = queryTokens(input.query)
  return MOCK_PRODUCT_CATALOG.filter((product) => {
    if (code && product.market?.countryCode !== code) return false
    if (input.currency && product.priceCurrency !== input.currency) return false
    if (input.minPrice !== undefined && (product.priceValue ?? -1) < input.minPrice) return false
    if (input.maxPrice !== undefined && (product.priceValue ?? Infinity) > input.maxPrice)
      return false
    return true
  })
    .map((product) => {
      const haystack = [product.title, product.highlights[0], ...(product.searchTerms ?? [])]
        .join(' ')
        .toLowerCase()
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0)
      return { product, score }
    })
    .filter(({ score }) => tokens.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || (a.product.priceValue ?? 0) - (b.product.priceValue ?? 0))
    .slice(0, input.maxResults ?? 5)
    .map(({ product }) => product)
}
