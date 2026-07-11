import { z } from 'zod'

import type { ProductAnalysis, ProductCardData } from './product-types'

export const ANALYSIS_MODEL = 'gpt-5.6-luna'

const ANALYSIS_SYSTEM_PROMPT = `You are an independent ecommerce listing auditor. You receive evidence for exactly one synthetic product listing from a mock catalog. Audit only that evidence. Never describe it as live or real, never invent facts, never assume data that is not present, and never browse.

Return three checks:
- priceIntegrity: whether the stated price and any discount claim are consistent and supported by the evidence.
- offerTransparency: whether delivery, returns, or warranty terms are clearly evidenced.
- sellerTrust: whether the seller reputation signals in the evidence support trusting this listing.

Verdicts: "clear" when the evidence directly supports the check, "caution" when the evidence contains conflicting or suspicious signals, "unverified" when the evidence is missing or too thin to judge. Each note must ground its verdict in the evidence in at most 140 characters. The summary is one plain sentence for a shopper.`

const checkResultSchema = z.object({
  verdict: z.enum(['clear', 'caution', 'unverified']),
  note: z.string().trim().min(1).max(200),
})

const analysisResponseSchema = z.object({
  priceIntegrity: checkResultSchema,
  offerTransparency: checkResultSchema,
  sellerTrust: checkResultSchema,
  summary: z.string().trim().min(1).max(240),
})

const checkJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'note'],
  properties: {
    verdict: { type: 'string', enum: ['clear', 'caution', 'unverified'] },
    note: {
      type: 'string',
      description: 'Evidence-grounded justification of at most 140 characters',
    },
  },
}

const analysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['priceIntegrity', 'offerTransparency', 'sellerTrust', 'summary'],
  properties: {
    priceIntegrity: checkJsonSchema,
    offerTransparency: checkJsonSchema,
    sellerTrust: checkJsonSchema,
    summary: { type: 'string', description: 'One shopper-facing sentence' },
  },
}

function listingEvidence(product: ProductCardData) {
  return {
    title: product.title,
    source: product.source,
    url: product.url,
    price: product.price ?? null,
    discountClaim: product.discount ?? null,
    shippingClaim: product.shipping ?? null,
    sellerSignals: product.sellerReliability.basis,
    publishedDate: product.publishedDate ?? null,
    highlights: product.highlights,
    mock: product.mock ?? false,
    market: product.market ?? null,
    pricing: product.pricing ?? null,
    fulfillment: product.fulfillment ?? null,
    returns: product.returns ?? null,
    warranty: product.warranty ?? null,
    seller: product.seller ?? null,
    specifications: product.specifications ?? null,
  }
}

async function analyzeListing(
  product: ProductCardData,
  openaiApiKey: string,
): Promise<ProductAnalysis> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(listingEvidence(product)) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'listing_analysis', strict: true, schema: analysisJsonSchema },
      },
    }),
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) throw new Error(`Listing analysis failed (${response.status})`)

  const body = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[]
  }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error('Listing analysis returned no content')

  const parsed = analysisResponseSchema.parse(JSON.parse(content))
  return {
    status: 'complete',
    model: ANALYSIS_MODEL,
    summary: parsed.summary,
    checks: [
      { id: 'price', label: 'Price', ...parsed.priceIntegrity },
      { id: 'offer', label: 'Offer', ...parsed.offerTransparency },
      { id: 'seller', label: 'Seller', ...parsed.sellerTrust },
    ],
  }
}

export function analyzeProductListings(
  products: ProductCardData[],
  openaiApiKey: string,
  onResult: (url: string, analysis: ProductAnalysis) => void,
): Promise<void> {
  return Promise.all(
    products.map(async (product) => {
      const analysis = await analyzeListing(product, openaiApiKey).catch(
        (): ProductAnalysis => ({ status: 'failed', model: ANALYSIS_MODEL, checks: [] }),
      )
      onResult(product.url, analysis)
    }),
  ).then(() => undefined)
}
