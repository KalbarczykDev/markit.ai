import { Card, Link, Spinner } from '@heroui/react'
import { useEffect, useState } from 'react'

import type { FavoriteListing } from '@/favorite-types'

export function FavoriteListings() {
  const [favorites, setFavorites] = useState<FavoriteListing[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    void fetch('/api/favorites', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Favorites unavailable')
        return (await response.json()) as { favorites: FavoriteListing[] }
      })
      .then(({ favorites: savedFavorites }) => {
        if (!active) return
        setFavorites(savedFavorites)
        setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <Card className="settings-card favorite-listings-card">
      <Card.Header>
        <div>
          <Card.Title>Favorite listings</Card.Title>
          <Card.Description>
            Products you explicitly asked the shopping agent to save.
          </Card.Description>
        </div>
        {status === 'ready' && favorites.length ? (
          <span className="favorite-count">{favorites.length}</span>
        ) : null}
      </Card.Header>
      <Card.Content>
        {status === 'loading' ? (
          <div className="favorites-state" role="status">
            <Spinner size="sm" /> Loading favorites…
          </div>
        ) : status === 'error' ? (
          <div className="favorites-state" role="alert">
            Favorites could not be loaded. Refresh to try again.
          </div>
        ) : favorites.length === 0 ? (
          <div className="favorites-state">
            Ask Markit to “favorite this listing” and it will appear here.
          </div>
        ) : (
          <div className="favorite-list">
            {favorites.map((favorite) => (
              <article className="favorite-listing" key={favorite.id}>
                <div className="favorite-listing-image" aria-hidden="true">
                  {favorite.image ? <img src={favorite.image} alt="" loading="lazy" /> : '♡'}
                </div>
                <div className="favorite-listing-copy">
                  <span>{favorite.source}</span>
                  <strong>{favorite.title}</strong>
                  <small>
                    {favorite.price ||
                      `Saved ${new Date(favorite.favoritedAt).toLocaleDateString()}`}
                  </small>
                </div>
                <Link
                  href={favorite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${favorite.title}`}
                >
                  View
                  <Link.Icon aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </Card.Content>
    </Card>
  )
}
