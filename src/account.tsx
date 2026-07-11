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
  theme: ThemePreference
  offersEnabled: boolean
}

type Credentials = { email: string; password: string }

type AccountContextValue = {
  profile: AccountProfile | null
  isLoading: boolean
  theme: ThemePreference
  login: (credentials: Credentials) => Promise<void>
  logout: () => Promise<void>
  setTheme: (theme: ThemePreference) => void
  updateProfile: (
    profile: Partial<Pick<AccountProfile, 'name' | 'email' | 'offersEnabled'>>,
  ) => Promise<void>
}

type AuthUser = {
  id: string
  name: string
  email: string
  theme?: string
  offersEnabled?: boolean
}

type AuthError = { message?: string; error?: string }
type UserResponse = { user?: AuthUser | null }
type SessionResponse = { user?: AuthUser | null; session?: unknown }

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

function accountProfile(user: AuthUser): AccountProfile {
  const theme: ThemePreference =
    user.theme === 'light' || user.theme === 'dark' ? user.theme : 'system'
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    theme,
    offersEnabled: user.offersEnabled ?? true,
  }
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  })
  const data = (await response.json()) as T & AuthError
  if (!response.ok) {
    throw new Error(data.message || data.error || 'The account request could not be completed.')
  }
  return data as T
}

async function currentProfile() {
  const { user } = await authRequest<SessionResponse>('/api/auth/get-session')
  return user ? accountProfile(user) : null
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

    void currentProfile()
      .then((userProfile) => {
        setProfile(userProfile)
        if (userProfile) {
          setThemeState(userProfile.theme)
          localStorage.setItem('markit-theme', userProfile.theme)
          applyTheme(userProfile.theme)
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
    const { user } = await authRequest<UserResponse>('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ ...credentials, rememberMe: true }),
    })
    if (!user) throw new Error('Your account could not be loaded.')
    const nextProfile = accountProfile(user)
    setProfile(nextProfile)
    setThemeState(nextProfile.theme)
    localStorage.setItem('markit-theme', nextProfile.theme)
    applyTheme(nextProfile.theme)
  }, [])

  const logout = useCallback(async () => {
    await authRequest('/api/auth/sign-out', { method: 'POST' })
    setProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (updates: Partial<Pick<AccountProfile, 'name' | 'email' | 'offersEnabled'>>) => {
      if (updates.email && updates.email !== profile?.email) {
        await authRequest('/api/auth/change-email', {
          method: 'POST',
          body: JSON.stringify({ newEmail: updates.email }),
        })
      }
      const userUpdates = {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.offersEnabled !== undefined ? { offersEnabled: updates.offersEnabled } : {}),
      }
      if (Object.keys(userUpdates).length) {
        await authRequest('/api/auth/update-user', {
          method: 'POST',
          body: JSON.stringify(userUpdates),
        })
      }
      setProfile(await currentProfile())
    },
    [profile?.email],
  )

  const setTheme = useCallback(
    (nextTheme: ThemePreference) => {
      setThemeState(nextTheme)
      localStorage.setItem('markit-theme', nextTheme)
      applyTheme(nextTheme)
      if (profile) {
        setProfile((current) => (current ? { ...current, theme: nextTheme } : current))
        void authRequest('/api/auth/update-user', {
          method: 'POST',
          body: JSON.stringify({ theme: nextTheme }),
        }).then(() => currentProfile().then(setProfile))
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
      logout,
      setTheme,
      updateProfile,
    }),
    [profile, isLoading, theme, login, logout, setTheme, updateProfile],
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
                  <svg viewBox="0 0 12 12" fill="none">
                    <path
                      d="m3 4.75 3 3 3-3"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
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
          <Button variant="ghost" size="sm" onPress={() => void navigate({ to: '/login' })}>
            Log in
          </Button>
        )}
      </div>
    </header>
  )
}
