import { Button, Card, Input, Spinner } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'

import { useAccount } from '@/account'

export function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate()
  const { profile, isLoading, login, signup } = useAccount()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignup = mode === 'signup'

  useEffect(() => {
    if (!isLoading && profile) void navigate({ to: '/profile', replace: true })
  }, [isLoading, navigate, profile])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (isSignup && password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isSignup) await signup({ name, email, password })
      else await login({ email, password })
      await navigate({ to: '/profile', replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to continue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || profile) {
    return (
      <main className="auth-stage auth-loading-stage">
        <Spinner label="Loading account" />
      </main>
    )
  }

  return (
    <main className="auth-stage">
      <section className="auth-shell" aria-labelledby="auth-title">
        <div className="auth-copy">
          <span className="eyebrow">{isSignup ? 'Start shopping smarter' : 'Welcome back'}</span>
          <h1 id="auth-title">{isSignup ? 'Create your Markit account' : 'Log in to Markit'}</h1>
          <p>
            {isSignup
              ? 'Keep your preferences, wallet and shopping profile securely connected.'
              : 'Access your wallet, preferences and personalized shopping profile.'}
          </p>
        </div>

        <Card className="auth-card">
          <Card.Content>
            <form className="auth-form" onSubmit={submit}>
              {isSignup ? (
                <label>
                  <span>Full name</span>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    autoComplete="name"
                    placeholder="Your name"
                    minLength={2}
                    maxLength={80}
                    required
                    autoFocus
                  />
                </label>
              ) : null}
              <label>
                <span>Email address</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  autoFocus={!isSignup}
                />
              </label>
              <label>
                <span>Password</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={isSignup ? 'At least 10 characters' : 'Your password'}
                  minLength={isSignup ? 10 : undefined}
                  maxLength={128}
                  required
                />
              </label>
              {isSignup ? (
                <label>
                  <span>Confirm password</span>
                  <Input
                    type="password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.currentTarget.value)}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    minLength={10}
                    maxLength={128}
                    required
                  />
                </label>
              ) : null}

              <div className="auth-error" role="alert">
                {error}
              </div>
              <Button type="submit" fullWidth className="auth-submit" isDisabled={isSubmitting}>
                {isSubmitting ? <Spinner size="sm" color="current" /> : null}
                {isSubmitting
                  ? isSignup
                    ? 'Creating account…'
                    : 'Logging in…'
                  : isSignup
                    ? 'Create account'
                    : 'Log in'}
              </Button>
            </form>
          </Card.Content>
          <Card.Footer className="auth-footer">
            <span>{isSignup ? 'Already have an account?' : 'New to Markit?'}</span>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => void navigate({ to: isSignup ? '/login' : '/signup' })}
            >
              {isSignup ? 'Log in' : 'Create account'}
            </Button>
          </Card.Footer>
        </Card>

        <p className="auth-security-note">
          Passwords are salted and hashed. Sessions use secure, HTTP-only cookies.
        </p>
      </section>
    </main>
  )
}
