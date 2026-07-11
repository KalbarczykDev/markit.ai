import { useCallback, useEffect, useState } from 'react'

import type { AccountProfile } from './account'
import type { ConversationSummary } from './conversation-types'

type ConversationListResponse = { conversations?: ConversationSummary[] }
type ConversationCreateResponse = { conversation?: ConversationSummary }

export function useConversations(profile: AccountProfile | null) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string>()
  const [transientVersion, setTransientVersion] = useState(0)

  const refresh = useCallback(async (): Promise<ConversationSummary[]> => {
    if (!profile) return []
    const response = await fetch('/api/conversations', { credentials: 'same-origin' })
    if (!response.ok) return []
    const body = (await response.json()) as ConversationListResponse
    const next = body.conversations ?? []
    setConversations(next)
    const storageKey = `markit-conversation-${profile.id}`
    const saved = localStorage.getItem(storageKey)
    const selected = next.find((conversation) => conversation.id === saved) ?? next[0]
    if (selected) {
      setActiveConversationId((current) => current ?? selected.id)
      localStorage.setItem(storageKey, selected.id)
    }
    return next
  }, [profile])

  const createNew = useCallback(async () => {
    if (!profile) {
      setTransientVersion((current) => current + 1)
      return
    }
    const response = await fetch('/api/conversations', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return
    const body = (await response.json()) as ConversationCreateResponse
    if (!body.conversation) return
    setConversations((current) => [body.conversation!, ...current])
    setActiveConversationId(body.conversation.id)
    localStorage.setItem(`markit-conversation-${profile.id}`, body.conversation.id)
  }, [profile])

  useEffect(() => {
    if (!profile) {
      setConversations([])
      setActiveConversationId(undefined)
      return
    }
    void refresh().then(async (items) => {
      if (!items.length) await createNew()
    })
  }, [profile, refresh, createNew])

  const selectConversation = (id: string) => {
    setActiveConversationId(id)
    if (profile) localStorage.setItem(`markit-conversation-${profile.id}`, id)
  }

  return {
    conversations,
    activeConversationId,
    voiceKey: activeConversationId ?? `transient-${transientVersion}`,
    createNew,
    selectConversation,
    refresh,
  }
}
