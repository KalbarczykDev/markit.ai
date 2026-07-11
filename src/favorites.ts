import type { D1Database } from '@cloudflare/workers-types'

import { createAuth, type AuthEnv } from './auth'
import type { FavoriteListing } from './favorite-types'
import type { ProductCardData } from './product-types'

export type FavoritesEnv = AuthEnv

type FavoriteRow = {
  id: string
  title: string
  url: string
  source: string
  price: string | null
  image: string | null
  created_at: number
}

export async function saveFavoriteListings(
  database: D1Database,
  userId: string,
  products: ProductCardData[],
): Promise<FavoriteListing[]> {
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
  const saved = await listFavorites(database, userId)
  return saved.filter((favorite) => urls.has(favorite.url))
}

async function listFavorites(database: D1Database, userId: string): Promise<FavoriteListing[]> {
  const result = await database
    .prepare(
      `SELECT id, title, url, source, price, image, created_at
       FROM favorite_listing WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<FavoriteRow>()

  return result.results.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    ...(row.price ? { price: row.price } : {}),
    ...(row.image ? { image: row.image } : {}),
    favoritedAt: new Date(row.created_at).toISOString(),
  }))
}

export async function handleFavoritesRequest(request: Request, env: FavoritesEnv) {
  if (request.method !== 'GET') {
    return Response.json({ message: 'Method not allowed.' }, { status: 405 })
  }
  if (!env.DB) return Response.json({ message: 'Favorites are not configured.' }, { status: 503 })

  const auth = createAuth(request, env)
  const session = auth ? await auth.api.getSession({ headers: request.headers }) : null
  if (!session?.user) {
    return Response.json({ message: 'Log in to view favorites.' }, { status: 401 })
  }

  return Response.json({ favorites: await listFavorites(env.DB, session.user.id) })
}
