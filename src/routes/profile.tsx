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
          </aside>

          <div className="profile-settings">
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
