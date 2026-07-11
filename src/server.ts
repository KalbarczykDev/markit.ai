import handler from '@tanstack/react-start/server-entry'

import {
  PRODUCT_SYSTEM_PROMPT,
  getProductToolDefinitions,
  productSearchInputSchema,
  searchProducts,
} from './product-agent'

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

type Env = {
  OPENAI_API_KEY?: string
  EXA_API_KEY?: string
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

function sendJson(socket: WorkerWebSocket, value: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
}

async function executeProductSearch(
  call: RealtimeToolCall,
  env: Env,
  upstream: WorkerWebSocket,
  client: WorkerWebSocket,
): Promise<void> {
  if (!call.call_id) return
  let output: unknown
  try {
    if (!env.EXA_API_KEY) throw new Error('Product search is not configured')
    const input = productSearchInputSchema.parse(JSON.parse(call.arguments || '{}'))
    sendJson(client, { type: 'markit.status', status: 'searching', query: input.query })
    const result = await searchProducts(input, env.EXA_API_KEY)
    output = result
    sendJson(client, {
      type: 'markit.status',
      status: 'thinking',
      resultCount: result.products.length,
    })
  } catch {
    output = {
      error:
        'Current product data could not be retrieved. Do not make an unverified product claim.',
      products: [],
    }
    sendJson(client, { type: 'markit.status', status: 'search-error' })
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
              instructions: PRODUCT_SYSTEM_PROMPT,
              tools: toolDefinitions,
              tool_choice: 'auto',
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
        message.name === 'search_products' &&
        message.call_id &&
        !handledToolCalls.has(message.call_id)
      ) {
        handledToolCalls.add(message.call_id)
        context.waitUntil(executeProductSearch(message, env, upstream, server))
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
