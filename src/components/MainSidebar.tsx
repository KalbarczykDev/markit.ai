import { Bookmark, ChevronsLeft, ChevronsRight, Microphone, Person } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'

import { useAccount } from '@/account'

type MainSidebarProps = {
  isCollapsed: boolean
  onCollapsedChange: (isCollapsed: boolean) => void
}

export function MainSidebar({ isCollapsed, onCollapsedChange }: MainSidebarProps) {
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
