<script setup lang="ts">
/**
 * Adapted from balint's (@BalintFerenczy) folded scroll edges demo, a pure-CSS answer to Enes
 * Ozturk's HTML-in-Canvas version: nested rotateX planes with a scroll-driven animation and one
 * edge mask. https://x.com/BalintFerenczy/status/2116147301823688781
 */
import { h, onBeforeUnmount, shallowRef, watch, type FunctionalComponent } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ select: [emoji: string]; close: [] }>()

/** Planes per folded edge; more planes give a smoother curl. */
const PLANES = 20
/** Extra height per plane so adjacent copies share a sliver of sheet, hiding crease seams. */
const OVERLAP = 0.8

/**
 * Curated emoji sections. Occurrence order defines the global index carried by
 * `data-i`, shared by every 3D copy of the same cell.
 */
const SECTIONS: Array<{ title: string; emojis: string[] }> = [
  {
    title: 'Frequently Used',
    emojis: [
      '😀',
      '😂',
      '🥰',
      '😍',
      '😎',
      '🤔',
      '👍',
      '🙏',
      '🔥',
      '❤️',
      '🎉',
      '😭',
      '🥺',
      '😴',
      '🤝',
      '💪',
      '✨',
      '⭐',
      '💯',
      '👀',
      '😅',
      '🤣',
      '😊',
      '🙃',
      '😉',
      '😌',
      '😔',
      '😢',
      '😤',
      '😱',
      '🤯',
      '🥳',
      '🤗',
      '🫶',
      '👋',
      '👌',
      '✌️',
      '🤙',
      '💬',
      '📱',
      '🎨',
      '🐛',
      '🚀',
      '📎',
      '📝',
      '⚡',
      '✅',
      '❌',
    ],
  },
  {
    title: 'Smileys & People',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '🤣',
      '😂',
      '🙂',
      '🙃',
      '😉',
      '😊',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😚',
      '😋',
      '😛',
      '😜',
      '🤪',
      '🤑',
      '🤗',
      '🤭',
      '🤫',
      '🤔',
      '🤐',
      '😐',
      '😑',
      '😶',
      '😏',
      '😒',
      '🙄',
      '😬',
      '😌',
      '😴',
      '😷',
      '🤒',
      '🤕',
      '🤢',
      '🥵',
      '🥶',
      '🤯',
      '🤠',
      '🥳',
      '😎',
      '🤓',
    ],
  },
  {
    title: 'Animals & Nature',
    emojis: [
      '🐶',
      '🐱',
      '🐭',
      '🐹',
      '🐰',
      '🦊',
      '🐻',
      '🐼',
      '🐨',
      '🐯',
      '🦁',
      '🐮',
      '🐷',
      '🐸',
      '🐵',
      '🙈',
      '🐔',
      '🐧',
      '🐦',
      '🐤',
      '🦆',
      '🦅',
      '🦉',
      '🦇',
      '🐺',
      '🐗',
      '🐴',
      '🦄',
      '🐝',
      '🐛',
      '🦋',
      '🐌',
      '🐞',
      '🐜',
      '🐢',
      '🐍',
      '🦎',
      '🐙',
      '🦑',
      '🦀',
      '🐡',
      '🐠',
      '🐟',
      '🐬',
      '🐳',
      '🦈',
      '🐊',
      '🐅',
    ],
  },
  {
    title: 'Food & Drink',
    emojis: [
      '🍇',
      '🍈',
      '🍉',
      '🍊',
      '🍋',
      '🍌',
      '🍍',
      '🥭',
      '🍎',
      '🍏',
      '🍐',
      '🍑',
      '🍒',
      '🍓',
      '🥝',
      '🍅',
      '🥑',
      '🍆',
      '🥔',
      '🥕',
      '🌽',
      '🌶️',
      '🥒',
      '🥬',
      '🥦',
      '🧄',
      '🧅',
      '🍄',
      '🥜',
      '🍞',
      '🥐',
      '🥖',
      '🧀',
      '🥚',
      '🍳',
      '🥞',
      '🧇',
      '🥓',
      '🍔',
      '🍟',
      '🍕',
      '🌭',
      '🌮',
      '🌯',
      '🍜',
      '🍚',
      '🍣',
      '🍩',
    ],
  },
  {
    title: 'Objects',
    emojis: [
      '⌚',
      '📱',
      '💻',
      '⌨️',
      '🖥️',
      '🖱️',
      '💾',
      '📷',
      '📸',
      '🎥',
      '📞',
      '☎️',
      '📺',
      '📻',
      '🎙️',
      '⏰',
      '⌛',
      '💡',
      '🔋',
      '🔌',
      '🔦',
      '🕯️',
      '🧯',
      '💸',
      '💰',
      '💳',
      '💎',
      '⚖️',
      '🧰',
      '🔧',
      '🔨',
      '🧲',
      '🔒',
      '🔑',
      '🗝️',
      '🚪',
      '🪑',
      '🛏️',
      '🧸',
      '🖼️',
      '🛍️',
      '🛒',
      '🎁',
      '🎈',
      '🎀',
      '🎉',
      '✉️',
      '📦',
    ],
  },
]

const ALL_EMOJIS: string[] = []
const SECTIONS_VIEW: Array<{ title: string; cells: Array<{ emoji: string; index: number }> }> = []
{
  let cursor = 0
  for (const section of SECTIONS) {
    const cells = section.emojis.map((emoji) => {
      ALL_EMOJIS.push(emoji)
      return { emoji, index: cursor++ }
    })
    SECTIONS_VIEW.push({ title: section.title, cells })
  }
}

/** The full sheet, rendered once per copy: the flat strip plus every plane. */
const EmojiContent: FunctionalComponent = () =>
  h(
    'div',
    { class: 'content' },
    SECTIONS_VIEW.map((section) =>
      h('div', { class: 'section', key: section.title }, [
        h('div', { class: 'section-title' }, section.title),
        h(
          'div',
          { class: 'row' },
          section.cells.map((cell) =>
            h(
              'span',
              { class: 'emoji', 'data-i': String(cell.index), key: cell.index },
              cell.emoji,
            ),
          ),
        ),
      ]),
    ),
  )

/**
 * One chain of nested planes. Each plane is a child of the previous one, so the
 * per-plane rotateX shares accumulate into the curl curve, and each plane's
 * hinge travels with its parent's rotation for free.
 */
const PlaneChain: FunctionalComponent<{ side: 'top' | 'bottom'; depth: number }> = (chainProps) => {
  if (chainProps.depth >= PLANES) return null
  return h('div', { class: ['slice', chainProps.side] }, [
    h('div', { class: 'clip' }, [h(EmojiContent)]),
    h(PlaneChain, { side: chainProps.side, depth: chainProps.depth + 1 }),
  ])
}
// Declared props stay off the DOM: without this, side/depth fall through as
// attributes on every plane.
PlaneChain.props = {
  side: { type: String, required: true },
  depth: { type: Number, required: true },
}

// Element refs and a number only; nothing here needs deep reactivity.
const rootRef = shallowRef<HTMLElement | null>(null)
const stageRef = shallowRef<HTMLElement | null>(null)
const midRef = shallowRef<HTMLElement | null>(null)
const scrollerRef = shallowRef<HTMLElement | null>(null)

/** scrollHeight minus viewport of the flat window; the spacer adds exactly this. */
const scrollRange = shallowRef(0)

/**
 * True where scroll-driven animations run: the keyframes below own the coupling
 * and the scroll listener is never attached. Chrome 83, the WebView target,
 * takes the JS path.
 */
const cssDriven =
  CSS.supports('animation-timeline: scroll()') &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Reads --flap from CSS, measures the flat strip, then sizes the spacer and
 * every plane: height step+OVERLAP, per-side top offset, and the per-plane
 * --y0 that keeps all content copies aligned across creases.
 */
function layout(): void {
  const root = rootRef.value
  const mid = midRef.value
  const scroller = scrollerRef.value
  if (!root || !mid || !scroller) return

  const flap = Number.parseFloat(getComputedStyle(root).getPropertyValue('--flap')) || 260
  const center = mid.offsetHeight
  const visibleFlap = mid.offsetTop
  const step = flap / PLANES

  const ownContent = mid.querySelector<HTMLElement>(':scope > .clip > .content')
  const contentHeight = Math.max(center, ownContent ? ownContent.offsetHeight : 0)
  const range = Math.max(0, contentHeight - (center + visibleFlap * 2))

  root.style.setProperty('--step', `${step}px`)
  root.style.setProperty('--range', `${range}px`)
  scrollRange.value = range

  // SAFETY: the template renders exactly one .spacer as the scroller's first child.
  const spacer = scroller.firstElementChild as HTMLElement | null
  if (spacer) spacer.style.height = `${scroller.clientHeight + range}px`

  root.querySelectorAll<HTMLElement>('.slice.top').forEach((plane, i) => {
    plane.style.height = `${step + OVERLAP}px`
    plane.style.top = i === 0 ? `-${step + OVERLAP}px` : `${-step}px`
    plane.style.setProperty('--y0', `${(i + 1) * step + OVERLAP}px`)
  })
  root.querySelectorAll<HTMLElement>('.slice.bottom').forEach((plane, i) => {
    plane.style.height = `${step + OVERLAP}px`
    plane.style.top = i === 0 ? `${center}px` : `${step}px`
    plane.style.setProperty('--y0', `${-(center + i * step)}px`)
  })

  if (!cssDriven) frame()
}

/**
 * Maps the scroller's position onto the shared custom properties. At the top of
 * the content the top edge is fully rolled away and the bottom edge lies flat;
 * scrolling swaps the two. Every copy translates by var(--y0) - var(--scroll),
 * so one inherited property moves all copies without per-node writes.
 */
function frame(): void {
  const root = rootRef.value
  const scroller = scrollerRef.value
  if (!root || !scroller) return
  const range = scrollRange.value
  const progress = range > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / range)) : 0
  root.style.setProperty('--top', `${1 - progress}`)
  root.style.setProperty('--bottom', `${progress}`)
  root.style.setProperty('--scroll', `${scroller.scrollTop}px`)
}

let raf = 0

function onScroll(): void {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    frame()
  })
}

/** The scroller covers the stage, so hit-testing goes through the element stack. */
function emojiIndexAt(x: number, y: number): number {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el instanceof HTMLElement && el.classList.contains('emoji')) {
      const index = Number(el.dataset.i)
      return ALL_EMOJIS[index] === undefined ? -1 : index
    }
  }
  return -1
}

function onTap(event: MouseEvent): void {
  const index = emojiIndexAt(event.clientX, event.clientY)
  if (index < 0) return
  emit('select', ALL_EMOJIS[index])
  emit('close')
}

function clearHover(): void {
  hoverIndex = -1
  rootRef.value?.querySelectorAll<HTMLElement>('.emoji.hover').forEach((el) => {
    el.classList.remove('hover')
  })
}

let hoverIndex = -1

function setHover(index: number): void {
  if (index === hoverIndex) return
  clearHover()
  hoverIndex = index
  rootRef.value
    ?.querySelectorAll<HTMLElement>(`.emoji[data-i="${index}"]`)
    .forEach((el) => el.classList.add('hover'))
}

/** Desktop-only affordance: highlight the hovered cell in every copy. */
function onHover(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') {
    clearHover()
    return
  }
  const index = emojiIndexAt(event.clientX, event.clientY)
  if (index < 0) clearHover()
  else setHover(index)
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      clearHover()
      return
    }
    // One frame so the overlay has painted and the refs hold real elements.
    requestAnimationFrame(layout)
  },
  { immediate: true },
)

useResizeObserver(stageRef, layout)

if (!cssDriven) {
  useEventListener(() => scrollerRef.value, 'scroll', onScroll, { passive: true })
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (props.open && event.key === 'Escape') emit('close')
})

onBeforeUnmount(() => {
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
})
</script>

<template>
  <div v-if="open" class="picker-backdrop" @click.self="emit('close')">
    <div ref="rootRef" class="picker" role="dialog" aria-label="Emoji picker" aria-modal="true">
      <header class="picker-head">
        <span class="picker-title">Emoji</span>
        <button type="button" class="picker-close" aria-label="Close" @click="emit('close')">
          <span class="i-ph-x" aria-hidden="true" />
        </button>
      </header>
      <div ref="stageRef" class="stage">
        <div ref="midRef" class="mid">
          <div class="clip">
            <EmojiContent />
          </div>
          <PlaneChain side="top" :depth="0" />
          <PlaneChain side="bottom" :depth="0" />
        </div>
        <div
          ref="scrollerRef"
          class="scroller"
          @click="onTap"
          @pointermove="onHover"
          @pointerleave="clearHover"
        >
          <div class="spacer" aria-hidden="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 60;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 40%);
}

.picker {
  /* Knobs. --per-plane is 1 / --planes as a literal because calc() division by
   * a var() is unreliable on the Chrome 83 target. layout() derives --step and
   * --range from the DOM; --top/--bottom/--scroll come from the scroll coupling. */
  --curl: 90deg;
  --curl-distance: 40px;
  --fade: 72px;
  --perspective: 2400px;
  --planes: 20;
  --per-plane: 0.05;
  --center: 300px;
  --flap: 260px;
  --visible-flap: calc(var(--flap) * 0.5);
  --step: 13px;

  position: relative;
  width: min(352px, 100%);
  border-radius: 16px 16px 0 0;
  background: var(--color-surface-elevated, #f3f3f4);
  color: var(--color-text-primary, #1d1d1f);
}

@media (max-height: 620px) {
  .picker {
    --center: 200px;
    --flap: 180px;
  }
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.picker-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}

.picker-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--color-surface-muted, #f5f6f8);
  color: var(--color-text-secondary, #6b6b6c);
  cursor: pointer;
}

.stage {
  position: relative;
  overflow: hidden;
  padding: var(--visible-flap) 0;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 calc(var(--fade) + (var(--visible-flap) - var(--fade)) * var(--top, 0)),
    #000 calc(100% - var(--fade) - (var(--visible-flap) - var(--fade)) * var(--bottom, 0)),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 calc(var(--fade) + (var(--visible-flap) - var(--fade)) * var(--top, 0)),
    #000 calc(100% - var(--fade) - (var(--visible-flap) - var(--fade)) * var(--bottom, 0)),
    transparent 100%
  );
}

.mid {
  position: relative;
  height: var(--center);
  perspective: var(--perspective);
  transform-style: preserve-3d;
}

/* The plane chains and their content copies come from functional components, so
 * they carry no scope attribute; every rule below reaches them via :deep(). */
.mid :deep(.slice) {
  position: absolute;
  left: 0;
  width: 100%;
  transform-style: preserve-3d;
}

.mid :deep(.slice.top) {
  transform-origin: 50% 100%;
  transform: translateZ(calc(-1 * var(--curl-distance) * var(--top, 0) * var(--per-plane)))
    rotateX(calc(var(--curl) * var(--top, 0) * var(--per-plane)));
}

.mid :deep(.slice.bottom) {
  transform-origin: 50% 0%;
  transform: translateZ(calc(-1 * var(--curl-distance) * var(--bottom, 0) * var(--per-plane)))
    rotateX(calc(-1 * var(--curl) * var(--bottom, 0) * var(--per-plane)));
}

.mid :deep(.clip),
.clip {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
}

.mid :deep(.content),
.content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding: 0 12px;
  transform: translateY(calc(var(--y0, 0px) - var(--scroll, 0px)));
}

.mid :deep(.section-title) {
  padding: 8px 4px 4px;
  font-size: 12px;
  line-height: 16px;
  color: var(--color-text-secondary, #6b6b6c);
}

.mid :deep(.row) {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
}

.mid :deep(.emoji) {
  display: grid;
  place-items: center;
  height: 50px;
  border-radius: 8px;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
  font-size: 32px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.mid :deep(.emoji.hover) {
  background: var(--color-surface-muted, #f5f6f8);
}

.scroller {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.scroller::-webkit-scrollbar {
  display: none;
}

.spacer {
  width: 100%;
}

/* Progressive enhancement: where scroll timelines run, the keyframes replace the
 * JS listener entirely. @property lives in this block too because the JS path's
 * Chrome 83 has no @property and runs on plain unregistered custom properties. */
@supports (animation-timeline: scroll()) {
  @property --top {
    syntax: '<number>';
    inherits: true;
    initial-value: 1;
  }

  @property --bottom {
    syntax: '<number>';
    inherits: true;
    initial-value: 0;
  }

  @property --scroll {
    syntax: '<length>';
    inherits: true;
    initial-value: 0px;
  }

  .picker {
    timeline-scope: --picker-scroll;
  }

  .scroller {
    scroll-timeline: --picker-scroll y;
  }

  .stage {
    animation: picker-curl linear both;
    animation-timeline: --picker-scroll;
  }

  @keyframes picker-curl {
    from {
      --top: 1;
      --bottom: 0;
      --scroll: 0px;
    }

    to {
      --top: 0;
      --bottom: 1;
      --scroll: var(--range, 0px);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .mid :deep(.slice) {
    transform: none;
  }

  .stage {
    animation: none;
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent 0,
      #000 var(--fade),
      #000 calc(100% - var(--fade)),
      transparent 100%
    );
    mask-image: linear-gradient(
      to bottom,
      transparent 0,
      #000 var(--fade),
      #000 calc(100% - var(--fade)),
      transparent 100%
    );
  }
}
</style>
