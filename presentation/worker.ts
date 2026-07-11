type Env = {
  ASSETS: Fetcher
}

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
} as const

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request)
    const headers = new Headers(response.headers)

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value)

    if (headers.get('content-type')?.includes('text/html')) {
      headers.set('Cache-Control', 'no-cache')
    } else {
      headers.set('Cache-Control', 'public, max-age=3600')
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
} satisfies ExportedHandler<Env>
