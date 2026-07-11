import { createFileRoute } from '@tanstack/react-router'

import { VoiceOrb } from '@/components/VoiceOrb'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="voice-stage">
      <VoiceOrb />
    </main>
  )
}
