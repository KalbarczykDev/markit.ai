import { Button, Chip } from '@heroui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useAccount } from '@/account'
import { FavoriteListings } from '@/components/FavoriteListings'

export const Route = createFileRoute('/favorites')({ component: FavoritesPage })

function FavoritesPage() {
  const navigate = useNavigate()
  const { profile, isLoading } = useAccount()

  useEffect(() => {
    if (!isLoading && !profile) void navigate({ to: '/login', replace: true })
  }, [isLoading, navigate, profile])

  if (isLoading || !profile) {
    return <main className="profile-stage" aria-label="Loading favorites" />
  }

  return (
    <main className="profile-stage">
      <div className="profile-shell favorites-shell">
        <Button
          variant="ghost"
          size="sm"
          className="back-button"
          onPress={() => void navigate({ to: '/' })}
        >
          <span aria-hidden="true">←</span> Back to assistant
        </Button>

        <section className="profile-intro" aria-labelledby="favorites-title">
          <div>
            <span className="eyebrow">Your collection</span>
            <h1 id="favorites-title">Favorites</h1>
            <p>Revisit the products you asked Markit to save while you were shopping.</p>
          </div>
          <Chip color="success" variant="soft" size="sm">
            Private to you
          </Chip>
        </section>

        <FavoriteListings />
      </div>
    </main>
  )
}
