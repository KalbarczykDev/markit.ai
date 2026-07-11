import type { D1Database } from '@cloudflare/workers-types'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth/minimal'
import { drizzle } from 'drizzle-orm/d1'
import { z } from 'zod'

import * as schema from './db/schema'

export type AuthEnv = {
  BETTER_AUTH_SECRET?: string
  DB?: D1Database
}

const themeSchema = z.enum(['system', 'light', 'dark'])

export function createAuth(request: Request, env: AuthEnv) {
  if (!env.DB || !env.BETTER_AUTH_SECRET) return null
  const origin = new URL(request.url).origin

  return betterAuth({
    appName: 'Markit',
    baseURL: origin,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    user: {
      changeEmail: { enabled: true },
      additionalFields: {
        walletCents: {
          type: 'number',
          defaultValue: 0,
          input: false,
        },
        theme: {
          type: 'string',
          defaultValue: 'system',
          validator: { input: themeSchema },
        },
        offersEnabled: {
          type: 'boolean',
          defaultValue: true,
        },
        billingStatus: {
          type: 'string',
          defaultValue: 'inactive',
          input: false,
        },
        stripeProductId: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },
    advanced: {
      cookiePrefix: 'markit',
      useSecureCookies: new URL(request.url).protocol === 'https:',
    },
  })
}

export async function handleAuthRequest(request: Request, env: AuthEnv) {
  const auth = createAuth(request, env)
  if (!auth) {
    return Response.json({ message: 'Accounts are not configured.' }, { status: 503 })
  }
  return auth.handler(request)
}
