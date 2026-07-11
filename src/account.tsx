import { Avatar, Dropdown } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Key,
  type ReactNode,
} from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

type AccountProfile = {
  name: string
  email: string
  walletCents: number
}

type AccountContextValue = {
  profile: AccountProfile
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  updateProfile: (profile: Pick<AccountProfile, 'name' | 'email'>) => void
}

const DEFAULT_PROFILE: AccountProfile = {
  name: 'Markit shopper',
  email: '',
  walletCents: 2500,
}

const AccountContext = createContext<AccountContextValue | null>(null)

function applyTheme(preference: ThemePreference) {
  const resolved =
    preference === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [theme, setThemeState] = useState<ThemePreference>('system')

  useEffect(() => {
    const savedProfile = localStorage.getItem('markit-profile')
    const savedTheme = localStorage.getItem('markit-theme')

    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile) as Partial<AccountProfile>
        setProfile((current) => ({
          ...current,
          name: typeof parsed.name === 'string' ? parsed.name : current.name,
          email: typeof parsed.email === 'string' ? parsed.email : current.email,
        }))
      } catch {}
    }

    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
      setThemeState(savedTheme)
      applyTheme(savedTheme)
    } else {
      applyTheme('system')
    }
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => applyTheme('system')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])

  const value = useMemo<AccountContextValue>(
    () => ({
      profile,
      theme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme)
        localStorage.setItem('markit-theme', nextTheme)
        applyTheme(nextTheme)
      },
      updateProfile: (nextProfile) => {
        setProfile((current) => {
          const updated = { ...current, ...nextProfile }
          localStorage.setItem('markit-profile', JSON.stringify(updated))
          return updated
        })
      },
    }),
    [profile, theme],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) throw new Error('useAccount must be used within AccountProvider')
  return context
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function AccountBar() {
  const navigate = useNavigate()
  const { profile } = useAccount()
  const wallet = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    profile.walletCents / 100,
  )

  const handleAction = (key: Key) => {
    if (key === 'profile') void navigate({ to: '/profile' })
    if (key === 'home') void navigate({ to: '/' })
  }

  return (
    <header className="account-bar">
      <button className="brand-mark" type="button" onClick={() => void navigate({ to: '/' })}>
        markit<span>.ai</span>
      </button>
      <div className="account-actions">
        <div className="wallet-pill" aria-label={`Wallet balance ${wallet}`}>
          <span>Wallet</span>
          <strong>{wallet}</strong>
        </div>
        <Dropdown>
          <Dropdown.Trigger className="account-trigger" aria-label="Open account menu">
            <Avatar size="sm" className="account-avatar">
              <Avatar.Fallback>{initials(profile.name) || 'M'}</Avatar.Fallback>
            </Avatar>
            <span className="account-trigger-copy">
              <small>Account</small>
              <strong>{profile.name}</strong>
            </span>
            <span aria-hidden="true" className="account-chevron">
              ↓
            </span>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className="account-popover">
            <div className="account-popover-heading">
              <strong>{profile.name}</strong>
              <span>{profile.email || 'Local profile'}</span>
            </div>
            <Dropdown.Menu
              aria-label="Account menu"
              onAction={handleAction}
              className="account-menu"
            >
              <Dropdown.Item id="profile" textValue="Profile and settings">
                Profile & settings
              </Dropdown.Item>
              <Dropdown.Item id="home" textValue="Voice assistant">
                Voice assistant
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </header>
  )
}
