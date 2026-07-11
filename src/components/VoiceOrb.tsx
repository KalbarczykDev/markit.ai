import { useEffect, useRef, useState } from 'react'

type OrbState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

type AudioRuntime = {
  context: AudioContext
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  processor: ScriptProcessorNode
  silentGain: GainNode
}

const INPUT_RATE = 24_000

function floatToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0))
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return output
}

function resample(input: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === INPUT_RATE) return input
  const ratio = sourceRate / INPUT_RATE
  const length = Math.round(input.length / ratio)
  const output = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, input.length - 1)
    const mix = position - left
    output[index] = (input[left] ?? 0) * (1 - mix) + (input[right] ?? 0) * mix
  }
  return output
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function base64ToPcm(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Int16Array(bytes.buffer)
}

export function VoiceOrb() {
  const [state, setState] = useState<OrbState>('idle')
  const socketRef = useRef<WebSocket | null>(null)
  const audioRef = useRef<AudioRuntime | null>(null)
  const orbRef = useRef<HTMLButtonElement>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const playbackAtRef = useRef(0)

  const setLevel = (level: number) => {
    orbRef.current?.style.setProperty('--level', String(Math.min(1, level)))
  }

  const stop = () => {
    socketRef.current?.close()
    socketRef.current = null
    const audio = audioRef.current
    if (audio) {
      audio.processor.disconnect()
      audio.source.disconnect()
      audio.silentGain.disconnect()
      for (const track of audio.stream.getTracks()) track.stop()
      void audio.context.close()
    }
    audioRef.current = null
    if (playbackContextRef.current) void playbackContextRef.current.close()
    playbackContextRef.current = null
    playbackAtRef.current = 0
    setLevel(0)
    setState('idle')
  }

  useEffect(() => stop, [])

  const playAudio = (base64: string) => {
    const pcm = base64ToPcm(base64)
    const context = playbackContextRef.current ?? new AudioContext({ sampleRate: INPUT_RATE })
    playbackContextRef.current = context
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
    source.start(startsAt)
    playbackAtRef.current = startsAt + buffer.duration
    setLevel(Math.max(0.16, peak))
    source.addEventListener('ended', () => {
      if (context.currentTime >= playbackAtRef.current - 0.04) {
        setLevel(0.08)
        setState('listening')
      }
    })
  }

  const start = async () => {
    if (state !== 'idle' && state !== 'error') {
      stop()
      return
    }

    setState('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      const context = new AudioContext()
      await context.resume()
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
        setState('listening')
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'realtime',
              model: 'gpt-realtime-2.1',
              reasoning: { effort: 'low' },
              instructions:
                'You are Markit, a concise and warm voice assistant. Reply naturally and keep answers brief unless the user asks for detail.',
              output_modalities: ['audio'],
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: INPUT_RATE },
                  turn_detection: {
                    type: 'server_vad',
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
        if (typeof event.data !== 'string') return
        const message = JSON.parse(event.data) as { type?: string; delta?: string }
        if (
          message.type === 'response.output_audio.delta' ||
          message.type === 'response.audio.delta'
        ) {
          if (message.delta) {
            setState('speaking')
            playAudio(message.delta)
          }
        } else if (message.type === 'input_audio_buffer.speech_started') {
          setState('listening')
          playbackAtRef.current = 0
        } else if (message.type === 'error') {
          setState('error')
        }
      })

      socket.addEventListener('close', () => {
        if (socketRef.current === socket) setState('error')
      })
      socket.addEventListener('error', () => setState('error'))

      processor.addEventListener('audioprocess', (event) => {
        const input = event.inputBuffer.getChannelData(0)
        let sum = 0
        for (const sample of input) sum += sample * sample
        const level = Math.sqrt(sum / input.length)
        setLevel(Math.min(1, level * 7))
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
      stop()
      setState('error')
    }
  }

  const label =
    state === 'idle'
      ? 'Start voice conversation'
      : state === 'error'
        ? 'Voice unavailable. Try again'
        : 'End voice conversation'

  return (
    <button
      ref={orbRef}
      type="button"
      className="voice-orb"
      data-state={state}
      aria-label={label}
      title={label}
      onClick={() => void start()}
    >
      <span className="orb-halo" />
      <span className="orb-shell">
        <span className="orb-core" />
        <span className="orb-wave" />
      </span>
    </button>
  )
}
