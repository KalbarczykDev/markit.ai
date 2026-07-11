import type { DurableObjectNamespace } from '@cloudflare/workers-types'
import handler from '@tanstack/react-start/server-entry'

import { createAuth, handleAuthRequest, type AuthEnv } from './auth'
import type { PersistedProductState } from './conversation-types'
import {
  conversationHistoryPrompt,
  ensureConversationSchema,
  handleConversationsRequest,
  loadConversation,
  recordConversationMessage,
  saveConversationProductState,
} from './conversations'
import { PriceAlertScheduler } from './price-alert-scheduler'
import { handlePriceAlertsRequest } from './price-alerts'
import {
  getProductToolDefinitions,
  productSystemPromptForCountry,
  productDisplayInputSchema,
  productSearchInputSchema,
  saveListingsInputSchema,
  searchProducts,
} from './product-agent'
import { analyzeProductListings, productValidationInputSchema } from './product-analysis'
import type { ProductCardData, ProductSortMode } from './product-types'
import { handleSavedListingsRequest, saveListings } from './saved-listings'

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

type Env = AuthEnv & {
  OPENAI_API_KEY?: string
  EXA_API_KEY?: string
  TELEGRAM_BOT_TOKEN?: string
  ALERT_SCHEDULER?: DurableObjectNamespace
}

export { PriceAlertScheduler }

type WorkerWebSocket = WebSocket & { accept(): void }
type WebSocketPairConstructor = new () => { 0: WorkerWebSocket; 1: WorkerWebSocket }

const startFetch = handler.fetch as unknown as (
  request: Request,
  env: Env,
  context: ExecutionContext,
) => Promise<Response>

type RealtimeToolCall = {
  type: string
  name?: string
  call_id?: string
  arguments?: string
  item_id?: string
  transcript?: string
}

type ProductSessionState = PersistedProductState & {
  validationGeneration: number
}

type ShopperContext = { userId: string | null }
type ConversationPersistence = { database: NonNullable<Env['DB']>; conversationId: string }

const EXA_SEARCH_ENABLED = false

function sendJson(socket: WorkerWebSocket, value: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
}

function sortProducts(products: ProductCardData[], sort: ProductSortMode): ProductCardData[] {
  if (sort === 'relevance') return products
  return [...products].sort((left, right) => {
    if (sort === 'reliability_desc') {
      return right.sellerReliability.score - left.sellerReliability.score
    }
    if (left.priceValue === undefined) return 1
    if (right.priceValue === undefined) return -1
    return sort === 'price_asc'
      ? left.priceValue - right.priceValue
      : right.priceValue - left.priceValue
  })
}

async function executeAgentTool(
  call: RealtimeToolCall,
  env: Env,
  upstream: WorkerWebSocket,
  client: WorkerWebSocket,
  state: ProductSessionState,
  shopper: ShopperContext,
  context: ExecutionContext,
  persistence: ConversationPersistence | null,
): Promise<void> {
  if (!call.call_id) return
  sendJson(client, { type: 'markit.tool', phase: 'started', tool: call.name })
  let output: unknown
  try {
    if (call.name === 'search_products') {
      if (!EXA_SEARCH_ENABLED) throw new Error('Product search is temporarily disabled')
      if (!env.EXA_API_KEY) throw new Error('Product search is not configured')
      const input = productSearchInputSchema.parse(JSON.parse(call.arguments || '{}'))
      sendJson(client, { type: 'markit.status', status: 'searching', query: input.query })
      const result = await searchProducts(input, env.EXA_API_KEY)
      state.latestProducts = result.products
      state.visibleProductUrls = []
      state.validatedProductUrls = []
      state.analyses = {}
      state.validationGeneration += 1
      state.latestValidationContext = {
        requirements: input.query,
        maxPrice: input.maxPrice,
        currency: input.currency,
      }
      output = result
      sendJson(client, {
        type: 'markit.status',
        status: 'thinking',
        resultCount: result.products.length,
      })
    } else if (call.name === 'validate_product_results') {
      if (!env.OPENAI_API_KEY) throw new Error('Product validation is not configured')
      if (!state.latestValidationContext) throw new Error('Product research is required first')
      const input = productValidationInputSchema.parse(JSON.parse(call.arguments || '{}'))
      const requested = new Set(input.productUrls)
      const products = state.latestProducts.filter((product) => requested.has(product.url))
      if (products.length !== requested.size) {
        throw new Error('Only listings from the latest search can be validated')
      }
      const generation = state.validationGeneration
      state.validatedProductUrls = []
      sendJson(client, {
        type: 'markit.status',
        status: 'validating',
        resultCount: products.length,
      })
      const analyses = await analyzeProductListings(
        products,
        { ...input, ...state.latestValidationContext },
        env.OPENAI_API_KEY,
        (url, analysis) => {
          if (state.validationGeneration !== generation) return
          state.analyses[url] = analysis
          sendJson(client, { type: 'markit.analysis', url, analysis })
        },
      )
      const findings = products.map((product, index) => ({
        url: product.url,
        status: analyses[index]?.status ?? 'failed',
        summary: analyses[index]?.summary,
        decision: analyses[index]?.decision,
        decisionReason: analyses[index]?.decisionReason,
        missingInformation: analyses[index]?.missingInformation,
        allInCost: analyses[index]?.allInCost,
        checks: analyses[index]?.checks ?? [],
      }))
      state.validatedProductUrls = products.flatMap((product, index) =>
        analyses[index]?.decision === 'present_match' ||
        analyses[index]?.decision === 'propose_alternatives'
          ? [product.url]
          : [],
      )
      output = {
        validationCompleted: true,
        validatedCount: analyses.filter((analysis) => analysis.status === 'complete').length,
        failedCount: analyses.filter((analysis) => analysis.status === 'failed').length,
        findings,
      }
      sendJson(client, { type: 'markit.status', status: 'thinking' })
    } else if (call.name === 'control_product_display') {
      const input = productDisplayInputSchema.parse(JSON.parse(call.arguments || '{}'))
      if (input.action === 'close') {
        state.visibleProductUrls = []
        state.display = null
        sendJson(client, { type: 'markit.products', action: 'close' })
        output = { displayed: false, productCount: 0 }
      } else {
        const view = input.view
        const sort = input.sort
        if (!state.validatedProductUrls.length) {
          throw new Error('Product validation is required before display')
        }
        const validated = new Set(state.validatedProductUrls)
        if (input.productUrls?.some((url) => !validated.has(url))) {
          throw new Error('Only independently validated products can be displayed')
        }
        const requested = new Set(input.productUrls ?? state.validatedProductUrls)
        const explicitlyOrdered = input.productUrls?.flatMap((url) => {
          const product = state.latestProducts.find((candidate) => candidate.url === url)
          return product ? [product] : []
        })
        const products = sortProducts(
          explicitlyOrdered ??
            (requested.size
              ? state.latestProducts.filter((product) => requested.has(product.url))
              : state.latestProducts),
          sort,
        ).slice(0, 6)
        if (!products.length) throw new Error('No researched products are available to display')
        state.visibleProductUrls = products.map((product) => product.url)
        state.display = { heading: input.heading || 'Current picks', view, sort }
        sendJson(client, {
          type: 'markit.products',
          action: 'show',
          heading: input.heading || 'Current picks',
          products,
          view,
          sort,
        })
        output = { displayed: true, productCount: products.length, view, sort }
      }
    } else if (call.name === 'save_product_listings') {
      const input = saveListingsInputSchema.parse(JSON.parse(call.arguments || '{}'))
      if (!shopper.userId || !env.DB) {
        output = { saved: false, error: 'Login is required to save product listings.' }
      } else {
        const requested = new Set(input.productUrls)
        const products = state.latestProducts.filter((product) => requested.has(product.url))
        if (products.length !== requested.size) {
          output = {
            saved: false,
            error: 'Only products from the latest researched listings can be saved.',
          }
        } else {
          const listings = await saveListings(env.DB, shopper.userId, products)
          sendJson(client, { type: 'markit.listings', listings })
          output = {
            saved: true,
            savedCount: listings.length,
            location: 'Account → Saved listings',
          }
        }
      }
    } else {
      return
    }
  } catch {
    output = {
      error: 'The requested ecommerce action could not be completed. Do not claim it succeeded.',
    }
    if (call.name === 'search_products') {
      state.latestProducts = []
      state.validatedProductUrls = []
      state.latestValidationContext = null
      state.validationGeneration += 1
      sendJson(client, { type: 'markit.status', status: 'search-error' })
    } else if (call.name === 'validate_product_results') {
      sendJson(client, { type: 'markit.status', status: 'validation-error' })
    }
  }

  if (persistence) {
    context.waitUntil(
      saveConversationProductState(persistence.database, persistence.conversationId, state),
    )
  }

  sendJson(upstream, {
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: call.call_id,
      output: JSON.stringify(output),
    },
  })
  sendJson(client, { type: 'markit.tool', phase: 'completed', tool: call.name })
  sendJson(upstream, { type: 'response.create' })
}

async function realtimeSocket(
  request: Request,
  env: Env,
  context: ExecutionContext,
): Promise<Response> {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('WebSocket upgrade required', { status: 426 })
  }

  const origin = request.headers.get('origin')
  if (!origin || new URL(origin).host !== new URL(request.url).host) {
    return new Response('Origin not allowed', { status: 403 })
  }

  if (!env.OPENAI_API_KEY) {
    return new Response('Voice service is not configured', { status: 503 })
  }

  const toolDefinitions = (await getProductToolDefinitions()).filter(
    (definition) => EXA_SEARCH_ENABLED || definition.name !== 'search_products',
  )
  const auth = createAuth(request, env)
  const authSession = auth ? await auth.api.getSession({ headers: request.headers }) : null
  const requestedConversationId = new URL(request.url).searchParams.get('conversationId')
  if (requestedConversationId && env.DB) await ensureConversationSchema(env.DB)
  const loadedConversation =
    requestedConversationId && env.DB && authSession?.user
      ? await loadConversation(env.DB, authSession.user.id, requestedConversationId)
      : null
  if (requestedConversationId && !loadedConversation) {
    return new Response('Conversation not found', { status: 404 })
  }
  const productSystemPrompt =
    productSystemPromptForCountry(request.headers.get('cf-ipcountry')) +
    (EXA_SEARCH_ENABLED
      ? ''
      : '\n\n# Temporarily unavailable capabilities\n- Product search is disabled. Do not claim to search for, find, or verify new products. Tell the shopper that live product search is temporarily unavailable when requested.') +
    conversationHistoryPrompt(loadedConversation?.messages ?? [])
  const persistence: ConversationPersistence | null =
    loadedConversation && env.DB
      ? { database: env.DB, conversationId: loadedConversation.conversation.id }
      : null

  const openAIResponse = (await fetch('https://api.openai.com/v1/realtime?model=gpt-realtime-2.1', {
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      Upgrade: 'websocket',
      'OpenAI-Safety-Identifier': 'markit-voice-web',
    },
  })) as Response & { webSocket?: WorkerWebSocket | null }
  const upstream = openAIResponse.webSocket
  if (openAIResponse.status !== 101 || !upstream) {
    return new Response('Realtime upstream unavailable', { status: 502 })
  }
  upstream.accept()

  const Pair = globalThis.WebSocketPair as unknown as WebSocketPairConstructor
  const pair = new Pair()
  const client = pair[0]
  const server = pair[1]
  server.accept()
  const handledToolCalls = new Set<string>()
  const productState: ProductSessionState = {
    latestProducts: loadedConversation?.productState?.latestProducts ?? [],
    visibleProductUrls: loadedConversation?.productState?.visibleProductUrls ?? [],
    validationGeneration: 0,
    validatedProductUrls: loadedConversation?.productState?.validatedProductUrls ?? [],
    latestValidationContext: loadedConversation?.productState?.latestValidationContext ?? null,
    display: loadedConversation?.productState?.display ?? null,
    analyses: loadedConversation?.productState?.analyses ?? {},
  }
  let restoredClientState = false
  const toolReadyResolvers = new Map<string, () => void>()
  const waitForToolReady = (callId: string) =>
    new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timeout)
        toolReadyResolvers.delete(callId)
        resolve()
      }
      const timeout = setTimeout(finish, 10_000)
      toolReadyResolvers.set(callId, finish)
    })

  server.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return
    if (upstream.readyState !== WebSocket.OPEN) return
    try {
      const message = JSON.parse(event.data) as {
        type?: string
        session?: Record<string, unknown>
        call_id?: string
      }
      if (message.type === 'markit.tool.ready' && message.call_id) {
        toolReadyResolvers.get(message.call_id)?.()
        return
      }
      if (message.type === 'session.update') {
        upstream.send(
          JSON.stringify({
            ...message,
            session: {
              ...message.session,
              instructions: productSystemPrompt,
              tools: toolDefinitions,
              tool_choice: 'auto',
              parallel_tool_calls: false,
            },
          }),
        )
        return
      }
    } catch {}
    upstream.send(event.data)
  })
  upstream.addEventListener('message', (event) => {
    if (server.readyState !== WebSocket.OPEN) return
    server.send(event.data)
    if (typeof event.data !== 'string') return
    try {
      const message = JSON.parse(event.data) as RealtimeToolCall
      if (message.type === 'session.updated' && !restoredClientState) {
        restoredClientState = true
        if (productState.display && productState.visibleProductUrls.length) {
          const visible = new Set(productState.visibleProductUrls)
          sendJson(server, {
            type: 'markit.products',
            action: 'show',
            ...productState.display,
            products: productState.latestProducts.filter((product) => visible.has(product.url)),
          })
          for (const [url, analysis] of Object.entries(productState.analyses)) {
            sendJson(server, { type: 'markit.analysis', url, analysis })
          }
        }
      }
      const transcriptRole =
        message.type === 'conversation.item.input_audio_transcription.completed'
          ? 'user'
          : message.type === 'response.output_audio_transcript.done'
            ? 'assistant'
            : null
      if (persistence && transcriptRole && message.item_id && message.transcript) {
        context.waitUntil(
          recordConversationMessage(
            persistence.database,
            persistence.conversationId,
            message.item_id,
            transcriptRole,
            message.transcript,
          ).then(() => sendJson(server, { type: 'markit.conversation.updated' })),
        )
      }
      if (
        message.type === 'response.function_call_arguments.done' &&
        (message.name === 'search_products' ||
          message.name === 'validate_product_results' ||
          message.name === 'control_product_display' ||
          message.name === 'save_product_listings') &&
        message.call_id &&
        !handledToolCalls.has(message.call_id)
      ) {
        handledToolCalls.add(message.call_id)
        const ready = waitForToolReady(message.call_id)
        sendJson(server, {
          type: 'markit.tool',
          phase: 'waiting',
          tool: message.name,
          call_id: message.call_id,
        })
        context.waitUntil(
          ready.then(() =>
            executeAgentTool(
              message,
              env,
              upstream,
              server,
              productState,
              { userId: authSession?.user.id ?? null },
              context,
              persistence,
            ),
          ),
        )
      }
    } catch {}
  })
  upstream.addEventListener('error', () => {
    if (server.readyState === WebSocket.OPEN) {
      server.send(
        JSON.stringify({ type: 'error', error: { message: 'Realtime connection failed' } }),
      )
    }
  })
  upstream.addEventListener('close', (event) => {
    if (server.readyState === WebSocket.OPEN) server.close(event.code, event.reason)
  })
  server.addEventListener('close', () => {
    for (const resolve of toolReadyResolvers.values()) resolve()
    toolReadyResolvers.clear()
    if (upstream.readyState < WebSocket.CLOSING) upstream.close(1000, 'Client disconnected')
  })

  return new Response(null, { status: 101, webSocket: client } as ResponseInit)
}

export default {
  fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> | Response {
    const url = new URL(request.url)
    if (url.pathname === '/api/realtime') return realtimeSocket(request, env, context)
    if (url.pathname.startsWith('/api/auth/')) return handleAuthRequest(request, env)
    if (url.pathname === '/api/listings') return handleSavedListingsRequest(request, env)
    if (url.pathname.startsWith('/api/conversations')) {
      return handleConversationsRequest(request, env)
    }
    if (url.pathname === '/api/price-alerts') return handlePriceAlertsRequest(request, env)
    return startFetch(request, env, context)
  },
}
