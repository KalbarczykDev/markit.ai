import handler from '@tanstack/react-start/server-entry'

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

function realtimeSocket(request: Request, env: Env): Response {
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

  const Pair = globalThis.WebSocketPair as unknown as WebSocketPairConstructor
  const pair = new Pair()
  const client = pair[0]
  const server = pair[1]
  server.accept()

  const upstream = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-realtime', [
    'realtime',
    `openai-insecure-api-key.${env.OPENAI_API_KEY}`,
    'openai-beta.realtime-v1',
  ])
  const pending: string[] = []

  server.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return
    if (upstream.readyState === WebSocket.OPEN) upstream.send(event.data)
    else if (upstream.readyState === WebSocket.CONNECTING && pending.length < 100) {
      pending.push(event.data)
    }
  })

  upstream.addEventListener('open', () => {
    for (const message of pending.splice(0)) upstream.send(message)
  })
  upstream.addEventListener('message', (event) => {
    if (server.readyState === WebSocket.OPEN) server.send(event.data)
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
    if (url.pathname === '/api/realtime') return realtimeSocket(request, env)
    return startFetch(request, env, context)
  },
}
