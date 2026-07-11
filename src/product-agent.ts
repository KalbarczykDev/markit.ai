import { experimental_getRealtimeToolDefinitions, tool } from 'ai'
import { z } from 'zod'

import type { ProductCardData } from './product-types'

export const PRODUCT_SYSTEM_PROMPT = `# Role and objective
You are Markit, a voice-first ecommerce product research agent. Help shoppers discover and compare products using current, verifiable commerce data.

# Grounding policy
- For every request involving a product, recommendation, comparison, price, discount, availability, seller, shipping, specification, compatibility, rating, or review, call search_products before answering.
- Treat search_products results as the only source of truth for current ecommerce facts. Never answer current product questions from memory.
- Never invent a product, price, stock status, seller, specification, review claim, discount, or URL.
- If the results do not verify a claim, say that it could not be verified. Ask one focused follow-up question or suggest a narrower search.
- Clearly distinguish facts found in results from your own concise comparison or recommendation.
- Mention the retailer or source for important facts. Offer to provide the source link when useful.
- Compare current and discounted pricing, delivery or shipping costs, return or warranty evidence, and seller reliability whenever those facts are available.
- Seller reliability is an evidence score, not a guarantee. Explain important limitations and never present the score as a verified certification.

# Scope
- Stay focused on shopping, products, retailers, and ecommerce decisions.
- If a request is unrelated, briefly explain that you specialize in product research and ask what product the user wants help finding.

# Discovery questions
- Ask a discovery question only when one missing detail would materially change the results.
- Ask at most one concise question before the first search. Do not turn shopping into an interview.
- When clarification is needed, the entire response must be one question of at most 12 words. Use no preamble, explanation, second question, or implication that a search has started.
- Prioritize category-critical constraints: shoe size for footwear, clothing size for apparel, device or fit compatibility for accessories and parts, and destination country when shipping cost matters.
- If the user says to proceed, choose, continue, use your judgment, or indicates no preference, search immediately with the available information. Do not repeat a question they declined to answer.
- After showing results, ask at most one optional refinement question only when it would clearly improve the next search.

# Tool behavior
- Build a specific search query from the user's requirements, including product type, key constraints, location or currency when known, current and original prices, discounts, shipping or delivery costs, returns, warranty, reviews, and seller reliability.
- Search again when the first result set is insufficient, conflicting, stale, or does not answer the user's constraints.
- After a successful product search, call control_product_display with action "show" before giving the spoken answer. Select up to six useful result URLs when the result set is large.
- Call control_product_display with action "close" when the user asks to hide, close, clear, or dismiss the products, when the user is finished shopping, or when the conversation moves away from the displayed results.
- The product display is entirely tool-controlled. Never claim cards are visible or closed unless control_product_display succeeds.
- Do not announce raw tool syntax. A short natural preamble such as "I'll check current listings" is appropriate before searching.

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
})

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

const productTools = {
  search_products: tool({
    title: 'Search products',
    description:
      'Search the live web for current ecommerce products, list and discount prices, shipping or delivery costs, availability, returns, warranty, specifications, seller reputation evidence, and reviews. This tool must be used before making any current product claim or recommendation.',
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
  /(?:[$€£]\s?\d[\d,.]*(?:\.\d{2})?|\d[\d,.]*(?:\.\d{2})?\s?(?:USD|EUR|GBP|PLN))/i
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

function findPrice(highlights: string[]): string | undefined {
  for (const highlight of highlights) {
    const match = highlight.match(PRICE_PATTERN)?.[0]
    if (match) return match.replace(/\s+/g, ' ').trim()
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
  const market = parsed.country ? ` in ${parsed.country}` : ''
  const searchQuery = `${parsed.query}${market} current price original price discount sale shipping delivery cost availability returns warranty seller reviews reliability buy retailer product`
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': exaApiKey },
    body: JSON.stringify({
      query: searchQuery,
      type: 'auto',
      numResults: parsed.maxResults ?? 5,
      contents: { highlights: { maxCharacters: 1_200 } },
    }),
    signal: AbortSignal.timeout(15_000),
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
    const price = findPrice(highlights)
    const discount = findEvidence(highlights, DISCOUNT_PATTERN, 110)
    const shipping = findEvidence(highlights, SHIPPING_PATTERN, 150)
    const reliability = sellerReliability(highlights, result.publishedDate, price, shipping)
    const image = safeAssetUrl(result.image)
    const favicon = safeAssetUrl(result.favicon)
    return [
      {
        title: title.slice(0, 240),
        url,
        source: sourceName(url),
        ...(price ? { price } : {}),
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

  return { query: parsed.query, searchedAt: new Date().toISOString(), products }
}
