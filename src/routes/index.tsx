import { createFileRoute } from '@tanstack/react-router'

import { MainSidebar } from '@/components/MainSidebar'
import { VoiceOrb } from '@/components/VoiceOrb'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="voice-stage">
      <MainSidebar />
      <VoiceOrb />
    </main>
  )
}
