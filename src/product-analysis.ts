import { z } from 'zod'

import type { ProductAnalysis, ProductCardData, ProductDecision } from './product-types'

export const ANALYSIS_MODEL = 'gpt-5.6-luna'

export const productValidationInputSchema = z.object({
  productUrls: z
    .array(z.string().url())
    .min(1)
    .max(6)
    .describe('Exact URLs from the latest Exa search to validate with independent subagents'),
  hardCriteria: z
    .array(z.string().trim().min(1).max(160))
    .min(1)
    .max(10)
    .describe('Every non-negotiable product requirement stated by the shopper'),
  hardDeadline: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .optional()
    .describe('Latest acceptable delivery date or delivery window, when explicitly stated'),
  exactMatchRequired: z.boolean().describe('Whether the shopper requires an exact match'),
  userCanWait: z.boolean().describe('Whether the shopper explicitly said they can wait'),
  alternativesAllowed: z
    .boolean()
    .describe('Whether the shopper explicitly allowed alternative products'),
})

export type ValidationContext = z.infer<typeof productValidationInputSchema> & {
  requirements: string
  maxPrice?: number
  currency?: string
}

const ANALYSIS_SYSTEM_PROMPT = `You are the root ecommerce validation orchestrator. You receive current Exa evidence, hard requirements, and decision context for multiple listings.

Spawn exactly one independent subagent per listing and run them concurrently. Give each subagent only its assigned Exa listing evidence and the shared shopper requirements. Every subagent must use built-in web search to independently corroborate the exact product, availability, all-in cost, delivery, and seller. Prefer current retailer pages and authoritative sources. Treat Exa and built-in search as separate evidence channels. Never invent missing facts.

Each subagent returns factual validation fields only. The application—not the model—applies the final decision tree. Therefore:
- hardCriteriaPass is false when any non-negotiable criterion fails.
- allInCost includes product price plus mandatory shipping/delivery charges and must be marked reliable only when calculable in one verified currency.
- sellerSupported requires enough current evidence to support the seller; risky or blocked signals must be explicit.
- deliveryStatus is measured against the supplied hard deadline, or pass when no deadline exists and delivery evidence is adequate.
- exactEligibleProductAvailable requires the exact qualifying product to be currently purchasable.
- alternativeEligible is true only for a qualifying non-exact alternative.
- missingInformation lists information still required from the shopper, not facts that further research should have found.

The root waits for every subagent, reconciles conflicts conservatively, and returns exactly one result for every input URL. Notes are concise and evidence-grounded. Include useful HTTPS source URLs actually consulted.`

const checkResultSchema = z.object({
  verdict: z.enum(['clear', 'caution', 'unverified']),
  note: z.string().trim().min(1).max(220),
})

const sourceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  url: z.string().url(),
})

const listingFactsSchema = z.object({
  url: z.string().url(),
  hardCriteriaPass: z.boolean(),
  allInCostReliable: z.boolean(),
  allInCostValue: z.number().nonnegative().nullable(),
  allInCostCurrency: z.string().trim().min(3).max(3).nullable(),
  sellerSupported: z.boolean(),
  sellerRisk: z.enum(['safe', 'risky', 'blocked', 'unknown']),
  deliveryStatus: z.enum(['pass', 'fail', 'borderline', 'unknown']),
  exactEligibleProductAvailable: z.boolean(),
  alternativeEligible: z.boolean(),
  missingInformation: z.array(z.string().trim().min(1).max(160)).max(6),
  priceIntegrity: checkResultSchema,
  offerTransparency: checkResultSchema,
  sellerTrust: checkResultSchema,
  summary: z.string().trim().min(1).max(280),
  sources: z.array(sourceSchema).max(6),
})

const orchestrationResponseSchema = z.object({
  analyses: z.array(listingFactsSchema).min(1).max(6),
})

const checkJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'note'],
  properties: {
    verdict: { type: 'string', enum: ['clear', 'caution', 'unverified'] },
    note: { type: 'string' },
  },
}

const orchestrationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['analyses'],
  properties: {
    analyses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'url',
          'hardCriteriaPass',
          'allInCostReliable',
          'allInCostValue',
          'allInCostCurrency',
          'sellerSupported',
          'sellerRisk',
          'deliveryStatus',
          'exactEligibleProductAvailable',
          'alternativeEligible',
          'missingInformation',
          'priceIntegrity',
          'offerTransparency',
          'sellerTrust',
          'summary',
          'sources',
        ],
        properties: {
          url: { type: 'string' },
          hardCriteriaPass: { type: 'boolean' },
          allInCostReliable: { type: 'boolean' },
          allInCostValue: { type: ['number', 'null'] },
          allInCostCurrency: { type: ['string', 'null'] },
          sellerSupported: { type: 'boolean' },
          sellerRisk: { type: 'string', enum: ['safe', 'risky', 'blocked', 'unknown'] },
          deliveryStatus: {
            type: 'string',
            enum: ['pass', 'fail', 'borderline', 'unknown'],
          },
          exactEligibleProductAvailable: { type: 'boolean' },
          alternativeEligible: { type: 'boolean' },
          missingInformation: { type: 'array', items: { type: 'string' } },
          priceIntegrity: checkJsonSchema,
          offerTransparency: checkJsonSchema,
          sellerTrust: checkJsonSchema,
          summary: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'url'],
              properties: { title: { type: 'string' }, url: { type: 'string' } },
            },
          },
        },
      },
    },
  },
}

function listingEvidence(product: ProductCardData) {
  return {
    title: product.title,
    source: product.source,
    url: product.url,
    price: product.price ?? null,
    priceCurrency: product.priceCurrency ?? null,
    discountClaim: product.discount ?? null,
    shippingClaim: product.shipping ?? null,
    sellerSignals: product.sellerReliability.basis,
    publishedDate: product.publishedDate ?? null,
    exaHighlights: product.highlights,
  }
}

type ResponsesBody = {
  output?: Array<{
    type?: string
    phase?: string
    agent?: { agent_name?: string }
    content?: Array<{ type?: string; text?: string }>
  }>
}

function rootOutputText(body: ResponsesBody): string | undefined {
  const messages = (body.output ?? []).filter((item) => item.type === 'message')
  const rootFinal = messages.find(
    (item) => item.agent?.agent_name === '/root' && item.phase === 'final_answer',
  )
  const message = rootFinal ?? messages.at(-1)
  return message?.content?.find((part) => part.type === 'output_text')?.text
}

function decide(
  facts: z.infer<typeof listingFactsSchema>,
  context: ValidationContext,
): { decision: ProductDecision; reason: string } {
  if (facts.missingInformation.length) {
    return { decision: 'ask_user', reason: facts.missingInformation.join('; ') }
  }
  if (!facts.hardCriteriaPass) {
    return { decision: 'reject', reason: 'The product fails a hard requirement.' }
  }
  if (
    !facts.allInCostReliable ||
    facts.allInCostValue === null ||
    facts.allInCostCurrency === null
  ) {
    return { decision: 'reject', reason: 'The all-in cost cannot be calculated reliably.' }
  }
  if (context.currency && facts.allInCostCurrency.toUpperCase() !== context.currency) {
    return { decision: 'reject', reason: 'The all-in cost uses the wrong currency.' }
  }
  if (context.maxPrice !== undefined && facts.allInCostValue > context.maxPrice) {
    return { decision: 'reject', reason: 'The all-in cost exceeds the hard cap.' }
  }
  if (!facts.sellerSupported || facts.sellerRisk !== 'safe') {
    return { decision: 'reject', reason: 'Seller evidence is risky or insufficient.' }
  }
  if (facts.deliveryStatus === 'fail') {
    return { decision: 'reject', reason: 'Delivery fails the hard deadline.' }
  }
  if (facts.deliveryStatus === 'borderline' || facts.deliveryStatus === 'unknown') {
    return { decision: 'ask_user', reason: 'Delivery timing needs shopper confirmation.' }
  }
  if (facts.exactEligibleProductAvailable) {
    return { decision: 'present_match', reason: 'An exact eligible product is available.' }
  }
  if (context.exactMatchRequired && context.userCanWait) {
    return { decision: 'wait_and_monitor', reason: 'No exact match is available; monitoring fits.' }
  }
  if (context.alternativesAllowed && facts.alternativeEligible) {
    return { decision: 'propose_alternatives', reason: 'An explicitly allowed alternative exists.' }
  }
  return { decision: 'reject', reason: 'No eligible exact or permitted alternative match exists.' }
}

async function orchestrateAnalyses(
  products: ProductCardData[],
  context: ValidationContext,
  openaiApiKey: string,
): Promise<Map<string, ProductAnalysis>> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'content-type': 'application/json',
      'OpenAI-Beta': 'responses_multi_agent=v1',
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      instructions: ANALYSIS_SYSTEM_PROMPT,
      input: JSON.stringify({ context, listings: products.map(listingEvidence) }),
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      reasoning: { effort: 'none' },
      multi_agent: { enabled: true, max_concurrent_subagents: products.length },
      text: {
        format: {
          type: 'json_schema',
          name: 'product_validation',
          strict: true,
          schema: orchestrationJsonSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`Product validation failed (${response.status})`)

  const body = (await response.json()) as ResponsesBody
  const content = rootOutputText(body)
  if (!content) throw new Error('Product validation returned no root result')
  const parsed = orchestrationResponseSchema.parse(JSON.parse(content))
  const requestedUrls = new Set(products.map((product) => product.url))
  const analyses = new Map<string, ProductAnalysis>()

  for (const facts of parsed.analyses) {
    if (!requestedUrls.has(facts.url) || analyses.has(facts.url)) continue
    const outcome = decide(facts, context)
    const sources = facts.sources.flatMap((source) => {
      try {
        const url = new URL(source.url)
        return url.protocol === 'https:' ? [{ ...source, url: url.toString() }] : []
      } catch {
        return []
      }
    })
    analyses.set(facts.url, {
      status: 'complete',
      model: ANALYSIS_MODEL,
      decision: outcome.decision,
      decisionReason: outcome.reason,
      summary: facts.summary,
      allInCost: {
        value: facts.allInCostValue,
        currency: facts.allInCostCurrency?.toUpperCase() ?? null,
        reliable: facts.allInCostReliable,
      },
      missingInformation: facts.missingInformation,
      sources,
      checks: [
        { id: 'price', label: 'Price', ...facts.priceIntegrity },
        { id: 'offer', label: 'Offer', ...facts.offerTransparency },
        { id: 'seller', label: 'Seller', ...facts.sellerTrust },
      ],
    })
  }
  return analyses
}

export async function analyzeProductListings(
  products: ProductCardData[],
  context: ValidationContext,
  openaiApiKey: string,
  onResult: (url: string, analysis: ProductAnalysis) => void,
): Promise<ProductAnalysis[]> {
  let completed: Map<string, ProductAnalysis>
  try {
    completed = await orchestrateAnalyses(products, context, openaiApiKey)
  } catch {
    completed = new Map()
  }

  return products.map((product) => {
    const analysis =
      completed.get(product.url) ??
      ({ status: 'failed', model: ANALYSIS_MODEL, checks: [] } satisfies ProductAnalysis)
    onResult(product.url, analysis)
    return analysis
  })
}
