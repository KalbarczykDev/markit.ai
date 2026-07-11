export const INPUT_RATE = 24_000

export function floatToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0))
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return output
}

export function resample(input: Float32Array, sourceRate: number): Float32Array {
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

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

export function base64ToPcm(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Int16Array(bytes.buffer)
}
