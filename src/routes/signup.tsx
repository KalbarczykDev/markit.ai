import { createFileRoute } from '@tanstack/react-router'

import { AuthScreen } from '@/components/AuthScreen'

export const Route = createFileRoute('/signup')({ component: SignUpPage })

function SignUpPage() {
  return <AuthScreen mode="signup" />
}
