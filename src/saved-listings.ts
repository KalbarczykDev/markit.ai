import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'

import { createAuth, type AuthEnv } from './auth'
import type { SavableListing, SavedListing } from './saved-listing-types'

export type SavedListingsEnv = AuthEnv

type ListingRow = {
  id: string
  title: string
  url: string
  source: string
  price: string | null
  image: string | null
  created_at: number
}

const listingSchema = z.object({
  title: z.string().trim().min(1).max(240),
  url: z.string().url().max(2_000),
  source: z.string().trim().min(1).max(200),
  price: z.string().trim().max(100).optional(),
  image: z.string().url().max(2_000).optional(),
})

const saveListingsSchema = z.object({ products: z.array(listingSchema).min(1).max(6) })

export async function saveListings(
  database: D1Database,
  userId: string,
  products: SavableListing[],
): Promise<SavedListing[]> {
  const now = Date.now()
  await Promise.all(
    products.map((product) =>
      database
        .prepare(
          `INSERT INTO favorite_listing
            (id, user_id, url, title, source, price, image, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, url) DO UPDATE SET
             title = excluded.title,
             source = excluded.source,
             price = excluded.price,
             image = excluded.image,
             updated_at = excluded.updated_at`,
        )
        .bind(
          crypto.randomUUID(),
          userId,
          product.url,
          product.title,
          product.source,
          product.price ?? null,
          product.image ?? null,
          now,
          now,
        )
        .run(),
    ),
  )

  const urls = new Set(products.map((product) => product.url))
  const saved = await listSavedListings(database, userId)
  return saved.filter((listing) => urls.has(listing.url))
}

async function listSavedListings(database: D1Database, userId: string): Promise<SavedListing[]> {
  const result = await database
    .prepare(
      `SELECT id, title, url, source, price, image, created_at
       FROM favorite_listing WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<ListingRow>()

  return result.results.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    ...(row.price ? { price: row.price } : {}),
    ...(row.image ? { image: row.image } : {}),
    savedAt: new Date(row.created_at).toISOString(),
  }))
}

export async function handleSavedListingsRequest(request: Request, env: SavedListingsEnv) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return Response.json({ message: 'Method not allowed.' }, { status: 405 })
  }
  if (!env.DB)
    return Response.json({ message: 'Saved listings are not configured.' }, { status: 503 })

  const auth = createAuth(request, env)
  const session = auth ? await auth.api.getSession({ headers: request.headers }) : null
  if (!session?.user) {
    return Response.json({ message: 'Log in to access saved listings.' }, { status: 401 })
  }

  if (request.method === 'POST') {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return Response.json({ message: 'Origin not allowed.' }, { status: 403 })
    }
    const input = saveListingsSchema.parse(await request.json())
    return Response.json({ listings: await saveListings(env.DB, session.user.id, input.products) })
  }

  return Response.json({ listings: await listSavedListings(env.DB, session.user.id) })
}
