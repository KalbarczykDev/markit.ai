import { experimental_getRealtimeToolDefinitions, tool } from 'ai'
import { z } from 'zod'

import { MOCK_PRODUCT_CATALOG, searchMockProducts } from './mock-product-catalog'
import type { ProductCardData } from './product-types'

export const PRODUCT_SYSTEM_PROMPT = `# Role and objective
You are Markit, a voice-first ecommerce product research agent. Help shoppers discover and compare products using the provided mock commerce catalog.

# Mock-data mode
- search_products reads a synthetic catalog of exactly 500 offers. It does not search the live web.
- Clearly call results mock or simulated. Never describe mock prices, stock, taxes, delivery estimates, sellers, reviews, or policies as live or currently verified.
- Use the structured mock tax, shipping, checkout-total, returns, warranty, seller, stock, and specification fields when answering.

# Market and currency
- Default to the shopper's stated country. If they have not stated one, use the approximate session country when supplied below.
- Search that country's market in its local currency (for example Poland in PLN/zł), unless the shopper explicitly requests another market or currency.
- A shopper's explicit country, destination, or currency always overrides the session default. Never "correct" their chosen currency back to the local one.
- Pass the effective country to search_products on every search. Pass currency whenever a budget or currency is stated.
- If neither the conversation nor session context establishes the market and it materially affects currency, availability, compatibility, or delivery, ask which country they are shopping in before searching.
- If the shopper rejects the local currency without naming another one, ask which currency to use.

# Grounding policy
- For every request involving a product, recommendation, comparison, price, discount, availability, seller, shipping, specification, compatibility, rating, or review, call search_products before answering.
- Treat search_products results as the only source of truth for mock ecommerce facts. Never answer product questions from memory.
- Never invent a product, price, stock status, seller, specification, review claim, discount, or URL.
- If the results do not verify a claim, say that it could not be verified. Ask one focused follow-up question or suggest a narrower search.
- Treat an explicit budget as a hard constraint. Pass it through minPrice, maxPrice, and currency. Never show or recommend a mock offer whose listed price is outside that range, and never assume an offer with an unknown price fits.
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
- Do not announce raw tool syntax. A short natural preamble such as "I'll check the mock catalog" is appropriate before searching.

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
    .describe('Effective shopper country or market to prioritize for every search when known'),
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
    .describe(
      'Explicit ISO 4217 currency override, or the currency for minPrice and maxPrice, such as USD, EUR, GBP, or PLN',
    ),
})

const COUNTRY_MARKETS: Record<string, { country: string; currency: string }> = {
  AT: { country: 'Austria', currency: 'EUR' },
  AU: { country: 'Australia', currency: 'AUD' },
  BE: { country: 'Belgium', currency: 'EUR' },
  CA: { country: 'Canada', currency: 'CAD' },
  CH: { country: 'Switzerland', currency: 'CHF' },
  CZ: { country: 'Czechia', currency: 'CZK' },
  DE: { country: 'Germany', currency: 'EUR' },
  DK: { country: 'Denmark', currency: 'DKK' },
  ES: { country: 'Spain', currency: 'EUR' },
  FI: { country: 'Finland', currency: 'EUR' },
  FR: { country: 'France', currency: 'EUR' },
  GB: { country: 'United Kingdom', currency: 'GBP' },
  HU: { country: 'Hungary', currency: 'HUF' },
  IE: { country: 'Ireland', currency: 'EUR' },
  IT: { country: 'Italy', currency: 'EUR' },
  JP: { country: 'Japan', currency: 'JPY' },
  NL: { country: 'Netherlands', currency: 'EUR' },
  NO: { country: 'Norway', currency: 'NOK' },
  NZ: { country: 'New Zealand', currency: 'NZD' },
  PL: { country: 'Poland', currency: 'PLN' },
  PT: { country: 'Portugal', currency: 'EUR' },
  RO: { country: 'Romania', currency: 'RON' },
  SE: { country: 'Sweden', currency: 'SEK' },
  SK: { country: 'Slovakia', currency: 'EUR' },
  US: { country: 'United States', currency: 'USD' },
}

const COUNTRY_ALIASES: Record<string, string> = {
  austria: 'AT',
  australia: 'AU',
  belgium: 'BE',
  canada: 'CA',
  switzerland: 'CH',
  czechia: 'CZ',
  'czech republic': 'CZ',
  germany: 'DE',
  denmark: 'DK',
  spain: 'ES',
  finland: 'FI',
  france: 'FR',
  'united kingdom': 'GB',
  uk: 'GB',
  hungary: 'HU',
  ireland: 'IE',
  italy: 'IT',
  japan: 'JP',
  netherlands: 'NL',
  norway: 'NO',
  'new zealand': 'NZ',
  poland: 'PL',
  polska: 'PL',
  portugal: 'PT',
  romania: 'RO',
  sweden: 'SE',
  slovakia: 'SK',
  'united states': 'US',
  usa: 'US',
}

export function resolveCountryMarket(country: string | undefined) {
  if (!country) return undefined
  const normalized = country.trim()
  const code =
    normalized.length === 2
      ? normalized.toUpperCase()
      : COUNTRY_ALIASES[normalized.toLocaleLowerCase('en-US')]
  return code ? COUNTRY_MARKETS[code] : undefined
}

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

const productTools = {
  search_products: tool({
    title: 'Search mock products',
    description:
      'Search 500 synthetic ecommerce offers with structured prices, taxes, checkout totals, shipping, stock, delivery, returns, warranty, specifications, and seller evidence. This is mock data, not a live-web search.',
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

export function searchProducts(input: z.infer<typeof productSearchInputSchema>): Promise<{
  query: string
  searchedAt: string
  catalogSize: number
  products: ProductCardData[]
}> {
  const parsed = productSearchInputSchema.parse(input)
  const countryMarket = resolveCountryMarket(parsed.country)
  const effectiveCurrency = parsed.currency ?? countryMarket?.currency
  const products = searchMockProducts({
    query: parsed.query,
    country: parsed.country,
    currency: effectiveCurrency,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    maxResults: parsed.maxResults ?? 5,
  })

  return Promise.resolve({
    query: parsed.query,
    searchedAt: new Date().toISOString(),
    catalogSize: MOCK_PRODUCT_CATALOG.length,
    budget:
      parsed.minPrice !== undefined || parsed.maxPrice !== undefined
        ? { minPrice: parsed.minPrice, maxPrice: parsed.maxPrice, currency: effectiveCurrency }
        : undefined,
    products,
    ...(products.length === 0
      ? {
          message:
            'No mock product matched the requested query, market, currency, and price constraints.',
        }
      : {}),
  })
}
