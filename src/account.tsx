import { Avatar, Button, Dropdown, Spinner } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Key,
  type ReactNode,
} from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

export type AccountProfile = {
  id: string
  name: string
  email: string
  walletCents: number
  theme: ThemePreference
  offersEnabled: boolean
}

type Credentials = { email: string; password: string }
type SignUpDetails = Credentials & { name: string }

type AccountContextValue = {
  profile: AccountProfile | null
  isLoading: boolean
  theme: ThemePreference
  login: (credentials: Credentials) => Promise<void>
  signup: (details: SignUpDetails) => Promise<void>
  logout: () => Promise<void>
  setTheme: (theme: ThemePreference) => void
  updateProfile: (
    profile: Partial<Pick<AccountProfile, 'name' | 'email' | 'offersEnabled'>>,
  ) => Promise<void>
}

type AuthResponse = { user?: AccountProfile | null; error?: string }

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

async function authRequest(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  })
  const data = (await response.json()) as AuthResponse
  if (!response.ok) throw new Error(data.error || 'The account request could not be completed.')
  return data
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [theme, setThemeState] = useState<ThemePreference>('system')

  useEffect(() => {
    const savedTheme = localStorage.getItem('markit-theme')
    const initialTheme: ThemePreference =
      savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
        ? savedTheme
        : 'system'
    setThemeState(initialTheme)
    applyTheme(initialTheme)

    void authRequest('/api/auth/session')
      .then(({ user }) => {
        setProfile(user ?? null)
        if (user) {
          setThemeState(user.theme)
          localStorage.setItem('markit-theme', user.theme)
          applyTheme(user.theme)
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => applyTheme('system')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])

  const login = useCallback(async (credentials: Credentials) => {
    const { user } = await authRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    if (!user) throw new Error('Your account could not be loaded.')
    setProfile(user)
    setThemeState(user.theme)
    localStorage.setItem('markit-theme', user.theme)
    applyTheme(user.theme)
  }, [])

  const signup = useCallback(async (details: SignUpDetails) => {
    const { user } = await authRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    if (!user) throw new Error('Your account could not be created.')
    setProfile(user)
    setThemeState(user.theme)
    localStorage.setItem('markit-theme', user.theme)
    applyTheme(user.theme)
  }, [])

  const logout = useCallback(async () => {
    await authRequest('/api/auth/logout', { method: 'POST' })
    setProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (updates: Partial<Pick<AccountProfile, 'name' | 'email' | 'offersEnabled'>>) => {
      const { user } = await authRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      if (!user) throw new Error('Your profile could not be updated.')
      setProfile(user)
    },
    [],
  )

  const setTheme = useCallback(
    (nextTheme: ThemePreference) => {
      setThemeState(nextTheme)
      localStorage.setItem('markit-theme', nextTheme)
      applyTheme(nextTheme)
      if (profile) {
        setProfile((current) => (current ? { ...current, theme: nextTheme } : current))
        void authRequest('/api/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify({ theme: nextTheme }),
        }).then(({ user }) => {
          if (user) setProfile(user)
        })
      }
    },
    [profile],
  )

  const value = useMemo<AccountContextValue>(
    () => ({
      profile,
      isLoading,
      theme,
      login,
      signup,
      logout,
      setTheme,
      updateProfile,
    }),
    [profile, isLoading, theme, login, signup, logout, setTheme, updateProfile],
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
  const { profile, isLoading, logout } = useAccount()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const wallet = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    (profile?.walletCents ?? 0) / 100,
  )

  const handleAction = (key: Key) => {
    if (key === 'profile') void navigate({ to: '/profile' })
    if (key === 'home') void navigate({ to: '/' })
    if (key === 'logout') {
      setIsLoggingOut(true)
      void logout().finally(() => setIsLoggingOut(false))
    }
  }

  return (
    <header className="account-bar">
      <button className="brand-mark" type="button" onClick={() => void navigate({ to: '/' })}>
        <img src="/logo.svg" alt="markit.ai" />
      </button>
      <div className="account-actions">
        {isLoading ? (
          <div className="account-loading" aria-label="Loading account">
            <Spinner size="sm" />
          </div>
        ) : profile ? (
          <>
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
                  <span>{profile.email}</span>
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
                  <Dropdown.Item id="logout" textValue="Sign out" isDisabled={isLoggingOut}>
                    {isLoggingOut ? 'Signing out…' : 'Sign out'}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </>
        ) : (
          <div className="signed-out-actions">
            <Button variant="ghost" size="sm" onPress={() => void navigate({ to: '/login' })}>
              Log in
            </Button>
            <Button
              size="sm"
              className="create-account-button"
              onPress={() => void navigate({ to: '/signup' })}
            >
              Create account
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
