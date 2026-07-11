import type { ProductCardData } from './product-types'

type MockSearchInput = {
  query: string
  country?: string
  currency?: string
  minPrice?: number
  maxPrice?: number
  maxResults?: number
}

type Market = {
  code: string
  country: string
  currency: string
  rate: number
  taxRate: number
  taxIncluded: boolean
  shipping: number
  deliveryDays: [number, number]
}

type Template = {
  name: string
  category: string
  keywords: string[]
  basePrice: number
  brand: string
  description: string
  specifications: Record<string, string>
}

const MARKETS: Market[] = [
  {
    code: 'AT',
    country: 'Austria',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.2,
    taxIncluded: true,
    shipping: 5.9,
    deliveryDays: [2, 5],
  },
  {
    code: 'AU',
    country: 'Australia',
    currency: 'AUD',
    rate: 1.52,
    taxRate: 0.1,
    taxIncluded: true,
    shipping: 12,
    deliveryDays: [3, 7],
  },
  {
    code: 'BE',
    country: 'Belgium',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.21,
    taxIncluded: true,
    shipping: 5.5,
    deliveryDays: [2, 5],
  },
  {
    code: 'CA',
    country: 'Canada',
    currency: 'CAD',
    rate: 1.36,
    taxRate: 0.13,
    taxIncluded: false,
    shipping: 9.5,
    deliveryDays: [3, 7],
  },
  {
    code: 'CH',
    country: 'Switzerland',
    currency: 'CHF',
    rate: 0.9,
    taxRate: 0.081,
    taxIncluded: true,
    shipping: 8.9,
    deliveryDays: [2, 6],
  },
  {
    code: 'CZ',
    country: 'Czechia',
    currency: 'CZK',
    rate: 23.1,
    taxRate: 0.21,
    taxIncluded: true,
    shipping: 109,
    deliveryDays: [2, 5],
  },
  {
    code: 'DE',
    country: 'Germany',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.19,
    taxIncluded: true,
    shipping: 4.9,
    deliveryDays: [2, 4],
  },
  {
    code: 'DK',
    country: 'Denmark',
    currency: 'DKK',
    rate: 6.87,
    taxRate: 0.25,
    taxIncluded: true,
    shipping: 49,
    deliveryDays: [2, 5],
  },
  {
    code: 'ES',
    country: 'Spain',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.21,
    taxIncluded: true,
    shipping: 5.9,
    deliveryDays: [2, 6],
  },
  {
    code: 'FI',
    country: 'Finland',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.255,
    taxIncluded: true,
    shipping: 6.9,
    deliveryDays: [3, 7],
  },
  {
    code: 'FR',
    country: 'France',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.2,
    taxIncluded: true,
    shipping: 5.9,
    deliveryDays: [2, 5],
  },
  {
    code: 'GB',
    country: 'United Kingdom',
    currency: 'GBP',
    rate: 0.79,
    taxRate: 0.2,
    taxIncluded: true,
    shipping: 4.5,
    deliveryDays: [2, 5],
  },
  {
    code: 'HU',
    country: 'Hungary',
    currency: 'HUF',
    rate: 358,
    taxRate: 0.27,
    taxIncluded: true,
    shipping: 1890,
    deliveryDays: [2, 6],
  },
  {
    code: 'IE',
    country: 'Ireland',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.23,
    taxIncluded: true,
    shipping: 6.5,
    deliveryDays: [2, 6],
  },
  {
    code: 'IT',
    country: 'Italy',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.22,
    taxIncluded: true,
    shipping: 5.9,
    deliveryDays: [2, 6],
  },
  {
    code: 'JP',
    country: 'Japan',
    currency: 'JPY',
    rate: 149,
    taxRate: 0.1,
    taxIncluded: true,
    shipping: 900,
    deliveryDays: [2, 6],
  },
  {
    code: 'NL',
    country: 'Netherlands',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.21,
    taxIncluded: true,
    shipping: 4.9,
    deliveryDays: [1, 4],
  },
  {
    code: 'NO',
    country: 'Norway',
    currency: 'NOK',
    rate: 10.6,
    taxRate: 0.25,
    taxIncluded: true,
    shipping: 79,
    deliveryDays: [3, 7],
  },
  {
    code: 'NZ',
    country: 'New Zealand',
    currency: 'NZD',
    rate: 1.64,
    taxRate: 0.15,
    taxIncluded: true,
    shipping: 14,
    deliveryDays: [3, 8],
  },
  {
    code: 'PL',
    country: 'Poland',
    currency: 'PLN',
    rate: 3.98,
    taxRate: 0.23,
    taxIncluded: true,
    shipping: 14.99,
    deliveryDays: [1, 4],
  },
  {
    code: 'PT',
    country: 'Portugal',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.23,
    taxIncluded: true,
    shipping: 6.5,
    deliveryDays: [2, 7],
  },
  {
    code: 'RO',
    country: 'Romania',
    currency: 'RON',
    rate: 4.58,
    taxRate: 0.19,
    taxIncluded: true,
    shipping: 24,
    deliveryDays: [2, 6],
  },
  {
    code: 'SE',
    country: 'Sweden',
    currency: 'SEK',
    rate: 10.4,
    taxRate: 0.25,
    taxIncluded: true,
    shipping: 59,
    deliveryDays: [2, 6],
  },
  {
    code: 'SK',
    country: 'Slovakia',
    currency: 'EUR',
    rate: 0.92,
    taxRate: 0.23,
    taxIncluded: true,
    shipping: 5.5,
    deliveryDays: [2, 5],
  },
  {
    code: 'US',
    country: 'United States',
    currency: 'USD',
    rate: 1,
    taxRate: 0.0825,
    taxIncluded: false,
    shipping: 7.99,
    deliveryDays: [2, 6],
  },
]

const TEMPLATES: Template[] = [
  {
    name: 'AeroRun Daily 5',
    category: 'Running shoes',
    keywords: ['shoes', 'running', 'sneakers', 'road', 'wide'],
    basePrice: 95,
    brand: 'StrideLab',
    description: 'Cushioned everyday road runner with a breathable engineered-mesh upper.',
    specifications: { weight: '268 g', drop: '8 mm', fit: 'regular and wide', surface: 'road' },
  },
  {
    name: 'TrailPeak Grip Pro',
    category: 'Trail shoes',
    keywords: ['shoes', 'running', 'trail', 'hiking', 'waterproof'],
    basePrice: 138,
    brand: 'Northpath',
    description: 'Protective trail shoe with deep lugs and a water-resistant upper.',
    specifications: { weight: '312 g', drop: '6 mm', lugs: '5 mm', surface: 'trail' },
  },
  {
    name: 'QuietWave ANC 4',
    category: 'Headphones',
    keywords: ['headphones', 'audio', 'wireless', 'bluetooth', 'noise cancelling'],
    basePrice: 249,
    brand: 'SonicArc',
    description: 'Over-ear wireless headphones with adaptive active noise cancellation.',
    specifications: {
      battery: '38 hours',
      codec: 'AAC and LDAC',
      weight: '254 g',
      charging: 'USB-C',
    },
  },
  {
    name: 'PocketBeat Buds S',
    category: 'Earbuds',
    keywords: ['earbuds', 'audio', 'wireless', 'bluetooth', 'sports'],
    basePrice: 119,
    brand: 'SonicArc',
    description: 'Compact IPX5 earbuds with multipoint pairing and transparency mode.',
    specifications: {
      battery: '8 + 24 hours',
      protection: 'IPX5',
      microphones: '6',
      charging: 'USB-C and Qi',
    },
  },
  {
    name: 'WorkBook Air 14',
    category: 'Laptop',
    keywords: ['laptop', 'computer', 'work', 'student', 'ultrabook'],
    basePrice: 899,
    brand: 'Nova Computing',
    description: 'Portable 14-inch productivity laptop with all-day battery life.',
    specifications: {
      processor: '8-core N2',
      memory: '16 GB',
      storage: '512 GB SSD',
      display: '14-inch 2.5K',
    },
  },
  {
    name: 'CreatorBook Studio 16',
    category: 'Laptop',
    keywords: ['laptop', 'computer', 'creator', 'gaming', 'video editing'],
    basePrice: 1699,
    brand: 'Nova Computing',
    description: 'High-performance laptop for editing, 3D work, and demanding applications.',
    specifications: {
      processor: '12-core N2 Pro',
      memory: '32 GB',
      storage: '1 TB SSD',
      graphics: 'Studio 4070 8 GB',
    },
  },
  {
    name: 'PixelOne 9 256GB',
    category: 'Smartphone',
    keywords: ['phone', 'smartphone', 'android', 'camera', '5g'],
    basePrice: 699,
    brand: 'PixelOne',
    description: '5G smartphone with a bright OLED display and stabilized main camera.',
    specifications: {
      storage: '256 GB',
      display: '6.3-inch OLED',
      camera: '50 MP',
      protection: 'IP68',
    },
  },
  {
    name: 'ViewMax 27Q',
    category: 'Monitor',
    keywords: ['monitor', 'display', 'gaming', 'office', 'usb-c'],
    basePrice: 329,
    brand: 'ClearView',
    description: 'Color-calibrated 27-inch monitor with USB-C power delivery.',
    specifications: {
      resolution: '2560 × 1440',
      refresh: '165 Hz',
      panel: 'IPS',
      ports: 'USB-C, HDMI, DisplayPort',
    },
  },
  {
    name: 'TypeCraft 75',
    category: 'Keyboard',
    keywords: ['keyboard', 'mechanical', 'gaming', 'wireless', 'office'],
    basePrice: 149,
    brand: 'KeyFoundry',
    description: 'Hot-swappable 75% mechanical keyboard with three connection modes.',
    specifications: {
      switches: 'tactile',
      layout: '75%',
      connection: '2.4 GHz, Bluetooth, USB-C',
      battery: '4000 mAh',
    },
  },
  {
    name: 'BaristaFlow 12',
    category: 'Coffee maker',
    keywords: ['coffee', 'espresso', 'coffee maker', 'kitchen', 'barista'],
    basePrice: 479,
    brand: 'Daily Roast',
    description: 'Thermoblock espresso machine with an integrated conical-burr grinder.',
    specifications: { pressure: '15 bar', grinder: '30 settings', tank: '2 L', power: '1450 W' },
  },
  {
    name: 'GlowBalance Routine Set',
    category: 'Skincare',
    keywords: ['skincare', 'beauty', 'serum', 'moisturizer', 'sensitive skin'],
    basePrice: 72,
    brand: 'Kindred Skin',
    description: 'Fragrance-free cleanser, serum, and moisturizer routine for sensitive skin.',
    specifications: {
      products: '3 full-size items',
      skinType: 'normal to sensitive',
      fragrance: 'none',
      testing: 'dermatologist tested',
    },
  },
  {
    name: 'CleanBot L8',
    category: 'Robot vacuum',
    keywords: ['vacuum', 'robot', 'cleaner', 'home', 'pet hair'],
    basePrice: 549,
    brand: 'HomePilot',
    description: 'LiDAR robot vacuum with room mapping and automatic carpet boost.',
    specifications: { suction: '7000 Pa', runtime: '180 minutes', mapping: 'LiDAR', bin: '450 ml' },
  },
  {
    name: 'PawServe Smart 5L',
    category: 'Pet feeder',
    keywords: ['pet', 'dog', 'cat', 'feeder', 'automatic', 'smart home'],
    basePrice: 139,
    brand: 'Companion Tech',
    description: 'App-connected automatic pet feeder with portion scheduling and backup power.',
    specifications: {
      capacity: '5 L',
      portions: '1–10 per meal',
      connectivity: '2.4 GHz Wi-Fi',
      backup: '3 D-cell batteries',
    },
  },
  {
    name: 'StormShell 3L',
    category: 'Rain jacket',
    keywords: ['jacket', 'clothing', 'rain', 'waterproof', 'hiking'],
    basePrice: 189,
    brand: 'Northpath',
    description: 'Three-layer waterproof shell designed for wet and windy conditions.',
    specifications: {
      waterproofing: '20,000 mm',
      breathability: '15,000 g/m²',
      fit: 'unisex',
      sizes: 'XS–XXL',
    },
  },
  {
    name: 'TorqueDrive 18V Kit',
    category: 'Power tools',
    keywords: ['tools', 'drill', 'driver', 'diy', 'construction', 'cordless'],
    basePrice: 179,
    brand: 'ForgeWorks',
    description: 'Cordless drill-driver kit for home repairs, assembly, and light construction.',
    specifications: {
      voltage: '18 V',
      torque: '65 Nm',
      batteries: '2 × 2.0 Ah',
      chuck: '13 mm keyless',
    },
  },
  {
    name: 'TransitPack 28',
    category: 'Backpack',
    keywords: ['backpack', 'bag', 'travel', 'laptop', 'carry on'],
    basePrice: 129,
    brand: 'CarryWorks',
    description: 'Clamshell travel backpack with a suspended laptop compartment.',
    specifications: {
      capacity: '28 L',
      laptop: 'up to 16 inches',
      material: 'recycled nylon',
      weight: '1.1 kg',
    },
  },
  {
    name: 'NestView Baby Pro',
    category: 'Baby monitor',
    keywords: ['baby', 'monitor', 'nursery', 'camera', 'parenting', 'video'],
    basePrice: 199,
    brand: 'NestView',
    description: 'Encrypted video baby monitor with a dedicated parent display and night vision.',
    specifications: {
      video: '2K camera',
      display: '5-inch parent unit',
      range: '300 m line of sight',
      features: 'night vision and temperature alerts',
    },
  },
  {
    name: 'FitTrack Active 3',
    category: 'Smartwatch',
    keywords: ['watch', 'smartwatch', 'fitness', 'running', 'gps'],
    basePrice: 229,
    brand: 'PulseMetric',
    description: 'GPS fitness watch with recovery guidance and offline route tracking.',
    specifications: {
      battery: '10 days',
      protection: '5 ATM',
      positioning: 'dual-band GPS',
      display: 'AMOLED',
    },
  },
  {
    name: 'GameBox Series V',
    category: 'Game console',
    keywords: ['console', 'gaming', 'video games', 'controller', '4k'],
    basePrice: 499,
    brand: 'GameBox',
    description: 'Current-generation home console for 4K gaming and media playback.',
    specifications: {
      storage: '1 TB SSD',
      output: 'up to 4K 120 Hz',
      controller: 'included',
      drive: 'disc',
    },
  },
  {
    name: 'TabCanvas 11',
    category: 'Tablet',
    keywords: ['tablet', 'student', 'drawing', 'android', 'portable'],
    basePrice: 449,
    brand: 'PixelOne',
    description: 'Portable 11-inch tablet with pressure-sensitive pen support.',
    specifications: {
      storage: '256 GB',
      display: '11-inch 120 Hz',
      battery: '12 hours',
      pen: 'supported, sold separately',
    },
  },
]

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

function buildProduct(template: Template, market: Market, templateIndex: number): ProductCardData {
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

export const MOCK_PRODUCT_CATALOG: ProductCardData[] = MARKETS.flatMap((market) =>
  TEMPLATES.map((template, index) => buildProduct(template, market, index)),
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
