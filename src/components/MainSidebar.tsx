import { Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'

import { useAccount } from '@/account'

type SidebarIconProps = { name: 'assistant' | 'favorites' | 'profile' }

function SidebarIcon({ name }: SidebarIconProps) {
  if (name === 'assistant') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 2.5v15M6.5 6v8M13.5 5v10M3 8v4M17 8v4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (name === 'favorites') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="m10 15.7-1.1-1C5 11.2 2.5 9 2.5 6.2A3.7 3.7 0 0 1 6.3 2.5c1.5 0 2.9.7 3.7 1.8a4.7 4.7 0 0 1 3.7-1.8 3.7 3.7 0 0 1 3.8 3.7c0 2.8-2.5 5-6.4 8.5l-1.1 1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 17c.4-3.2 2.4-5 6-5s5.6 1.8 6 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MainSidebar() {
  const navigate = useNavigate()
  const { profile } = useAccount()

  const openAccountPage = (to: '/favorites' | '/profile') => {
    void navigate({ to: profile ? to : '/login' })
  }

  return (
    <aside className="main-sidebar" aria-label="Main navigation">
      <nav className="main-sidebar-nav">
        <span className="main-sidebar-label">Workspace</span>
        <Button
          className="sidebar-link is-active"
          variant="ghost"
          aria-current="page"
          onPress={() => void navigate({ to: '/' })}
        >
          <span className="sidebar-link-icon">
            <SidebarIcon name="assistant" />
          </span>
          <span>Assistant</span>
        </Button>
        <Button
          className="sidebar-link"
          variant="ghost"
          onPress={() => openAccountPage('/favorites')}
        >
          <span className="sidebar-link-icon">
            <SidebarIcon name="favorites" />
          </span>
          <span>Favorites</span>
        </Button>
        <Button
          className="sidebar-link"
          variant="ghost"
          onPress={() => openAccountPage('/profile')}
        >
          <span className="sidebar-link-icon">
            <SidebarIcon name="profile" />
          </span>
          <span>Profile & settings</span>
        </Button>
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
