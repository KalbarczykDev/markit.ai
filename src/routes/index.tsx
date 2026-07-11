import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { useAccount } from '@/account'
import { MainSidebar } from '@/components/MainSidebar'
import { VoiceOrb } from '@/components/VoiceOrb'
import { useConversations } from '@/conversations-client'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { profile } = useAccount()
  const conversations = useConversations(profile)

  return (
    <main className={`voice-stage${isSidebarCollapsed ? ' sidebar-is-hidden' : ''}`}>
      <MainSidebar
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
        conversations={conversations.conversations}
        activeConversationId={conversations.activeConversationId}
        onSelectConversation={conversations.selectConversation}
        onNewConversation={() => void conversations.createNew()}
      />
      <VoiceOrb
        key={conversations.voiceKey}
        conversationId={conversations.activeConversationId}
        onConversationUpdated={() => void conversations.refresh()}
      />
    </main>
  )
}
