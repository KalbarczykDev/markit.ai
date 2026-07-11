const slides = Array.from(document.querySelectorAll('.slide'))
const fullscreenButton = document.querySelector('#fullscreen')
const currentLabel = document.querySelector('#current-slide')
const totalLabel = document.querySelector('#total-slides')
const announcement = document.querySelector('#slide-announcement')
const deckShell = document.querySelector('.deck-shell')

let currentIndex = 0
let touchStartX = null
let touchStartY = null

function indexFromHash() {
  const parsed = Number.parseInt(window.location.hash.slice(1), 10)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(slides.length - 1, parsed - 1)) : 0
}

function formatSlideNumber(value) {
  return String(value).padStart(2, '0')
}

function renderSlide(nextIndex, options = {}) {
  const boundedIndex = Math.max(0, Math.min(slides.length - 1, nextIndex))
  currentIndex = boundedIndex

  slides.forEach((slide, index) => {
    const isActive = index === currentIndex
    slide.classList.remove('is-active')
    slide.hidden = !isActive
    slide.inert = !isActive
    slide.setAttribute('aria-hidden', String(!isActive))

    if (isActive) requestAnimationFrame(() => slide.classList.add('is-active'))
  })

  const activeSlide = slides[currentIndex]
  deckShell.classList.toggle(
    'on-dark',
    activeSlide.classList.contains('slide-dark') || activeSlide.classList.contains('slide-finale'),
  )
  const title =
    activeSlide.querySelector('h1, h2')?.textContent.trim() || `Slide ${currentIndex + 1}`

  currentLabel.textContent = formatSlideNumber(currentIndex + 1)
  totalLabel.textContent = formatSlideNumber(slides.length)
  document.title = `${title} | Markit.ai`

  const hash = `#${currentIndex + 1}`
  if (window.location.hash !== hash) history.replaceState(null, '', hash)
  if (options.announce !== false)
    announcement.textContent = `Slide ${currentIndex + 1} of ${slides.length}: ${title}`
}

function goNext() {
  if (currentIndex < slides.length - 1) renderSlide(currentIndex + 1)
}

function goPrevious() {
  if (currentIndex > 0) renderSlide(currentIndex - 1)
}

window.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return

  const target = event.target
  if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    return

  if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
    event.preventDefault()
    goNext()
  } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
    event.preventDefault()
    goPrevious()
  } else if (event.key === 'Home') {
    event.preventDefault()
    renderSlide(0)
  } else if (event.key === 'End') {
    event.preventDefault()
    renderSlide(slides.length - 1)
  }
})

window.addEventListener('hashchange', () => renderSlide(indexFromHash()))

deckShell.addEventListener(
  'touchstart',
  (event) => {
    const touch = event.changedTouches[0]
    touchStartX = touch?.clientX ?? null
    touchStartY = touch?.clientY ?? null
  },
  { passive: true },
)

deckShell.addEventListener(
  'touchend',
  (event) => {
    if (touchStartX === null || touchStartY === null) return
    const touch = event.changedTouches[0]
    const deltaX = (touch?.clientX ?? touchStartX) - touchStartX
    const deltaY = (touch?.clientY ?? touchStartY) - touchStartY
    touchStartX = null
    touchStartY = null

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return
    if (deltaX < 0) goNext()
    else goPrevious()
  },
  { passive: true },
)

function updateFullscreenLabel() {
  const isFullscreen = Boolean(document.fullscreenElement)
  fullscreenButton.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen')
}

if (!document.fullscreenEnabled) {
  fullscreenButton.hidden = true
} else {
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await deckShell.requestFullscreen()
    } catch {
      fullscreenButton.hidden = true
    }
  })
  document.addEventListener('fullscreenchange', updateFullscreenLabel)
}

renderSlide(indexFromHash(), { announce: false })
