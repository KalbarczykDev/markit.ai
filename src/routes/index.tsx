import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { MainSidebar } from '@/components/MainSidebar'
import { VoiceOrb } from '@/components/VoiceOrb'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <main className={`voice-stage${isSidebarCollapsed ? ' sidebar-is-hidden' : ''}`}>
      <MainSidebar isCollapsed={isSidebarCollapsed} onCollapsedChange={setIsSidebarCollapsed} />
      <VoiceOrb />
    </main>
  )
}
