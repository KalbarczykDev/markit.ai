import {
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  Comment,
  Microphone,
  Person,
  Plus,
} from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'

import { useAccount } from '@/account'
import type { ConversationSummary } from '@/conversation-types'

type MainSidebarProps = {
  isCollapsed: boolean
  onCollapsedChange: (isCollapsed: boolean) => void
  conversations: ConversationSummary[]
  activeConversationId?: string
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
}

export function MainSidebar({
  isCollapsed,
  onCollapsedChange,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: MainSidebarProps) {
  const navigate = useNavigate()
  const { profile } = useAccount()

  const openAccountPage = (to: '/listings' | '/profile') => {
    void navigate({ to: profile ? to : '/login' })
  }

  if (isCollapsed) {
    return (
      <Button
        isIconOnly
        variant="secondary"
        className="sidebar-expand-button"
        aria-label="Show sidebar"
        onPress={() => onCollapsedChange(false)}
      >
        <ChevronsRight aria-hidden="true" />
      </Button>
    )
  }

  return (
    <aside className="main-sidebar" aria-label="Main navigation">
      <nav className="main-sidebar-nav">
        <div className="main-sidebar-heading">
          <span className="main-sidebar-label">Workspace</span>
          <Button
            isIconOnly
            variant="ghost"
            className="sidebar-collapse-button"
            aria-label="Hide sidebar"
            onPress={() => onCollapsedChange(true)}
          >
            <ChevronsLeft aria-hidden="true" />
          </Button>
        </div>
        <Button
          className="sidebar-link is-active"
          variant="ghost"
          aria-current="page"
          onPress={() => void navigate({ to: '/' })}
        >
          <span className="sidebar-link-icon">
            <Microphone aria-hidden="true" />
          </span>
          <span>Assistant</span>
        </Button>
        <Button
          className="sidebar-link"
          variant="ghost"
          onPress={() => openAccountPage('/listings')}
        >
          <span className="sidebar-link-icon">
            <Bookmark aria-hidden="true" />
          </span>
          <span>Saved listings</span>
        </Button>
        <Button
          className="sidebar-link"
          variant="ghost"
          onPress={() => openAccountPage('/profile')}
        >
          <span className="sidebar-link-icon">
            <Person aria-hidden="true" />
          </span>
          <span>Profile & settings</span>
        </Button>

        <div className="sidebar-sessions-heading">
          <span className="main-sidebar-label">Sessions</span>
          <Button
            isIconOnly
            variant="ghost"
            className="sidebar-new-session"
            aria-label="Reset and start a new thread"
            title="New thread"
            onPress={onNewConversation}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
        <div className="sidebar-sessions" aria-label="Previous conversations">
          {conversations.map((conversation) => (
            <Button
              key={conversation.id}
              className={`sidebar-session${conversation.id === activeConversationId ? ' is-active' : ''}`}
              variant="ghost"
              aria-current={conversation.id === activeConversationId ? 'true' : undefined}
              onPress={() => onSelectConversation(conversation.id)}
            >
              <Comment aria-hidden="true" />
              <span>{conversation.title}</span>
            </Button>
          ))}
        </div>
      </nav>

      <div className="sidebar-note">
        <span className="sidebar-note-dot" aria-hidden="true" />
        <div>
          <strong>Live shopping</strong>
          <span>Ask naturally to start researching.</span>
        </div>
      </div>
    </aside>
  )
}
