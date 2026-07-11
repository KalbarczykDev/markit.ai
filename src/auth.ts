const SESSION_COOKIE = 'markit_session'
const SESSION_SECONDS = 60 * 60 * 24 * 30
const PASSWORD_ITERATIONS = 210_000

export type D1Result = { success: boolean; meta?: { changes?: number } }

export type D1Statement = {
  bind(...values: unknown[]): D1Statement
  first<T>(): Promise<T | null>
  run(): Promise<D1Result>
}

export type D1Database = {
  prepare(query: string): D1Statement
}

export type AuthEnv = {
  DB?: D1Database
}

type UserRow = {
  id: string
  email: string
  name: string
  wallet_cents: number
  theme: string
  offers_enabled: number
  password_hash?: string
  password_salt?: string
}

const encoder = new TextEncoder()

function json(value: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Cache-Control', 'no-store')
  return Response.json(value, { status, headers: responseHeaders })
}

function bytesToBase64(bytes: Uint8Array) {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value)
}

function base64ToBytes(value: string) {
  const decoded = atob(value)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return bytesToBase64(new Uint8Array(hash))
}

async function passwordHash(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

function secureEqual(first: string, second: string) {
  if (first.length !== second.length) return false
  let difference = 0
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index)
  }
  return difference === 0
}

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get('cookie') ?? ''
  for (const cookie of cookies.split(';')) {
    const [key, ...parts] = cookie.trim().split('=')
    if (key === name) return parts.join('=')
  }
  return null
}

function sessionCookie(request: Request, token: string, maxAge = SESSION_SECONDS) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    walletCents: user.wallet_cents,
    theme: user.theme === 'light' || user.theme === 'dark' ? user.theme : 'system',
    offersEnabled: Boolean(user.offers_enabled),
  }
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null
  try {
    const body = (await request.json()) as unknown
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

async function currentUser(request: Request, database: D1Database) {
  const token = cookieValue(request, SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await digest(token)
  return database
    .prepare(
      `SELECT users.id, users.email, users.name, users.wallet_cents, users.theme,
        users.offers_enabled
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .bind(tokenHash, Math.floor(Date.now() / 1000))
    .first<UserRow>()
}

async function createSession(request: Request, database: D1Database, user: UserRow) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await digest(token)
  const now = Math.floor(Date.now() / 1000)
  await database
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    )
    .bind(tokenHash, user.id, now + SESSION_SECONDS, now)
    .run()
  return json({ user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(request, token) })
}

async function signUp(request: Request, database: D1Database) {
  const body = await readBody(request)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (name.length < 2 || name.length > 80) return json({ error: 'Enter your full name.' }, 400)
  if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400)
  if (password.length < 10 || password.length > 128) {
    return json({ error: 'Password must be between 10 and 128 characters.' }, 400)
  }

  const existing = await database
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>()
  if (existing) return json({ error: 'An account with this email already exists.' }, 409)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const user: UserRow = {
    id: crypto.randomUUID(),
    email,
    name,
    wallet_cents: 0,
    theme: 'system',
    offers_enabled: 1,
  }

  try {
    await database
      .prepare(
        `INSERT INTO users
          (id, email, name, password_hash, password_salt, wallet_cents, theme,
           offers_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 'system', 1, ?, ?)`,
      )
      .bind(
        user.id,
        user.email,
        user.name,
        await passwordHash(password, salt),
        bytesToBase64(salt),
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000),
      )
      .run()
  } catch {
    return json({ error: 'An account with this email already exists.' }, 409)
  }

  return createSession(request, database, user)
}

async function logIn(request: Request, database: D1Database) {
  const body = await readBody(request)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!validEmail(email) || !password)
    return json({ error: 'Email or password is incorrect.' }, 401)

  const user = await database
    .prepare(
      `SELECT id, email, name, wallet_cents, theme, offers_enabled, password_hash,
        password_salt FROM users WHERE email = ?`,
    )
    .bind(email)
    .first<UserRow>()
  if (!user?.password_hash || !user.password_salt) {
    return json({ error: 'Email or password is incorrect.' }, 401)
  }

  const candidate = await passwordHash(password, base64ToBytes(user.password_salt))
  if (!secureEqual(candidate, user.password_hash)) {
    return json({ error: 'Email or password is incorrect.' }, 401)
  }
  return createSession(request, database, user)
}

async function logOut(request: Request, database: D1Database) {
  const token = cookieValue(request, SESSION_COOKIE)
  if (token) {
    await database
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await digest(token))
      .run()
  }
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '', 0) })
}

async function updateUser(request: Request, database: D1Database) {
  const user = await currentUser(request, database)
  if (!user) return json({ error: 'Sign in to update your profile.' }, 401)
  const body = await readBody(request)
  if (!body) return json({ error: 'Invalid request.' }, 400)

  const name = typeof body.name === 'string' ? body.name.trim() : user.name
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : user.email
  const theme =
    body.theme === 'light' || body.theme === 'dark' || body.theme === 'system'
      ? body.theme
      : user.theme
  const offersEnabled =
    typeof body.offersEnabled === 'boolean' ? Number(body.offersEnabled) : user.offers_enabled

  if (name.length < 2 || name.length > 80) return json({ error: 'Enter your full name.' }, 400)
  if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400)

  try {
    await database
      .prepare(
        `UPDATE users SET name = ?, email = ?, theme = ?, offers_enabled = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(name, email, theme, offersEnabled, Math.floor(Date.now() / 1000), user.id)
      .run()
  } catch {
    return json({ error: 'That email address is already in use.' }, 409)
  }

  return json({
    user: publicUser({ ...user, name, email, theme, offers_enabled: offersEnabled }),
  })
}

export async function handleAuthRequest(request: Request, env: AuthEnv): Promise<Response> {
  const database = env.DB
  if (!database) return json({ error: 'Accounts are not configured.' }, 503)
  const url = new URL(request.url)
  const { pathname } = url

  if (request.method !== 'GET') {
    const origin = request.headers.get('origin')
    if (!origin || new URL(origin).origin !== url.origin) {
      return json({ error: 'Origin not allowed.' }, 403)
    }
  }

  if (request.method === 'POST' && pathname === '/api/auth/signup') {
    return signUp(request, database)
  }
  if (request.method === 'POST' && pathname === '/api/auth/login') {
    return logIn(request, database)
  }
  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    return logOut(request, database)
  }
  if (request.method === 'GET' && pathname === '/api/auth/session') {
    const user = await currentUser(request, database)
    return json({ user: user ? publicUser(user) : null })
  }
  if (request.method === 'PATCH' && pathname === '/api/auth/profile') {
    return updateUser(request, database)
  }
  return json({ error: 'Not found.' }, 404)
}
