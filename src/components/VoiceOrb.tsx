import { Button, Spinner } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'

import type { FavoriteListing } from '@/favorite-types'
import type { ProductAnalysis, ProductCardData } from '@/product-types'
import { INPUT_RATE, base64ToPcm, bytesToBase64, floatToPcm16, resample } from '@/realtime-audio'

import { ProductResults } from './ProductResults'

type OrbState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'searching'
  | 'checkout'
  | 'speaking'
  | 'search-error'
  | 'error'

type AudioRuntime = {
  context: AudioContext
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  processor: ScriptProcessorNode
  silentGain: GainNode
}

type ActiveOutput = {
  itemId: string
  responseId: string
  contentIndex: number
  startedAt: number
}

type RealtimeMessage = {
  type?: string
  status?: string
  delta?: string
  item_id?: string
  response_id?: string
  content_index?: number
  action?: 'show' | 'close'
  heading?: string
  products?: ProductCardData[]
  favorites?: FavoriteListing[]
  url?: string
  analysis?: ProductAnalysis
  phase?: 'started' | 'completed'
  tool?: string
  response?: { id?: string }
}

const STATUS_LABELS: Record<OrbState, string> = {
  idle: 'Tap to talk',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Checking product data',
  searching: 'Researching products',
  checkout: 'Opening secure checkout',
  speaking: 'Speaking',
  'search-error': 'Search unavailable',
  error: 'Connection unavailable',
}

export function VoiceOrb() {
  const [state, setState] = useState<OrbState>('idle')
  const [productDisplay, setProductDisplay] = useState<{
    isOpen: boolean
    heading: string
    products: ProductCardData[]
  }>({ isOpen: false, heading: 'Current picks', products: [] })
  const [analyses, setAnalyses] = useState<Record<string, ProductAnalysis>>({})
  const [favoritedUrls, setFavoritedUrls] = useState<ReadonlySet<string>>(new Set())
  const socketRef = useRef<WebSocket | null>(null)
  const audioRef = useRef<AudioRuntime | null>(null)
  const orbRef = useRef<HTMLButtonElement>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const playbackAtRef = useRef(0)
  const playbackSourcesRef = useRef(new Set<AudioBufferSourceNode>())
  const playbackGenerationRef = useRef(0)
  const activeOutputRef = useRef<ActiveOutput | null>(null)
  const activeResponseRef = useRef<string | null>(null)
  const interruptedResponsesRef = useRef(new Set<string>())
  const toolActiveRef = useRef(false)
  const sessionReadyRef = useRef(false)
  const runningRef = useRef(false)
  const mountedRef = useRef(true)

  const setLevel = (level: number) => {
    orbRef.current?.style.setProperty('--level', String(Math.min(1, level)))
  }

  const haltPlayback = (socket?: WebSocket, truncate = false) => {
    const context = playbackContextRef.current
    const output = activeOutputRef.current
    if (truncate && context && output && socket?.readyState === WebSocket.OPEN) {
      const audioEndMs = Math.max(0, Math.round((context.currentTime - output.startedAt) * 1000))
      socket.send(
        JSON.stringify({
          type: 'conversation.item.truncate',
          item_id: output.itemId,
          content_index: output.contentIndex,
          audio_end_ms: audioEndMs,
        }),
      )
    }

    playbackGenerationRef.current += 1
    for (const source of playbackSourcesRef.current) {
      try {
        source.stop()
      } catch {}
      source.disconnect()
    }
    playbackSourcesRef.current.clear()
    playbackAtRef.current = context?.currentTime ?? 0
    activeOutputRef.current = null
    setLevel(0.08)
  }

  const shutdown = (updateState = true) => {
    runningRef.current = false
    const socket = socketRef.current
    socketRef.current = null
    socket?.close()

    const audio = audioRef.current
    audioRef.current = null
    if (audio) {
      audio.processor.disconnect()
      audio.source.disconnect()
      audio.silentGain.disconnect()
      for (const track of audio.stream.getTracks()) track.stop()
      void audio.context.close()
    }

    haltPlayback()
    if (playbackContextRef.current) void playbackContextRef.current.close()
    playbackContextRef.current = null
    playbackAtRef.current = 0
    activeResponseRef.current = null
    interruptedResponsesRef.current.clear()
    toolActiveRef.current = false
    sessionReadyRef.current = false
    setLevel(0)
    if (updateState && mountedRef.current) {
      setProductDisplay({ isOpen: false, heading: 'Current picks', products: [] })
      setAnalyses({})
      setState('idle')
    }
  }

  useEffect(
    () => () => {
      mountedRef.current = false
      shutdown(false)
    },
    [],
  )

  const playAudio = (base64: string, output: Omit<ActiveOutput, 'startedAt'>) => {
    const pcm = base64ToPcm(base64)
    const context = playbackContextRef.current
    if (!context || !pcm.length) return

    const currentOutput = activeOutputRef.current
    if (
      currentOutput &&
      (currentOutput.itemId !== output.itemId || currentOutput.responseId !== output.responseId)
    ) {
      haltPlayback()
    }

    const buffer = context.createBuffer(1, pcm.length, INPUT_RATE)
    const channel = buffer.getChannelData(0)
    let peak = 0
    for (let index = 0; index < pcm.length; index += 1) {
      channel[index] = (pcm[index] ?? 0) / 0x8000
      peak = Math.max(peak, Math.abs(channel[index] ?? 0))
    }

    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    const startsAt = Math.max(context.currentTime, playbackAtRef.current)
    if (!activeOutputRef.current) activeOutputRef.current = { ...output, startedAt: startsAt }
    const generation = playbackGenerationRef.current
    playbackSourcesRef.current.add(source)
    source.start(startsAt)
    playbackAtRef.current = startsAt + buffer.duration
    setLevel(Math.max(0.16, peak))

    source.addEventListener('ended', () => {
      source.disconnect()
      playbackSourcesRef.current.delete(source)
      if (
        generation === playbackGenerationRef.current &&
        playbackSourcesRef.current.size === 0 &&
        context.currentTime >= playbackAtRef.current - 0.04
      ) {
        activeOutputRef.current = null
        setLevel(0.08)
        if (runningRef.current) setState('listening')
      }
    })
  }

  const start = async () => {
    if (runningRef.current) {
      shutdown()
      return
    }

    runningRef.current = true
    setState('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (!runningRef.current) {
        for (const track of stream.getTracks()) track.stop()
        return
      }

      const context = new AudioContext()
      const playbackContext = new AudioContext({ sampleRate: INPUT_RATE })
      await Promise.all([context.resume(), playbackContext.resume()])
      if (!runningRef.current) {
        for (const track of stream.getTracks()) track.stop()
        void context.close()
        void playbackContext.close()
        return
      }
      playbackContextRef.current = playbackContext
      playbackAtRef.current = playbackContext.currentTime

      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      const silentGain = context.createGain()
      silentGain.gain.value = 0
      source.connect(processor)
      processor.connect(silentGain)
      silentGain.connect(context.destination)
      audioRef.current = { context, stream, source, processor, silentGain }

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(`${protocol}//${location.host}/api/realtime`)
      socketRef.current = socket

      socket.addEventListener('open', () => {
        if (!runningRef.current || socketRef.current !== socket) return
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'realtime',
              model: 'gpt-realtime-2.1',
              reasoning: { effort: 'low' },
              output_modalities: ['audio'],
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: INPUT_RATE },
                  turn_detection: {
                    type: 'semantic_vad',
                    eagerness: 'high',
                    create_response: true,
                    interrupt_response: true,
                  },
                },
                output: { format: { type: 'audio/pcm', rate: INPUT_RATE }, voice: 'marin' },
              },
            },
          }),
        )
      })

      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string' || socketRef.current !== socket) return
        const message = JSON.parse(event.data) as RealtimeMessage

        if (message.type === 'session.updated') {
          sessionReadyRef.current = true
          setState('listening')
        } else if (message.type === 'response.created') {
          const responseId = message.response?.id
          if (responseId && activeResponseRef.current && activeResponseRef.current !== responseId) {
            haltPlayback()
          }
          activeResponseRef.current = responseId ?? null
          setState('thinking')
        } else if (message.type === 'response.output_audio.delta') {
          if (
            !toolActiveRef.current &&
            message.delta &&
            message.item_id &&
            message.response_id &&
            !interruptedResponsesRef.current.has(message.response_id)
          ) {
            setState('speaking')
            playAudio(message.delta, {
              itemId: message.item_id,
              responseId: message.response_id,
              contentIndex: message.content_index ?? 0,
            })
          }
        } else if (message.type === 'input_audio_buffer.speech_started') {
          const responseId = activeOutputRef.current?.responseId ?? activeResponseRef.current
          if (responseId) interruptedResponsesRef.current.add(responseId)
          haltPlayback(socket, true)
          if (!toolActiveRef.current) setState('listening')
        } else if (message.type === 'input_audio_buffer.speech_stopped') {
          if (!toolActiveRef.current) setState('thinking')
        } else if (message.type === 'markit.status') {
          if (message.status === 'searching') setState('searching')
          else if (message.status === 'thinking') setState('thinking')
          else if (message.status === 'search-error') setState('search-error')
        } else if (message.type === 'markit.tool') {
          toolActiveRef.current = message.phase === 'started'
          if (message.phase === 'started') {
            haltPlayback()
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'input_audio_buffer.clear' }))
            }
            setState(
              message.tool === 'search_products'
                ? 'searching'
                : message.tool === 'begin_checkout'
                  ? 'checkout'
                  : 'thinking',
            )
          }
        } else if (message.type === 'markit.products') {
          if (message.action === 'show' && message.products?.length) {
            setProductDisplay({
              isOpen: true,
              heading: message.heading || 'Current picks',
              products: message.products,
            })
          } else if (message.action === 'close') {
            setProductDisplay({ isOpen: false, heading: 'Current picks', products: [] })
            setAnalyses({})
          }
        } else if (message.type === 'markit.analysis') {
          const { url, analysis } = message
          if (url && analysis) {
            setAnalyses((previous) => ({ ...previous, [url]: analysis }))
          }
        } else if (message.type === 'markit.favorites' && message.favorites?.length) {
          setFavoritedUrls((previous) => {
            const updated = new Set(previous)
            for (const favorite of message.favorites ?? []) updated.add(favorite.url)
            return updated
          })
        } else if (message.type === 'markit.checkout' && message.url) {
          try {
            const checkoutUrl = new URL(message.url)
            if (
              checkoutUrl.protocol !== 'https:' ||
              checkoutUrl.hostname !== 'checkout.stripe.com'
            ) {
              throw new Error('Unexpected checkout destination')
            }
            setState('checkout')
            window.setTimeout(() => {
              shutdown(false)
              window.location.assign(checkoutUrl)
            }, 2_000)
          } catch {
            setState('error')
          }
        } else if (message.type === 'response.done') {
          const responseId = message.response?.id
          if (responseId) interruptedResponsesRef.current.delete(responseId)
          if (!responseId || activeResponseRef.current === responseId) {
            activeResponseRef.current = null
          }
        } else if (message.type === 'error') {
          setState('error')
        }
      })

      socket.addEventListener('close', () => {
        if (socketRef.current === socket && runningRef.current) setState('error')
      })
      socket.addEventListener('error', () => {
        if (socketRef.current === socket && runningRef.current) setState('error')
      })

      processor.addEventListener('audioprocess', (event) => {
        if (!runningRef.current || !sessionReadyRef.current || socketRef.current !== socket) return
        const input = event.inputBuffer.getChannelData(0)
        let sum = 0
        for (const sample of input) sum += sample * sample
        const level = Math.sqrt(sum / input.length)
        if (playbackSourcesRef.current.size === 0) setLevel(Math.min(1, level * 7))
        if (toolActiveRef.current) return
        if (socket.readyState !== WebSocket.OPEN) return
        const pcm = floatToPcm16(resample(input, context.sampleRate))
        socket.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: bytesToBase64(new Uint8Array(pcm.buffer)),
          }),
        )
      })
    } catch {
      shutdown(false)
      if (mountedRef.current) setState('error')
    }
  }

  const label =
    state === 'idle'
      ? 'Start voice conversation'
      : state === 'error'
        ? 'Voice unavailable. Try again'
        : 'End voice conversation'
  const isPending = state === 'connecting' || state === 'thinking' || state === 'searching'

  return (
    <div className={`commerce-agent ${productDisplay.isOpen ? 'has-products' : ''}`}>
      <div className="voice-agent">
        <Button
          ref={orbRef}
          type="button"
          isIconOnly
          variant="ghost"
          className="voice-orb"
          data-state={state}
          aria-label={label}
          title={label}
          onPress={() => void start()}
        >
          <span className="orb-halo" />
          <span className="orb-shell">
            <span className="orb-core" />
            <span className="orb-wave" />
          </span>
        </Button>
        <div className="agent-status" data-state={state} role="status" aria-live="polite">
          {isPending ? (
            <Spinner size="sm" color="current" />
          ) : (
            <span className="agent-status-dot" />
          )}
          <span>{STATUS_LABELS[state]}</span>
        </div>
      </div>
      <ProductResults
        isOpen={productDisplay.isOpen}
        heading={productDisplay.heading}
        products={productDisplay.products}
        analyses={analyses}
        favoritedUrls={favoritedUrls}
      />
    </div>
  )
}
