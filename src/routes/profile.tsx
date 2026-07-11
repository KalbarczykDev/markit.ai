import { Avatar, Button, Card, Chip, Input, Switch } from '@heroui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'

import { type ThemePreference, useAccount } from '@/account'

export const Route = createFileRoute('/profile')({ component: ProfilePage })

const THEMES: Array<{ id: ThemePreference; label: string; description: string }> = [
  { id: 'system', label: 'System', description: 'Match this device' },
  { id: 'light', label: 'Light', description: 'Bright and airy' },
  { id: 'dark', label: 'Dark', description: 'Easy on the eyes' },
]

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
                <span className="wallet-icon" aria-hidden="true">
                  ◇
                </span>
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
                  <label>
                    <span>Display name</span>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.currentTarget.value)}
                      placeholder="Your name"
                      aria-label="Display name"
                    />
                  </label>
                  <label>
                    <span>Email address</span>
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.currentTarget.value)}
                      placeholder="you@example.com"
                      aria-label="Email address"
                    />
                  </label>
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
                <div className="theme-options" role="group" aria-label="Color theme">
                  {THEMES.map((option) => (
                    <Button
                      key={option.id}
                      variant="ghost"
                      className="theme-option"
                      data-selected={theme === option.id}
                      aria-pressed={theme === option.id}
                      onPress={() => setTheme(option.id)}
                    >
                      <span
                        className={`theme-preview theme-preview-${option.id}`}
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </Button>
                  ))}
                </div>
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
