import { Card, Link, Spinner } from '@heroui/react'
import { useEffect, useState } from 'react'

import type { SavedListing } from '@/saved-listing-types'

export function SavedListings() {
  const [listings, setListings] = useState<SavedListing[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    void fetch('/api/listings', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Saved listings unavailable')
        return (await response.json()) as { listings: SavedListing[] }
      })
      .then(({ listings: savedListings }) => {
        if (!active) return
        setListings(savedListings)
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
    <Card className="settings-card saved-listings-card">
      <Card.Header>
        <div>
          <Card.Title>Saved listings</Card.Title>
          <Card.Description>
            Products saved from the shopping agent or results table.
          </Card.Description>
        </div>
        {status === 'ready' && listings.length ? (
          <span className="listing-count">{listings.length}</span>
        ) : null}
      </Card.Header>
      <Card.Content>
        {status === 'loading' ? (
          <div className="listings-state" role="status">
            <Spinner size="sm" /> Loading listings…
          </div>
        ) : status === 'error' ? (
          <div className="listings-state" role="alert">
            Saved listings could not be loaded. Refresh to try again.
          </div>
        ) : listings.length === 0 ? (
          <div className="listings-state">
            Save products from a results table or ask Markit to “save this listing.”
          </div>
        ) : (
          <div className="saved-list">
            {listings.map((listing) => (
              <article className="saved-listing" key={listing.id}>
                <div className="saved-listing-image" aria-hidden="true">
                  {listing.image ? <img src={listing.image} alt="" loading="lazy" /> : '♡'}
                </div>
                <div className="saved-listing-copy">
                  <span>{listing.source}</span>
                  <strong>{listing.title}</strong>
                  <small>
                    {listing.price || `Saved ${new Date(listing.savedAt).toLocaleDateString()}`}
                  </small>
                </div>
                <Link
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${listing.title}`}
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
