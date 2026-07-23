import { defineConfig } from 'unocss'
import { presetAttributify, presetIcons, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
  preflights: [
    {
      getCSS: () => '.input-field::placeholder { color: var(--color-text-secondary); }',
    },
  ],
  theme: {
    colors: {
      primary: 'var(--color-primary)',
      'primary-text': 'var(--color-primary-text)',
      surface: 'var(--color-surface)',
      'surface-muted': 'var(--color-surface-muted)',
      'surface-field': 'var(--color-surface-field)',
      'surface-selected': 'var(--color-surface-selected)',
      stroke: 'var(--color-stroke)',
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
    'btn-primary':
      'w-full h-12 rounded-button bg-primary text-primary-text text-header font-medium flex items-center justify-center disabled:opacity-50',
    chip: 'h-10 px-4 rounded-standard border text-2nd-body font-medium flex items-center justify-center transition-colors',
    'chip-selected': 'bg-primary border-primary text-primary-text',
    'chip-unselected': 'bg-surface-muted border-transparent text-text-primary',
    card: 'bg-surface rounded-standard border border-stroke p-4',
    'page-title': 'text-title font-semibold text-text-primary',
    'section-title': 'text-subtitle font-semibold text-text-primary',
    'input-field':
      'w-full bg-surface-field rounded-standard p-4 text-body text-text-primary resize-none outline-none focus:ring-2 focus:ring-primary/30',
    'z-modal': 'z-50',
  },
})
