import { experimental_getRealtimeToolDefinitions, tool } from 'ai'
import { z } from 'zod'

import { resolveCountryMarket } from './product-markets'
import type { ProductCardData } from './product-types'

export const PRODUCT_SYSTEM_PROMPT = `# Role and objective
You are Markit, a voice-first ecommerce product research agent. Help shoppers discover and compare products using current, verifiable commerce data.

# Language
- Respond entirely in the language of the shopper's latest meaningful message.
- Keep clarification questions, search summaries, recommendations, display headings, and checkout confirmations in that same language.
- If the shopper changes languages, switch immediately. Never infer response language from location, country, or currency.

# Market and currency
- Default to the shopper's stated country. If they have not stated one, use the approximate session country when supplied below.
- Search that country's market in its local currency (for example Poland in PLN/zł), unless the shopper explicitly requests another market or currency.
- A shopper's explicit country, destination, or currency always overrides the session default.
- Pass the effective country to search_products on every search and pass currency whenever a budget or currency is stated.
- If the market is unknown and materially affects currency, availability, compatibility, or delivery, ask which country they are shopping in.

# Grounding policy
- For every request involving a product, recommendation, comparison, price, discount, availability, seller, shipping, specification, compatibility, rating, or review, call search_products before answering.
- Treat search_products results as the only source of truth for current ecommerce facts. Never answer current product questions from memory.
- Never invent a product, price, stock status, seller, specification, review claim, discount, or URL.
- If the results do not verify a claim, say that it could not be verified. Ask one focused follow-up question or suggest a narrower search.
- Treat an explicit budget as a hard constraint. Pass it through minPrice, maxPrice, and currency. Never show or recommend an offer whose verified current price is outside that range, and never assume an offer with an unknown price fits.
- If no verified product matches the requested price range, call control_product_display with action "close", then say plainly that no product was found at that price. Offer to broaden the budget or change one requirement. Do not show fallback or near-budget listings unless the user agrees.
- Clearly distinguish facts found in results from your own concise comparison or recommendation.
- Mention the retailer or source for important facts. Offer to provide the source link when useful.
- Compare current and discounted pricing, delivery or shipping costs, return or warranty evidence, and seller reliability whenever those facts are available.
- Seller reliability is an evidence score, not a guarantee. Explain important limitations and never present the score as a verified certification.

# Scope
- Stay focused on shopping, products, retailers, and ecommerce decisions.
- If a request is unrelated, briefly explain that you specialize in product research and ask what product the user wants help finding.

# Discovery questions
- You MUST ask a discovery question when the request is ambiguous and one missing detail would materially change which products qualify. Do not guess a critical constraint.
- Ask at most one concise question before the first search. Do not turn shopping into an interview.
- When clarification is needed, the entire response must be one question of at most 12 words. Use no preamble, explanation, second question, or implication that a search has started.
- Prioritize category-critical constraints: shoe size for footwear, clothing size for apparel, device or fit compatibility for accessories and parts, and destination country when shipping cost matters.
- If the user says to proceed, choose, continue, use your judgment, or indicates no preference, search immediately with the available information. Do not repeat a question they declined to answer.
- After showing results, ask at most one optional refinement question only when it would clearly improve the next search.

# Tool behavior
- Build a specific search query from the user's requirements, including product type, key constraints, location or currency when known, current and original prices, discounts, shipping or delivery costs, returns, warranty, reviews, and seller reliability.
- When the shopper states any minimum, maximum, or range, always provide the corresponding numeric budget fields to search_products. Do not encode a known budget only inside the query string.
- Search again when the first result set is insufficient, conflicting, stale, or does not answer the user's constraints.
- After a successful product search, call control_product_display with action "show" before giving the spoken answer. Select up to six useful result URLs when the result set is large.
- Call control_product_display with action "close" when the user asks to hide, close, clear, or dismiss the products, when the user is finished shopping, or when the conversation moves away from the displayed results.
- The product display is entirely tool-controlled. Never claim cards are visible or closed unless control_product_display succeeds.
- After every search, a separate independent analysis model audits each listing and annotates the displayed cards automatically. You do not run, control, or see these checks. Never claim a check passed or failed; if asked, explain that the independent check results appear on each card.
- Do not announce raw tool syntax. A short natural preamble such as "I'll check current listings" is appropriate before searching.

# Checkout consent
- Checkout is for the configured Markit Stripe offer. Never claim it purchases, reserves, or pays the third-party retailer listing found by search_products.
- Once the shopper has made a final decision, ask one direct confirmation in their current language: whether they want you to open secure checkout now.
- After the shopper chooses a final option, the spoken response MUST end with that single checkout confirmation question, with nothing after it. Translate the question rather than defaulting to English.
- Asking is mandatory before checkout, but do not pressure the shopper or repeat the question after a refusal.
- Call begin_checkout only after the shopper gives an explicit affirmative answer to that checkout question in the immediately relevant turn.
- Never treat general enthusiasm, selecting a product, saying it looks good, or asking about price as payment consent.
- Before calling begin_checkout, briefly identify that Stripe Checkout will open. Never collect card numbers, security codes, bank details, or passwords in conversation.
- If begin_checkout reports an error, explain it in the shopper's language and do not claim checkout opened.

# Favorites consent
- Save a listing only when the shopper explicitly asks to favorite, favourite, save, or bookmark that specific listing or group of listings.
- Never infer favorite consent from enthusiasm, selecting a recommendation, asking about a product, choosing it for checkout, or completing checkout.
- Call save_favorite_products only for URLs from the latest researched listings. Set confirmedByUser to true only for the shopper's explicit save request.
- If the tool reports that login is required, ask the shopper to log in. Never claim a favorite was saved unless the tool succeeds.
- Do not remove or replace existing favorites. Saving an already-favorited listing may safely refresh its current details.

# Voice style
- Be warm, direct, and concise.
- Give the answer first, then at most three useful options or differences. End each option with the seller reliability score when available.
- Ask only one clarification at a time.
- Do not read long URLs aloud.`

export const productSearchInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2)
    .max(300)
    .describe('A specific product shopping query containing the user requirements'),
  country: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .optional()
    .describe('Country or market to prioritize when the user provides one'),
  maxResults: z
    .number()
    .int()
    .min(3)
    .max(8)
    .optional()
    .describe('Number of product search results to return'),
  minPrice: z
    .number()
    .nonnegative()
    .optional()
    .describe('Hard minimum product price from the shopper, without a currency symbol'),
  maxPrice: z
    .number()
    .positive()
    .optional()
    .describe('Hard maximum product price or budget from the shopper, without a currency symbol'),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .toUpperCase()
    .optional()
    .describe('ISO 4217 currency code for minPrice and maxPrice, such as USD, EUR, GBP, or PLN'),
})

export function productSystemPromptForCountry(countryCode: string | null): string {
  const market = resolveCountryMarket(countryCode ?? undefined)
  if (!market) {
    return `${PRODUCT_SYSTEM_PROMPT}\n\n# Session market context\n- No reliable approximate country is available. Ask for the country when market matters.`
  }
  return `${PRODUCT_SYSTEM_PROMPT}\n\n# Session market context\n- Approximate shopper country: ${market.country}.\n- Default market and currency: ${market.country}, ${market.currency}. This is only a default; follow any user override.`
}

export const productDisplayInputSchema = z.object({
  action: z
    .enum(['show', 'close'])
    .describe('Whether to show product cards or close and remove them'),
  productUrls: z
    .array(z.string().url())
    .max(6)
    .optional()
    .describe('For show, the result URLs to display. Omit to display the strongest results.'),
  heading: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .optional()
    .describe('A short shopper-friendly heading for the product cards'),
})

export const checkoutInputSchema = z.object({
  confirmed: z
    .literal(true)
    .describe('True only after the shopper explicitly confirmed opening Stripe Checkout'),
})

export const favoriteProductsInputSchema = z.object({
  productUrls: z
    .array(z.string().url())
    .min(1)
    .max(6)
    .describe(
      'Exact URLs from the latest search results that the shopper explicitly asked to save',
    ),
  confirmedByUser: z
    .literal(true)
    .describe('True only when the shopper explicitly requested saving these listings'),
})

const productTools = {
  search_products: tool({
    title: 'Agentic product search',
    description:
      'Run Exa deep agentic search over the live web for current products, prices, shipping, availability, returns, warranty, specifications, seller evidence, and reviews. Use before every current product claim.',
    inputSchema: productSearchInputSchema,
    strict: true,
  }),
  control_product_display: tool({
    title: 'Control product display',
    description:
      'Open, update, or close the structured product-card interface. Use show after product research and close when the shopper asks to dismiss results or moves on.',
    inputSchema: productDisplayInputSchema,
    strict: true,
  }),
  begin_checkout: tool({
    title: 'Begin secure checkout',
    description:
      'Open Stripe-hosted Checkout for the configured Markit offer. Call only after asking for final payment confirmation and receiving an explicit affirmative answer.',
    inputSchema: checkoutInputSchema,
    strict: true,
  }),
  save_favorite_products: tool({
    title: 'Save favorite listings',
    description:
      'Save researched listings to the logged-in shopper profile. Call only after the shopper explicitly asks to favorite, favourite, save, or bookmark them.',
    inputSchema: favoriteProductsInputSchema,
    strict: true,
  }),
}

let toolDefinitionsPromise:
  | ReturnType<typeof experimental_getRealtimeToolDefinitions<typeof productTools>>
  | undefined

export function getProductToolDefinitions() {
  toolDefinitionsPromise ??= experimental_getRealtimeToolDefinitions({ tools: productTools })
  return toolDefinitionsPromise
}

type ExaResult = {
  title?: string | null
  url?: string | null
  publishedDate?: string | null
  author?: string | null
  image?: string | null
  favicon?: string | null
  highlights?: string[] | null
}

type ExaResponse = {
  results?: ExaResult[]
  error?: string
  message?: string
}

function sourceName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'unknown source'
  }
}

const PRICE_PATTERN =
  /(?:[$€£]\s?\d[\d\s,.]*(?:\.\d{2})?|\d[\d\s,.]*(?:\.\d{2})?\s?(?:USD|EUR|GBP|PLN|AUD|CAD|CHF|CZK|DKK|HUF|JPY|NOK|NZD|RON|SEK|zł))/i
const DISCOUNT_PATTERN =
  /(?:\b\d{1,2}%\s*off\b|\bsave\s+[$€£]?\s?\d[\d,.]*\b|\bdiscount(?:ed)?\b|\bsale price\b)/i
const SHIPPING_PATTERN = /\b(?:free\s+)?(?:shipping|delivery)|\bships?\s+(?:for|from|within|in)\b/i

function safeAssetUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function parsePrice(
  display: string,
  defaultCurrency?: string,
): { value: number; currency: string } | undefined {
  const currency = display.includes('$')
    ? defaultCurrency && ['USD', 'AUD', 'CAD', 'NZD'].includes(defaultCurrency)
      ? defaultCurrency
      : 'USD'
    : display.includes('€')
      ? 'EUR'
      : display.includes('£')
        ? 'GBP'
        : /zł/i.test(display)
          ? 'PLN'
          : display
              .match(/\b(?:USD|EUR|GBP|PLN|AUD|CAD|CHF|CZK|DKK|HUF|JPY|NOK|NZD|RON|SEK)\b/i)?.[0]
              .toUpperCase()
  const raw = display.match(/\d[\d\s,.]*/)?.[0].replace(/\s/g, '')
  if (!currency || !raw) return undefined

  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  let normalized = raw
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? /\./g : /,/g
    normalized = raw.replace(thousands, '').replace(decimal, '.')
  } else if (lastComma >= 0) {
    normalized = /,\d{2}$/.test(raw)
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
  } else if (lastDot >= 0 && !/\.\d{2}$/.test(raw)) {
    normalized = raw.replace(/\./g, '')
  }

  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? { value, currency } : undefined
}

function findPrice(
  highlights: string[],
  defaultCurrency?: string,
): { display: string; value: number; currency: string } | undefined {
  for (const highlight of highlights) {
    const display = highlight.match(PRICE_PATTERN)?.[0]?.replace(/\s+/g, ' ').trim()
    if (!display) continue
    const parsed = parsePrice(display, defaultCurrency)
    if (parsed) return { display, ...parsed }
  }
  return undefined
}

function findEvidence(
  highlights: string[],
  pattern: RegExp,
  maxLength: number,
): string | undefined {
  for (const highlight of highlights) {
    const sentences = highlight.split(/(?<=[.!?])\s+/)
    const sentence = sentences.find((value) => pattern.test(value))
    if (sentence) return sentence.replace(/\s+/g, ' ').trim().slice(0, maxLength)
  }
  return undefined
}

function sellerReliability(
  highlights: string[],
  publishedDate: string | null | undefined,
  price: string | undefined,
  shipping: string | undefined,
): ProductCardData['sellerReliability'] {
  const evidence = highlights.join(' ')
  const basis = ['Indexed HTTPS seller page']
  let score = 25

  if (/\b(?:official|authorized)\b/i.test(evidence)) {
    score += 20
    basis.push('Official or authorized seller evidence')
  }
  if (/\b(?:return|refund)\b/i.test(evidence)) {
    score += 15
    basis.push('Returns or refunds described')
  }
  if (/\bwarrant(?:y|ies)\b/i.test(evidence)) {
    score += 15
    basis.push('Warranty evidence found')
  }
  if (/\b(?:customer reviews?|ratings?|trustpilot)\b/i.test(evidence)) {
    score += 10
    basis.push('Customer reputation evidence found')
  }
  if (shipping) {
    score += 10
    basis.push('Shipping terms found')
  }
  if (price) {
    score += 5
    basis.push('Price evidence found')
  }
  if (publishedDate) {
    const age = Date.now() - new Date(publishedDate).getTime()
    if (Number.isFinite(age) && age >= 0 && age < 1000 * 60 * 60 * 24 * 548) {
      score += 5
      basis.push('Recent dated source')
    }
  }
  if (/\b(?:scam|counterfeit|fraud|unresolved complaints?)\b/i.test(evidence)) {
    score -= 30
    basis.push('Negative seller signals found')
  }

  const bounded = Math.max(10, Math.min(95, score))
  return {
    score: bounded,
    label: bounded >= 75 ? 'strong' : bounded >= 50 ? 'moderate' : 'limited',
    basis: basis.slice(0, 4),
  }
}

export async function searchProducts(
  input: z.infer<typeof productSearchInputSchema>,
  exaApiKey: string,
): Promise<{
  query: string
  searchedAt: string
  products: ProductCardData[]
}> {
  const parsed = productSearchInputSchema.parse(input)
  const countryMarket = resolveCountryMarket(parsed.country)
  const effectiveCurrency = parsed.currency ?? countryMarket?.currency
  const market = parsed.country ? ` in ${parsed.country}` : ''
  const budget = [
    parsed.minPrice !== undefined ? `minimum ${parsed.minPrice}` : '',
    parsed.maxPrice !== undefined ? `maximum ${parsed.maxPrice}` : '',
    effectiveCurrency || '',
  ]
    .filter(Boolean)
    .join(' ')
  const currencyPreference = effectiveCurrency
    ? ` prices and checkout in ${effectiveCurrency} local currency`
    : ''
  const searchQuery = `${parsed.query}${market}${currencyPreference}${budget ? ` hard price range ${budget}` : ''} current price original price discount sale shipping delivery cost availability returns warranty seller reviews reliability buy retailer product`
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': exaApiKey },
    body: JSON.stringify({
      query: searchQuery,
      type: 'deep',
      numResults:
        parsed.minPrice !== undefined || parsed.maxPrice !== undefined
          ? 8
          : (parsed.maxResults ?? 5),
      contents: { highlights: { maxCharacters: 1_200 } },
    }),
    signal: AbortSignal.timeout(25_000),
  })

  const body = (await response.json()) as ExaResponse
  if (!response.ok)
    throw new Error(body.error || body.message || `Product search failed (${response.status})`)

  const products = (body.results ?? []).flatMap((result) => {
    const title = result.title?.trim()
    const url = result.url?.trim()
    if (!title || !url || !/^https?:\/\//i.test(url)) return []
    const highlights = (result.highlights ?? [])
      .map((value) => value.trim().slice(0, 900))
      .filter(Boolean)
      .slice(0, 4)
    const price = findPrice(highlights, effectiveCurrency)
    const discount = findEvidence(highlights, DISCOUNT_PATTERN, 110)
    const shipping = findEvidence(highlights, SHIPPING_PATTERN, 150)
    const reliability = sellerReliability(
      highlights,
      result.publishedDate,
      price?.display,
      shipping,
    )
    const image = safeAssetUrl(result.image)
    const favicon = safeAssetUrl(result.favicon)
    return [
      {
        title: title.slice(0, 240),
        url,
        source: sourceName(url),
        ...(price
          ? { price: price.display, priceValue: price.value, priceCurrency: price.currency }
          : {}),
        ...(discount ? { discount } : {}),
        ...(shipping ? { shipping } : {}),
        sellerReliability: reliability,
        ...(image ? { image } : {}),
        ...(favicon ? { favicon } : {}),
        ...(result.publishedDate ? { publishedDate: result.publishedDate } : {}),
        highlights,
      },
    ]
  })

  const matchingProducts = products.filter((product) => {
    const hasBudget = parsed.minPrice !== undefined || parsed.maxPrice !== undefined
    if (!hasBudget && !effectiveCurrency) return true
    if (product.priceValue === undefined || !product.priceCurrency) return false
    if (effectiveCurrency && product.priceCurrency !== effectiveCurrency) return false
    if (parsed.minPrice !== undefined && product.priceValue < parsed.minPrice) return false
    if (parsed.maxPrice !== undefined && product.priceValue > parsed.maxPrice) return false
    return true
  })

  return {
    query: parsed.query,
    searchedAt: new Date().toISOString(),
    budget:
      parsed.minPrice !== undefined || parsed.maxPrice !== undefined
        ? { minPrice: parsed.minPrice, maxPrice: parsed.maxPrice, currency: effectiveCurrency }
        : undefined,
    products: matchingProducts,
    ...(matchingProducts.length === 0 &&
    (parsed.minPrice !== undefined || parsed.maxPrice !== undefined)
      ? { message: 'No product with a verified current price matched the requested range.' }
      : {}),
  }
}
