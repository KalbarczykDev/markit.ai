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

# Scope
- Stay focused on shopping, products, retailers, and ecommerce decisions.
- If a request is unrelated, briefly explain that you specialize in product research and ask what product the user wants help finding.

# Tool behavior
- Build a specific search query from the user's requirements, including product type, key constraints, location or currency when known, and intent such as current price or availability.
- Search again when the first result set is insufficient, conflicting, stale, or does not answer the user's constraints.
- After a successful product search, call control_product_display with action "show" before giving the spoken answer. Select up to six useful result URLs when the result set is large.
- Call control_product_display with action "close" when the user asks to hide, close, clear, or dismiss the products, when the user is finished shopping, or when the conversation moves away from the displayed results.
- The product display is entirely tool-controlled. Never claim cards are visible or closed unless control_product_display succeeds.
- Do not announce raw tool syntax. A short natural preamble such as "I'll check current listings" is appropriate before searching.

# Voice style
- Be warm, direct, and concise.
- Give the answer first, then at most three useful options or differences.
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
      'Search the live web for current ecommerce products, retailer listings, prices, availability, specifications, and reviews. This tool must be used before making any current product claim or recommendation.',
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
  const searchQuery = `${parsed.query}${market} current price availability buy retailer product`
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': exaApiKey },
    body: JSON.stringify({
      query: searchQuery,
      type: 'auto',
      numResults: parsed.maxResults ?? 5,
      contents: { highlights: { maxCharacters: 900 } },
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
      .slice(0, 3)
    const price = findPrice(highlights)
    const image = safeAssetUrl(result.image)
    const favicon = safeAssetUrl(result.favicon)
    return [
      {
        title: title.slice(0, 240),
        url,
        source: sourceName(url),
        ...(price ? { price } : {}),
        ...(image ? { image } : {}),
        ...(favicon ? { favicon } : {}),
        ...(result.publishedDate ? { publishedDate: result.publishedDate } : {}),
        highlights,
      },
    ]
  })

  return { query: parsed.query, searchedAt: new Date().toISOString(), products }
}
