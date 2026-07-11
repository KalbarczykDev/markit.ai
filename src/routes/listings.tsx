import { Button, Chip } from '@heroui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useAccount } from '@/account'
import { SavedListings } from '@/components/SavedListings'

export const Route = createFileRoute('/listings')({ component: ListingsPage })

function ListingsPage() {
  const navigate = useNavigate()
  const { profile, isLoading } = useAccount()

  useEffect(() => {
    if (!isLoading && !profile) void navigate({ to: '/login', replace: true })
  }, [isLoading, navigate, profile])

  if (isLoading || !profile) {
    return <main className="profile-stage" aria-label="Loading saved listings" />
  }

  return (
    <main className="profile-stage">
      <div className="profile-shell listings-shell">
        <Button
          variant="ghost"
          size="sm"
          className="back-button"
          onPress={() => void navigate({ to: '/' })}
        >
          <span aria-hidden="true">←</span> Back to assistant
        </Button>

        <section className="profile-intro" aria-labelledby="listings-title">
          <div>
            <span className="eyebrow">Your collection</span>
            <h1 id="listings-title">Saved listings</h1>
            <p>Revisit the products you asked Markit to save while you were shopping.</p>
          </div>
          <Chip color="success" variant="soft" size="sm">
            Private to you
          </Chip>
        </section>

        <SavedListings />
      </div>
    </main>
  )
}
