import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Radio,
  RadioGroup,
  Switch,
  TextField,
} from '@heroui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'

import { type ThemePreference, useAccount } from '@/account'
import { FavoriteListings } from '@/components/FavoriteListings'

export const Route = createFileRoute('/profile')({ component: ProfilePage })

const THEMES: Array<{ id: ThemePreference; label: string; description: string }> = [
  { id: 'system', label: 'System', description: 'Match this device' },
  { id: 'light', label: 'Light', description: 'Bright and airy' },
  { id: 'dark', label: 'Dark', description: 'Easy on the eyes' },
]

type BillingProduct = {
  id: string
  name: string
  description: string | null
  price: number | null
  currency: string
  recurring: { interval: string; intervalCount: number } | null
  active: boolean
}

async function billingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin' })
  const body = (await response.json()) as T & { message?: string }
  if (!response.ok) throw new Error(body.message || 'The billing request could not be completed.')
  return body
}

function BillingCard() {
  const [product, setProduct] = useState<BillingProduct | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [notice, setNotice] = useState('')
  const [billingError, setBillingError] = useState('')

  useEffect(() => {
    let active = true
    void billingRequest<{ product: BillingProduct }>('/api/billing/product')
      .then((result) => {
        if (active) setProduct(result.product)
      })
      .catch((error: unknown) => {
        if (active) {
          setBillingError(error instanceof Error ? error.message : 'Billing is unavailable.')
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const checkout = search.get('checkout')
    const sessionId = search.get('session_id')
    if (checkout === 'cancelled') {
      setNotice('Checkout cancelled. You were not charged.')
      window.history.replaceState({}, '', '/profile')
      return
    }
    if (checkout !== 'success' || !sessionId) return

    setNotice('Confirming your payment…')
    void billingRequest<{ paymentStatus: string }>(
      `/api/billing/session?session_id=${encodeURIComponent(sessionId)}`,
    )
      .then(({ paymentStatus }) => {
        setProduct((current) => (current ? { ...current, active: true } : current))
        setNotice(
          paymentStatus === 'paid' || paymentStatus === 'no_payment_required'
            ? 'Payment confirmed. Your purchase is active.'
            : 'Checkout completed. Payment confirmation is pending.',
        )
        window.history.replaceState({}, '', '/profile')
      })
      .catch((error: unknown) => {
        setBillingError(error instanceof Error ? error.message : 'Unable to confirm payment.')
      })
  }, [])

  const redirectTo = async (path: '/api/billing/checkout' | '/api/billing/portal') => {
    setIsRedirecting(true)
    setBillingError('')
    try {
      const { url } = await billingRequest<{ url: string }>(path, { method: 'POST' })
      window.location.assign(url)
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Unable to open Stripe checkout.')
      setIsRedirecting(false)
    }
  }

  const active = product?.active ?? false
  const canManage = active && Boolean(product?.recurring)
  const price =
    product?.price === null || product?.price === undefined
      ? null
      : new Intl.NumberFormat('en', {
          style: 'currency',
          currency: product.currency,
        }).format(product.price / 100)
  const cadence = product?.recurring
    ? ` every ${product.recurring.intervalCount > 1 ? `${product.recurring.intervalCount} ` : ''}${product.recurring.interval}${product.recurring.intervalCount > 1 ? 's' : ''}`
    : ''

  return (
    <Card className="settings-card">
      <Card.Header>
        <div>
          <Card.Title>Plan & billing</Card.Title>
          <Card.Description>
            Secure payment processing and receipts through Stripe.
          </Card.Description>
        </div>
        <Chip color={active ? 'success' : 'default'} variant="soft" size="sm">
          {active ? 'Active' : 'Not active'}
        </Chip>
      </Card.Header>
      <Card.Content>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <strong>{product?.name || 'Loading plan…'}</strong>
            {product?.description ? (
              <p className="m-0 text-sm opacity-70">{product.description}</p>
            ) : null}
            {price ? (
              <p className="m-0 text-sm">
                <strong>{price}</strong>
                {cadence}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className="text-sm"
              role="status"
              aria-live="polite"
              data-error={Boolean(billingError)}
            >
              {billingError || notice}
            </span>
            <Button
              className={active ? undefined : 'save-profile-button'}
              variant={active ? 'ghost' : undefined}
              isDisabled={
                Boolean(billingError && !product) ||
                !product ||
                isRedirecting ||
                (active && !canManage)
              }
              onPress={() =>
                void redirectTo(canManage ? '/api/billing/portal' : '/api/billing/checkout')
              }
            >
              {isRedirecting
                ? 'Opening Stripe…'
                : canManage
                  ? 'Manage billing'
                  : active
                    ? 'Purchased'
                    : 'Continue to checkout'}
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function ProfilePage() {
  const navigate = useNavigate()
  const { profile, isLoading, theme, setTheme, updateProfile } = useAccount()
  const [name, setName] = useState(profile?.name ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [offersEnabled, setOffersEnabled] = useState(profile?.offersEnabled ?? true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading && !profile) void navigate({ to: '/login', replace: true })
    if (profile) {
      setName(profile.name)
      setEmail(profile.email)
      setOffersEnabled(profile.offersEnabled)
    }
  }, [isLoading, navigate, profile])

  const wallet = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    (profile?.walletCents ?? 0) / 100,
  )

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      await updateProfile({ name: name.trim(), email: email.trim() })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your profile.')
    }
  }

  if (isLoading || !profile) {
    return <main className="profile-stage" aria-label="Loading profile" />
  }

  return (
    <main className="profile-stage">
      <div className="profile-shell">
        <Button
          variant="ghost"
          size="sm"
          className="back-button"
          onPress={() => void navigate({ to: '/' })}
        >
          <span aria-hidden="true">←</span> Back to assistant
        </Button>

        <section className="profile-intro" aria-labelledby="profile-title">
          <div>
            <span className="eyebrow">Your account</span>
            <h1 id="profile-title">Profile & preferences</h1>
            <p>Manage the details and settings Markit uses for your shopping experience.</p>
          </div>
          <Chip color="success" variant="soft" size="sm">
            Active account
          </Chip>
        </section>

        <div className="profile-grid">
          <aside className="profile-summary">
            <Card className="identity-card">
              <Card.Content>
                <Avatar size="lg" className="profile-avatar">
                  <Avatar.Fallback>{initials(profile.name) || 'M'}</Avatar.Fallback>
                </Avatar>
                <div>
                  <h2>{profile.name}</h2>
                  <p>{profile.email || 'Add an email to complete your profile'}</p>
                </div>
              </Card.Content>
            </Card>

            <Card className="wallet-card">
              <Card.Header>
                <div>
                  <span className="eyebrow">Markit wallet</span>
                  <Card.Title>{wallet}</Card.Title>
                </div>
              </Card.Header>
              <Card.Description>
                Available credit for eligible purchases and rewards.
              </Card.Description>
              <Card.Footer>
                <span>Wallet ID</span>
                <strong>•••• {profile.id.slice(-4).toUpperCase()}</strong>
              </Card.Footer>
            </Card>
          </aside>

          <div className="profile-settings">
            <BillingCard />
            <FavoriteListings />

            <Card className="settings-card">
              <Card.Header>
                <div>
                  <Card.Title>Personal details</Card.Title>
                  <Card.Description>
                    Shown in your account menu and recommendations.
                  </Card.Description>
                </div>
              </Card.Header>
              <Card.Content>
                <form className="profile-form" onSubmit={saveProfile}>
                  <TextField value={name} onChange={setName}>
                    <Label>Display name</Label>
                    <Input placeholder="Your name" />
                  </TextField>
                  <TextField type="email" value={email} onChange={setEmail}>
                    <Label>Email address</Label>
                    <Input placeholder="you@example.com" />
                  </TextField>
                  <div className="form-actions">
                    <span role="status" aria-live="polite" data-error={Boolean(error)}>
                      {error || (saved ? 'Changes saved' : '')}
                    </span>
                    <Button type="submit" className="save-profile-button">
                      Save profile
                    </Button>
                  </div>
                </form>
              </Card.Content>
            </Card>

            <Card className="settings-card">
              <Card.Header>
                <div>
                  <Card.Title>Appearance</Card.Title>
                  <Card.Description>Choose how Markit looks on this device.</Card.Description>
                </div>
              </Card.Header>
              <Card.Content>
                <RadioGroup
                  value={theme}
                  onChange={(value) => setTheme(value as ThemePreference)}
                  aria-label="Color theme"
                  className="theme-options"
                >
                  {THEMES.map((option) => (
                    <Radio key={option.id} value={option.id} className="theme-option">
                      <Radio.Content className="theme-option-content">
                        <span
                          className={`theme-preview theme-preview-${option.id}`}
                          aria-hidden="true"
                        />
                        <span className="theme-option-copy">
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </Card.Content>
            </Card>

            <Card className="settings-card preferences-card">
              <Card.Header>
                <div>
                  <Card.Title>Shopping preferences</Card.Title>
                  <Card.Description>Control optional account communication.</Card.Description>
                </div>
              </Card.Header>
              <Card.Content>
                <Switch
                  isSelected={offersEnabled}
                  onChange={(selected) => {
                    setOffersEnabled(selected)
                    void updateProfile({ offersEnabled: selected }).catch(() => {
                      setOffersEnabled(!selected)
                    })
                  }}
                >
                  <Switch.Content>
                    <strong>Price-drop alerts</strong>
                    <span>Notify me when a saved product drops in price.</span>
                  </Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </Card.Content>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
