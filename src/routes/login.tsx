import { createFileRoute } from '@tanstack/react-router'

import { AuthScreen } from '@/components/AuthScreen'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  return <AuthScreen mode="login" />
}
