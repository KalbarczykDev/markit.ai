import { ChevronDown } from '@gravity-ui/icons'
import {
  Button,
  Card,
  Chip,
  Dropdown,
  Input,
  Label,
  Spinner,
  Switch,
  TextField,
} from '@heroui/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent, type Key } from 'react'

import { useAccount } from '@/account'
import type { AlertIntervalUnit, PriceAlertSettings } from '@/price-alert-types'

export const Route = createFileRoute('/alerts')({ component: PriceAlertsPage })

type SettingsResponse = { settings?: PriceAlertSettings; message?: string }

async function settingsRequest(init?: RequestInit): Promise<PriceAlertSettings> {
  const response = await fetch('/api/price-alerts', {
    ...init,
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const data = (await response.json()) as SettingsResponse
  if (!response.ok || !data.settings) {
    throw new Error(data.message || 'Price alert settings could not be loaded.')
  }
  return data.settings
}

function PriceAlertsPage() {
  const navigate = useNavigate()
  const { profile, isLoading: isAccountLoading } = useAccount()
  const [settings, setSettings] = useState<PriceAlertSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAccountLoading && !profile) {
      void navigate({ to: '/login', replace: true })
      return
    }
    if (!profile) return
    void settingsRequest()
      .then(setSettings)
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Unable to load price alerts.')
      })
  }, [isAccountLoading, navigate, profile])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!settings) return
    setIsSaving(true)
    setError('')
    setMessage('')
    try {
      const saved = await settingsRequest({ method: 'PUT', body: JSON.stringify(settings) })
      setSettings(saved)
      setMessage(saved.enabled ? 'Telegram price alerts are active.' : 'Price alerts are paused.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save price alerts.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isAccountLoading || !profile || (!settings && !error)) {
    return (
      <main className="profile-stage alert-loading-stage" aria-label="Loading price alerts">
        <Spinner />
      </main>
    )
  }

  return (
    <main className="profile-stage">
      <div className="profile-shell alerts-shell">
        <Button
          variant="ghost"
          size="sm"
          className="back-button"
          onPress={() => void navigate({ to: '/' })}
        >
          <span aria-hidden="true">←</span> Back to assistant
        </Button>

        <section className="profile-intro" aria-labelledby="alerts-title">
          <div>
            <span className="eyebrow">Automated monitoring</span>
            <h1 id="alerts-title">Price-drop alerts</h1>
            <p>
              Markit checks your saved listings with live web search and sends verified drops to
              Telegram.
            </p>
          </div>
          <Chip color={settings?.enabled ? 'success' : 'default'} variant="soft" size="sm">
            {settings?.enabled ? 'Monitoring' : 'Paused'}
          </Chip>
        </section>

        <Card className="settings-card alert-settings-card">
          <Card.Header>
            <div>
              <Card.Title>Telegram delivery</Card.Title>
              <Card.Description>
                Start a chat with your bot first, then enter the numeric chat ID it should notify.
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            {settings ? (
              <form className="alert-form" onSubmit={save}>
                <Switch
                  isSelected={settings.enabled}
                  onChange={(enabled) => setSettings({ ...settings, enabled })}
                >
                  <Switch.Content>
                    <strong>Monitor saved listings</strong>
                    <span>Send only when a researched price is below the last observed price.</span>
                  </Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>

                <TextField
                  value={settings.telegramChatId}
                  onChange={(telegramChatId) => setSettings({ ...settings, telegramChatId })}
                >
                  <Label>Telegram chat ID</Label>
                  <Input inputMode="numeric" placeholder="123456789" />
                </TextField>

                <div className="interval-fields">
                  <TextField
                    type="number"
                    value={String(settings.intervalValue)}
                    onChange={(value) =>
                      setSettings({ ...settings, intervalValue: Number(value) || 1 })
                    }
                  >
                    <Label>Check every</Label>
                    <Input min={settings.intervalUnit === 'seconds' ? 30 : 1} max={10080} />
                  </TextField>
                  <div className="interval-unit-field">
                    <Label>Interval unit</Label>
                    <Dropdown>
                      <Dropdown.Trigger className="interval-unit-trigger">
                        <span>{settings.intervalUnit === 'seconds' ? 'Seconds' : 'Minutes'}</span>
                        <ChevronDown aria-hidden="true" />
                      </Dropdown.Trigger>
                      <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu
                          aria-label="Price check interval unit"
                          selectionMode="single"
                          selectedKeys={[settings.intervalUnit]}
                          onAction={(key: Key) =>
                            setSettings({ ...settings, intervalUnit: key as AlertIntervalUnit })
                          }
                        >
                          <Dropdown.Item id="seconds">Seconds</Dropdown.Item>
                          <Dropdown.Item id="minutes">Minutes</Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  </div>
                </div>

                <p className="alert-privacy-note">
                  Product URLs are checked by GPT-5.6 Luna with web search. Your bot token stays
                  server-side and is never sent to the browser.
                </p>
                <div className="form-actions">
                  <span role="status" aria-live="polite" data-error={Boolean(error)}>
                    {error || message}
                  </span>
                  <Button type="submit" className="save-profile-button" isPending={isSaving}>
                    Save alert settings
                  </Button>
                </div>
              </form>
            ) : (
              <div className="alert-error" role="alert">
                <p>{error}</p>
                <Button variant="secondary" onPress={() => window.location.reload()}>
                  Try again
                </Button>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </main>
  )
}
