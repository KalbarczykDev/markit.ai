import handler from '@tanstack/react-start/server-entry'

import {
  getProductToolDefinitions,
  productSystemPromptForCountry,
  productDisplayInputSchema,
  productSearchInputSchema,
  searchProducts,
} from './product-agent'
import { analyzeProductListings } from './product-analysis'
import type { ProductCardData } from './product-types'

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

type Env = {
  OPENAI_API_KEY?: string
}

type WorkerWebSocket = WebSocket & { accept(): void }
type WebSocketPairConstructor = new () => { 0: WorkerWebSocket; 1: WorkerWebSocket }

const startFetch = handler.fetch as unknown as (
  request: Request,
  env: Env,
  context: ExecutionContext,
) => Promise<Response>

type RealtimeToolCall = {
  type: 'response.function_call_arguments.done'
  name?: string
  call_id?: string
  arguments?: string
}

type ProductSessionState = {
  latestProducts: ProductCardData[]
  analysisGeneration: number
}

function sendJson(socket: WorkerWebSocket, value: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
}

async function executeAgentTool(
  call: RealtimeToolCall,
  env: Env,
  upstream: WorkerWebSocket,
  client: WorkerWebSocket,
  state: ProductSessionState,
  context: ExecutionContext,
): Promise<void> {
  if (!call.call_id) return
  let output: unknown
  try {
    if (call.name === 'search_products') {
      const input = productSearchInputSchema.parse(JSON.parse(call.arguments || '{}'))
      sendJson(client, { type: 'markit.status', status: 'searching', query: input.query })
      const result = await searchProducts(input)
      state.latestProducts = result.products
      state.analysisGeneration += 1
      const generation = state.analysisGeneration
      if (env.OPENAI_API_KEY && result.products.length) {
        // Independent per-listing audits run in parallel and must never delay
        // the voice reply; stale generations are dropped instead of cancelled.
        context.waitUntil(
          analyzeProductListings(result.products, env.OPENAI_API_KEY, (url, analysis) => {
            if (state.analysisGeneration !== generation) return
            sendJson(client, { type: 'markit.analysis', url, analysis })
          }),
        )
      }
      output = result
      sendJson(client, {
        type: 'markit.status',
        status: 'thinking',
        resultCount: result.products.length,
      })
    } else if (call.name === 'control_product_display') {
      const input = productDisplayInputSchema.parse(JSON.parse(call.arguments || '{}'))
      if (input.action === 'close') {
        sendJson(client, { type: 'markit.products', action: 'close' })
        output = { displayed: false, productCount: 0 }
      } else {
        const requested = new Set(input.productUrls ?? [])
        const products = (
          requested.size
            ? state.latestProducts.filter((product) => requested.has(product.url))
            : state.latestProducts
        ).slice(0, 6)
        if (!products.length) throw new Error('No researched products are available to display')
        sendJson(client, {
          type: 'markit.products',
          action: 'show',
          heading: input.heading || 'Current picks',
          products,
        })
        output = { displayed: true, productCount: products.length }
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
      state.analysisGeneration += 1
      sendJson(client, { type: 'markit.status', status: 'search-error' })
    }
  }

  sendJson(upstream, {
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: call.call_id,
      output: JSON.stringify(output),
    },
  })
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

  const toolDefinitions = await getProductToolDefinitions()
  const productSystemPrompt = productSystemPromptForCountry(request.headers.get('cf-ipcountry'))

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
  const productState: ProductSessionState = { latestProducts: [], analysisGeneration: 0 }

  server.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return
    if (upstream.readyState !== WebSocket.OPEN) return
    try {
      const message = JSON.parse(event.data) as { type?: string; session?: Record<string, unknown> }
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
      if (
        message.type === 'response.function_call_arguments.done' &&
        (message.name === 'search_products' || message.name === 'control_product_display') &&
        message.call_id &&
        !handledToolCalls.has(message.call_id)
      ) {
        handledToolCalls.add(message.call_id)
        context.waitUntil(executeAgentTool(message, env, upstream, server, productState, context))
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
    if (upstream.readyState < WebSocket.CLOSING) upstream.close(1000, 'Client disconnected')
  })

  return new Response(null, { status: 101, webSocket: client } as ResponseInit)
}

export default {
  fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> | Response {
    const url = new URL(request.url)
    if (url.pathname === '/api/realtime') return realtimeSocket(request, env, context)
    return startFetch(request, env, context)
  },
}
