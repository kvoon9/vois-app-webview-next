import { defineConfig } from 'unocss'
import { presetAttributify, presetIcons, presetWind3 } from 'unocss'
import type { BlocklistRule } from 'unocss'

/**
 * Both families are unsupported on the Chrome 83 legacy target: flex `gap`
 * shipped in Chrome 84, and `grid` brings a layout model whose fallback path
 * is the expensive one on low-end devices. `space-*` and margins produce the
 * same spacing with no compatibility risk. Blocking at the engine level means
 * the build emits no CSS for them; `banned-utilities.test.ts` fails the build
 * instead of dropping the class silently.
 */
export const BLOCKED_UTILITIES: BlocklistRule[] = [
  [/^(inline-)?grid(-|$)/, { message: 'Use flex instead of grid.' }],
  [/^gap(-|$)/, { message: 'Use space-* or margin instead of gap.' }],
]

/**
 * Borderless UI: the Figma source barely uses borders. Separate surfaces with
 * `bg-surface` / `bg-surface-elevated` plus whitespace, and prefer a shortcut
 * over raw classes. A shortcut named after a built-in variant (`link`, `empty`)
 * silently emits no CSS.
 */
export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      // Mask mode renders every icon as a CSS mask filled with `currentColor`, so
      // icons inherit text colour instead of baking in the SVG's own colours.
      mode: 'mask',
      warn: true,
      extraProperties: {
        display: 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  blocklist: BLOCKED_UTILITIES,
  preflights: [
    {
      getCSS: () => '.input-field::placeholder { color: var(--color-text-secondary); }',
    },
  ],
  theme: {
    colors: {
      primary: 'var(--color-primary)',
      'primary-strong': 'var(--color-primary-strong)',
      'primary-text': 'var(--color-primary-text)',
      danger: 'var(--color-danger)',
      'danger-text': 'var(--color-danger-text)',
      surface: 'var(--color-surface)',
      'surface-elevated': 'var(--color-surface-elevated)',
      'surface-muted': 'var(--color-surface-muted)',
      'surface-field': 'var(--color-surface-field)',
      'surface-selected': 'var(--color-surface-selected)',
      // Neutral fill for control tracks, checkboxes, radios and dots; a fill,
      // never a border.
      fill: 'var(--color-fill)',
      'text-primary': 'var(--color-text-primary)',
      'text-secondary': 'var(--color-text-secondary)',
    },
    fontFamily: {
      sans: '"SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    fontSize: {
      title: ['24px', '32px'],
      subtitle: ['20px', '28px'],
      header: ['16px', '24px'],
      body: ['16px', '24px'],
      '2nd-body': ['14px', '20px'],
      small: ['12px', '16px'],
    },
  },
  rules: [
    ['rounded-standard', { 'border-radius': '12px' }],
    ['rounded-button', { 'border-radius': '12px' }],
    ['rounded-small', { 'border-radius': '8px' }],
    ['rounded-large', { 'border-radius': '16px' }],
  ],
  shortcuts: {
    // No borders anywhere: surfaces are separated by fill colour and whitespace.
    // Use `page`/`panel`/`card`/`nav-item` instead of reintroducing `border`.
    page: 'min-h-screen min-h-svh bg-surface text-text-primary',
    // Borderless grouped-list surface
    panel: 'rounded-standard bg-surface-elevated',
    // Row inside a panel; owns the shared row layout for panel-row and nav-item.
    // Height/font stay at the call site so rows can vary without overriding.
    'panel-row': 'flex items-center justify-between px-4',
    // Standalone elevated row for navigation entries. Avoid a `link` prefix: it
    // collides with UnoCSS's built-in `link` variant and emits `.link-item:link`.
    'nav-item': 'panel-row rounded-standard bg-surface-elevated text-body',
    card: 'bg-surface-elevated rounded-standard p-4',
    // Square check control. `-on` fills primary; `-off` uses the fill colour so
    // it stays visible on both light and dark surfaces.
    checkbox: 'h-5 w-5 flex-none flex items-center justify-center rounded-small',
    'checkbox-on': 'bg-primary text-primary-text',
    'checkbox-off': 'bg-fill',
    // Round radio control, same on/off contract as checkbox
    radio: 'h-5 w-5 flex-none rounded-full',
    'radio-on': 'bg-primary',
    'radio-off': 'bg-fill',
    // Presence dot overlaid on an avatar; the surface-coloured ring punches a
    // gap out of the avatar behind it.
    'status-dot': 'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface',
    'btn-primary':
      'w-full h-12 rounded-button bg-primary text-primary-text text-header font-medium flex items-center justify-center disabled:opacity-50',
    // Outline buttons carry their affordance in a surface fill instead of a stroke
    'btn-secondary':
      'w-full rounded-button bg-surface-elevated px-4 py-3 text-body disabled:opacity-50',
    'btn-danger':
      'w-full rounded-button bg-surface-elevated px-4 py-3 text-body text-danger disabled:opacity-50',
    chip: 'h-10 px-4 rounded-standard text-2nd-body font-medium flex items-center justify-center transition-colors',
    'chip-selected': 'bg-primary-strong text-primary-text',
    'chip-unselected': 'bg-surface-muted text-text-primary',
    // Round icon button (floating action button)
    fab: 'h-14 w-14 rounded-full bg-surface-elevated flex items-center justify-center text-3xl leading-none text-primary shadow-lg',
    // Chevron hint for rows that navigate somewhere. Size matches a body line so
    // it aligns with the label text instead of the row box.
    'row-chevron': 'ml-2 flex-none text-xl text-text-secondary i-ph-caret-right',
    // Square icon button used inside rows (copy, edit, clear).
    'icon-button':
      'flex-none flex items-center justify-center rounded-small text-text-secondary disabled:opacity-50',
    'page-title': 'text-title font-semibold text-text-primary',
    'section-title': 'text-subtitle font-semibold text-text-primary',
    'input-field':
      'w-full bg-surface-field rounded-standard p-4 text-body text-text-primary resize-none outline-none focus:ring-2 focus:ring-primary/30',
    'z-modal': 'z-50',
    'z-drawer': 'z-60',
    'z-drawer-content': 'z-70',
  },
})
